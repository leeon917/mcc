"use strict";
/**
 * StreamParser - Transform OpenAI streaming deltas to Anthropic SSE events
 *
 * Responsibilities:
 * - Process streaming deltas (reasoning_content, content, tool_calls)
 * - Coordinate with accumulator for state tracking
 * - Detect and handle planning loops
 * - Generate appropriate Anthropic SSE events
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamParser = void 0;
const response_builder_1 = require("./response-builder");
const tool_call_handler_1 = require("./tool-call-handler");
class StreamParser {
    constructor(config = {}) {
        this.verbose = config.verbose || false;
        this.debugMode = config.debugMode || false;
        this.debugLog = config.debugLog || false;
        this.responseBuilder = new response_builder_1.ResponseBuilder(this.verbose);
        this.toolCallHandler = new tool_call_handler_1.ToolCallHandler();
        this.writeDebugLog = config.writeDebugLog || (() => { });
    }
    /**
     * Transform OpenAI streaming delta to Anthropic events
     */
    transformDelta(openaiEvent, accumulator) {
        const events = [];
        // Debug logging for streaming deltas
        if (this.debugLog && openaiEvent.data) {
            this.writeDebugLog('delta-openai', openaiEvent.data);
        }
        // Handle [DONE] marker
        if (openaiEvent.event === 'done') {
            if (!accumulator.isFinalized()) {
                return this.finalizeDelta(accumulator);
            }
            return []; // Already finalized
        }
        // Usage update (appears in final chunk, may be before choice data)
        if (openaiEvent.data?.usage) {
            accumulator.updateUsage(openaiEvent.data.usage);
            // If we have both usage AND finish_reason, finalize immediately
            if (accumulator.getFinishReason()) {
                events.push(...this.finalizeDelta(accumulator));
                return events;
            }
        }
        const choice = openaiEvent.data?.choices?.[0];
        if (!choice)
            return events;
        const delta = choice.delta;
        if (!delta)
            return events;
        // Message start
        if (!accumulator.isMessageStarted()) {
            if (openaiEvent.data?.model) {
                accumulator.setModel(openaiEvent.data.model);
            }
            events.push(this.responseBuilder.createMessageStartEvent(accumulator));
            accumulator.setMessageStarted(true);
        }
        // Role
        if (delta.role) {
            accumulator.setRole(delta.role);
        }
        // Reasoning content delta
        if (delta.reasoning_content) {
            events.push(...this.handleReasoningDelta(delta.reasoning_content, accumulator));
        }
        // Text content delta
        if (delta.content) {
            events.push(...this.handleContentDelta(delta.content, accumulator));
        }
        // Check for planning loop
        if (accumulator.checkForLoop()) {
            this.log('WARNING: Planning loop detected - 3 consecutive thinking blocks with no tool calls');
            this.log('Forcing early finalization to prevent unbounded planning');
            events.push(...this.forceFinalization(accumulator));
            return events;
        }
        // Tool calls deltas
        if (delta.tool_calls && delta.tool_calls.length > 0) {
            events.push(...this.handleToolCallDeltas(delta.tool_calls, accumulator));
        }
        // Finish reason
        if (choice.finish_reason) {
            accumulator.setFinishReason(choice.finish_reason);
            // If we have both finish_reason AND usage, finalize immediately
            if (accumulator.hasUsageReceived()) {
                events.push(...this.finalizeDelta(accumulator));
            }
        }
        // Debug logging for generated events
        if (this.debugLog && events.length > 0) {
            this.writeDebugLog('delta-anthropic-events', {
                events,
                accumulator: accumulator.getSummary(),
            });
        }
        return events;
    }
    /**
     * Handle reasoning content delta
     */
    handleReasoningDelta(reasoningContent, accumulator) {
        const events = [];
        const currentBlock = accumulator.getCurrentBlock();
        if (this.debugMode) {
            console.error(`[StreamParser] Reasoning delta: ${reasoningContent.length} chars`);
            console.error(`[StreamParser] Current block: ${currentBlock?.type || 'none'}, index: ${currentBlock?.index ?? 'N/A'}`);
        }
        if (!currentBlock || currentBlock.type !== 'thinking') {
            // Start thinking block
            const block = accumulator.startBlock('thinking');
            events.push(this.responseBuilder.createContentBlockStartEvent(block));
            if (this.debugMode) {
                console.error(`[StreamParser] Started new thinking block ${block.index}`);
            }
        }
        accumulator.addDelta(reasoningContent);
        const currentThinkingBlock = accumulator.getCurrentBlock();
        if (currentThinkingBlock) {
            events.push(this.responseBuilder.createThinkingDeltaEvent(currentThinkingBlock, reasoningContent));
        }
        return events;
    }
    /**
     * Handle content delta
     */
    handleContentDelta(content, accumulator) {
        const events = [];
        const currentBlock = accumulator.getCurrentBlock();
        // Close thinking block if transitioning from thinking to text
        if (currentBlock && currentBlock.type === 'thinking' && !currentBlock.stopped) {
            events.push(...this.closeThinkingBlock(currentBlock, accumulator));
        }
        if (!accumulator.getCurrentBlock() || accumulator.getCurrentBlock()?.type !== 'text') {
            // Start text block
            const block = accumulator.startBlock('text');
            events.push(this.responseBuilder.createContentBlockStartEvent(block));
        }
        accumulator.addDelta(content);
        const currentTextBlock = accumulator.getCurrentBlock();
        if (currentTextBlock) {
            events.push(this.responseBuilder.createTextDeltaEvent(currentTextBlock, content));
        }
        return events;
    }
    /**
     * Handle tool call deltas
     */
    handleToolCallDeltas(toolCallDeltas, accumulator) {
        const events = [];
        if (!toolCallDeltas)
            return events;
        const currentBlock = accumulator.getCurrentBlock();
        if (currentBlock && !currentBlock.stopped && currentBlock.type !== 'tool_use') {
            if (currentBlock.type === 'thinking') {
                events.push(...this.closeThinkingBlock(currentBlock, accumulator));
            }
            else {
                events.push(this.responseBuilder.createContentBlockStopEvent(currentBlock));
                accumulator.stopCurrentBlock();
            }
        }
        events.push(...this.toolCallHandler.processToolCallDeltas(toolCallDeltas, accumulator));
        return events;
    }
    /**
     * Close thinking block with signature
     */
    closeThinkingBlock(block, accumulator) {
        const events = [];
        const signatureEvent = this.responseBuilder.createSignatureDeltaEvent(block);
        if (signatureEvent) {
            events.push(signatureEvent);
        }
        events.push(this.responseBuilder.createContentBlockStopEvent(block));
        accumulator.stopCurrentBlock();
        return events;
    }
    /**
     * Force finalization due to loop detection
     */
    forceFinalization(accumulator) {
        const events = [];
        const unstoppedBlocks = accumulator.getUnstoppedBlocks();
        for (const block of unstoppedBlocks) {
            if (block.type === 'thinking') {
                const signatureEvent = this.responseBuilder.createSignatureDeltaEvent(block);
                if (signatureEvent) {
                    events.push(signatureEvent);
                }
            }
            events.push(this.responseBuilder.createContentBlockStopEvent(block));
            block.stopped = true;
        }
        events.push(...this.finalizeDelta(accumulator));
        return events;
    }
    finalizeDelta(accumulator) {
        if (accumulator.isFinalized()) {
            return [];
        }
        const events = [];
        const unstoppedBlocks = accumulator.getUnstoppedBlocks();
        for (const block of unstoppedBlocks) {
            if (block.type === 'thinking') {
                const signatureEvent = this.responseBuilder.createSignatureDeltaEvent(block);
                if (signatureEvent) {
                    events.push(signatureEvent);
                }
            }
            events.push(this.responseBuilder.createContentBlockStopEvent(block));
            block.stopped = true;
        }
        const stopReason = this.responseBuilder.mapStopReason(accumulator.getFinishReason() || 'stop');
        events.push(...this.responseBuilder.createFinalizationEvents(accumulator, stopReason));
        accumulator.setFinalized(true);
        return events;
    }
    /**
     * Log message if verbose
     */
    log(message) {
        if (this.verbose) {
            const timestamp = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
            console.error(`[StreamParser] [${timestamp}] ${message}`);
        }
    }
}
exports.StreamParser = StreamParser;
//# sourceMappingURL=stream-parser.js.map