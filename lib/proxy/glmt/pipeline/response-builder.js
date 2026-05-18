"use strict";
/**
 * ResponseBuilder - Create SSE events for Anthropic streaming format
 *
 * Responsibilities:
 * - Create message_start, message_delta, message_stop events
 * - Create content_block_start, content_block_delta, content_block_stop events
 * - Generate thinking signatures
 * - Map stop reasons between formats
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseBuilder = void 0;
const crypto = __importStar(require("crypto"));
class ResponseBuilder {
    constructor(verbose = false) {
        this.verbose = verbose;
    }
    /**
     * Create message_start event
     */
    createMessageStartEvent(accumulator) {
        return {
            event: 'message_start',
            data: {
                type: 'message_start',
                message: {
                    id: accumulator.getMessageId(),
                    type: 'message',
                    role: accumulator.getRole(),
                    content: [],
                    model: accumulator.getModel() || 'glm-5',
                    stop_reason: null,
                    usage: {
                        input_tokens: accumulator.getInputTokens(),
                        output_tokens: 0,
                    },
                },
            },
        };
    }
    /**
     * Create content_block_start event
     */
    createContentBlockStartEvent(block) {
        return {
            event: 'content_block_start',
            data: {
                type: 'content_block_start',
                index: block.index,
                content_block: {
                    type: block.type,
                    [block.type]: '',
                },
            },
        };
    }
    /**
     * Create thinking_delta event
     */
    createThinkingDeltaEvent(block, delta) {
        return {
            event: 'content_block_delta',
            data: {
                type: 'content_block_delta',
                index: block.index,
                delta: {
                    type: 'thinking_delta',
                    thinking: delta,
                },
            },
        };
    }
    /**
     * Create text_delta event
     */
    createTextDeltaEvent(block, delta) {
        return {
            event: 'content_block_delta',
            data: {
                type: 'content_block_delta',
                index: block.index,
                delta: {
                    type: 'text_delta',
                    text: delta,
                },
            },
        };
    }
    /**
     * Create thinking signature delta event
     */
    createSignatureDeltaEvent(block) {
        // FIX: Guard against empty content (signature timing race)
        if (!block.content || block.content.length === 0) {
            if (this.verbose) {
                console.error(`[ResponseBuilder] WARNING: Skipping signature for empty thinking block ${block.index}`);
                console.error(`This indicates a race condition - signature requested before content accumulated`);
            }
            return null;
        }
        const signature = this.generateThinkingSignature(block.content);
        if (this.verbose) {
            console.error(`[ResponseBuilder] Generating signature for block ${block.index}: ${block.content.length} chars`);
        }
        return {
            event: 'content_block_delta',
            data: {
                type: 'content_block_delta',
                index: block.index,
                delta: {
                    type: 'thinking_signature_delta',
                    signature: signature,
                },
            },
        };
    }
    /**
     * Create content_block_stop event
     */
    createContentBlockStopEvent(block) {
        return {
            event: 'content_block_stop',
            data: {
                type: 'content_block_stop',
                index: block.index,
            },
        };
    }
    /**
     * Generate finalization events (message_delta + message_stop)
     */
    createFinalizationEvents(accumulator, stopReason) {
        return [
            {
                event: 'message_delta',
                data: {
                    type: 'message_delta',
                    delta: {
                        stop_reason: stopReason,
                    },
                    usage: {
                        input_tokens: accumulator.getInputTokens(),
                        output_tokens: accumulator.getOutputTokens(),
                    },
                },
            },
            {
                event: 'message_stop',
                data: {
                    type: 'message_stop',
                },
            },
        ];
    }
    /**
     * Generate thinking signature for Claude Code UI
     */
    generateThinkingSignature(thinking) {
        // Generate signature hash
        const hash = crypto.createHash('sha256').update(thinking).digest('hex').substring(0, 16);
        return {
            type: 'thinking_signature',
            hash: hash,
            length: thinking.length,
            timestamp: Date.now(),
        };
    }
    /**
     * Map OpenAI stop reason to Anthropic stop reason
     */
    mapStopReason(openaiReason) {
        const mapping = {
            stop: 'end_turn',
            length: 'max_tokens',
            tool_calls: 'tool_use',
            content_filter: 'stop_sequence',
        };
        return mapping[openaiReason] || 'end_turn';
    }
}
exports.ResponseBuilder = ResponseBuilder;
//# sourceMappingURL=response-builder.js.map