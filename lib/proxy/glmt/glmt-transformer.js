"use strict";
/**
 * GlmtTransformer - Orchestrator for Anthropic ↔ OpenAI format transformation
 *
 * Pipeline Architecture:
 * - RequestTransformer: Anthropic → OpenAI request conversion
 * - StreamParser: Delta processing for streaming responses
 * - ResponseBuilder: SSE event generation
 * - ToolCallHandler: Tool call processing
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
exports.GlmtTransformer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logging_1 = require("../services/logging");
const pipeline_1 = require("./pipeline");
const config_loader_facade_1 = require("../config/config-loader-facade");
class GlmtTransformer {
    constructor(config = {}) {
        this.logger = (0, logging_1.createLogger)('glmt:transformer');
        this.verbose = config.verbose || false;
        const debugEnabled = process.env.CCS_DEBUG === '1';
        this.debugLog = config.debugLog ?? debugEnabled;
        this.debugLogDir = config.debugLogDir || path.join((0, config_loader_facade_1.getCcsDir)(), 'logs');
        // Initialize pipeline components
        this.requestTransformer = new pipeline_1.RequestTransformer({
            defaultThinking: config.defaultThinking ?? true,
            verbose: this.verbose,
            explicitReasoning: config.explicitReasoning ?? true,
            log: (msg) => this.log(msg),
        });
        this.responseBuilder = new pipeline_1.ResponseBuilder(this.verbose);
        this.toolCallHandler = new pipeline_1.ToolCallHandler();
        this.contentTransformer = new pipeline_1.ContentTransformer(config.defaultThinking ?? true);
        this.streamParser = new pipeline_1.StreamParser({
            verbose: this.verbose,
            debugMode: config.debugMode ?? debugEnabled,
            debugLog: this.debugLog,
            writeDebugLog: (type, data) => this.writeDebugLog(type, data),
        });
    }
    /** Transform Anthropic request to OpenAI format */
    transformRequest(anthropicRequest) {
        this.writeDebugLog('request-anthropic', anthropicRequest);
        const result = this.requestTransformer.transform(anthropicRequest);
        this.writeDebugLog('request-openai', result.openaiRequest);
        return result;
    }
    /** Transform OpenAI response to Anthropic format */
    transformResponse(openaiResponse, _thinkingConfig = { thinking: false, effort: 'medium' }) {
        this.writeDebugLog('response-openai', openaiResponse);
        try {
            const choice = openaiResponse.choices?.[0];
            if (!choice)
                throw new Error('No choices in OpenAI response');
            const message = choice.message;
            const content = [];
            if (message.reasoning_content) {
                this.log(`Detected reasoning_content: ${message.reasoning_content.length} chars`);
                content.push({
                    type: 'thinking',
                    thinking: message.reasoning_content,
                    signature: this.responseBuilder.generateThinkingSignature(message.reasoning_content),
                });
            }
            if (message.content) {
                content.push({ type: 'text', text: message.content });
            }
            if (message.tool_calls?.length) {
                content.push(...this.toolCallHandler.processToolCalls(message.tool_calls));
            }
            const anthropicResponse = {
                id: openaiResponse.id || 'msg_' + Date.now(),
                type: 'message',
                role: 'assistant',
                content,
                model: openaiResponse.model || 'glm-5',
                stop_reason: this.responseBuilder.mapStopReason(choice.finish_reason || 'stop'),
                usage: {
                    input_tokens: openaiResponse.usage?.prompt_tokens || 0,
                    output_tokens: openaiResponse.usage?.completion_tokens || 0,
                },
            };
            this.writeDebugLog('response-anthropic', anthropicResponse);
            return anthropicResponse;
        }
        catch (error) {
            const err = error;
            this.logger.stage('cleanup', 'response.transform_failed', 'GLMT response transformation failed', undefined, { level: 'error', error: { name: err.name, message: err.message } });
            console.error('[glmt-transformer] Response transformation error:', err);
            return {
                id: 'msg_error_' + Date.now(),
                type: 'message',
                role: 'assistant',
                content: [{ type: 'text', text: '[Transformation Error] ' + err.message }],
                model: 'glm-5',
                stop_reason: 'end_turn',
                usage: { input_tokens: 0, output_tokens: 0 },
            };
        }
    }
    /** Transform streaming delta (delegates to StreamParser) */
    transformDelta(openaiEvent, accumulator) {
        return this.streamParser.transformDelta(openaiEvent, accumulator);
    }
    /** Finalize streaming (delegates to StreamParser) */
    finalizeDelta(accumulator) {
        return this.streamParser.finalizeDelta(accumulator);
    }
    redactSensitiveData(data) {
        if (data === null || data === undefined)
            return data;
        if (typeof data !== 'object')
            return data;
        if (Array.isArray(data))
            return data.map((item) => this.redactSensitiveData(item));
        const SENSITIVE_KEYS = /^(authorization|auth[_-]?token|api[_-]?key|apikey|token|secret|password|credential|x-api-key|anthropic-api-key|cookie)$/i;
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            if (SENSITIVE_KEYS.test(key)) {
                result[key] = '[REDACTED]';
            }
            else {
                result[key] = this.redactSensitiveData(value);
            }
        }
        return result;
    }
    writeDebugLog(type, data) {
        if (!this.debugLog)
            return;
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
            const filepath = path.join(this.debugLogDir, `${timestamp}-${type}.json`);
            fs.mkdirSync(this.debugLogDir, { recursive: true });
            const redacted = this.redactSensitiveData(data);
            fs.writeFileSync(filepath, JSON.stringify(redacted, null, 2) + '\n', 'utf8');
        }
        catch (error) {
            this.logger.warn('debug-log.write_failed', 'GLMT debug log write failed', {
                message: error.message,
            });
            console.error(`[glmt-transformer] Debug log error: ${error.message}`);
        }
    }
    log(message) {
        if (this.verbose) {
            this.logger.debug('transformer.verbose', message);
            console.error(`[glmt-transformer] [${new Date().toTimeString().split(' ')[0]}] ${message}`);
        }
    }
    // ========== Backwards-compatible public methods ==========
    /** Generate thinking signature (delegates to ResponseBuilder) */
    generateThinkingSignature(thinking) {
        return this.responseBuilder.generateThinkingSignature(thinking);
    }
    /** Map stop reason (delegates to ResponseBuilder) */
    mapStopReason(openaiReason) {
        return this.responseBuilder.mapStopReason(openaiReason);
    }
    /** Detect think keywords (delegates to ContentTransformer) */
    detectThinkKeywords(messages) {
        return this.contentTransformer.detectThinkKeywords(messages);
    }
    /** Validate transformation result */
    validateTransformation(anthropicResponse) {
        const checks = {
            hasContent: Boolean(anthropicResponse.content && anthropicResponse.content.length > 0),
            hasThinking: anthropicResponse.content?.some((block) => block.type === 'thinking') || false,
            hasText: anthropicResponse.content?.some((block) => block.type === 'text') || false,
            validStructure: anthropicResponse.type === 'message' && anthropicResponse.role === 'assistant',
            hasUsage: Boolean(anthropicResponse.usage),
        };
        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        return { checks, passed, total, valid: passed === total };
    }
}
exports.GlmtTransformer = GlmtTransformer;
exports.default = GlmtTransformer;
//# sourceMappingURL=glmt-transformer.js.map