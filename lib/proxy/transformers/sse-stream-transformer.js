"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxySseStreamTransformer = exports.createAnthropicProxyResponse = exports.createAnthropicErrorResponse = void 0;
const delta_accumulator_1 = require("../glmt/delta-accumulator");
const glmt_transformer_1 = require("../glmt/glmt-transformer");
const sse_parser_1 = require("../glmt/sse-parser");
const JSON_TRANSLATION_ERROR_MESSAGE = 'Failed to translate OpenAI-compatible JSON response';
const STREAM_TRANSLATION_ERROR_MESSAGE = 'Failed to translate OpenAI-compatible SSE response';
function createAnthropicErrorPayload(type, message) {
    return {
        type: 'error',
        error: {
            type,
            message,
        },
    };
}
function formatErrorForLog(error) {
    if (error instanceof Error) {
        return error.message;
    }
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
function logTranslationError(context, error) {
    console.error(`[proxy-sse-transformer] ${context}: ${formatErrorForLog(error)}`);
}
function createAnthropicErrorResponse(status, type, message, headers) {
    const responseHeaders = new Headers(headers);
    responseHeaders.set('Content-Type', 'application/json');
    responseHeaders.delete('Content-Length');
    return new Response(JSON.stringify(createAnthropicErrorPayload(type, message)), {
        status,
        headers: responseHeaders,
    });
}
exports.createAnthropicErrorResponse = createAnthropicErrorResponse;
function formatSseEvent(event, data) {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
function hasTranslatableChoices(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const { choices } = value;
    if (!Array.isArray(choices) || choices.length === 0) {
        return false;
    }
    const firstChoice = choices[0];
    if (typeof firstChoice !== 'object' || firstChoice === null) {
        return false;
    }
    const message = firstChoice.message;
    return typeof message === 'object' && message !== null;
}
function isSyntheticTransformationFallback(value) {
    return (typeof value === 'object' &&
        value !== null &&
        typeof value.id === 'string' &&
        value.id.startsWith('msg_error_'));
}
async function createAnthropicErrorProxyResponse(response) {
    const headers = new Headers(response.headers);
    headers.delete('Content-Type');
    headers.delete('Content-Length');
    let type = response.status === 401
        ? 'authentication_error'
        : response.status === 429
            ? 'rate_limit_error'
            : response.status >= 400 && response.status < 500
                ? 'invalid_request_error'
                : 'api_error';
    let message = `Upstream request failed with status ${response.status}`;
    try {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
            const payload = (await response.json());
            if (typeof payload?.error?.type === 'string' && payload.error.type.trim().length > 0) {
                type = payload.error.type;
            }
            if (typeof payload?.error?.message === 'string' && payload.error.message.trim().length > 0) {
                message = payload.error.message;
            }
            else if (typeof payload?.message === 'string' && payload.message.trim().length > 0) {
                message = payload.message;
            }
        }
        else {
            const text = (await response.text()).trim();
            if (text.length > 0) {
                message = text;
            }
        }
    }
    catch (error) {
        logTranslationError('Failed to parse upstream error response', error);
    }
    return createAnthropicErrorResponse(response.status, type, message, headers);
}
async function createAnthropicJsonResponse(response) {
    try {
        const openAIResponse = await response.json();
        if (!hasTranslatableChoices(openAIResponse)) {
            return createAnthropicErrorResponse(502, 'api_error', JSON_TRANSLATION_ERROR_MESSAGE);
        }
        const anthropicResponse = new glmt_transformer_1.GlmtTransformer().transformResponse(openAIResponse);
        if (isSyntheticTransformationFallback(anthropicResponse)) {
            logTranslationError('OpenAI-compatible JSON translation produced synthetic fallback response', anthropicResponse);
            return createAnthropicErrorResponse(502, 'api_error', JSON_TRANSLATION_ERROR_MESSAGE);
        }
        return new Response(JSON.stringify(anthropicResponse), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        logTranslationError('OpenAI-compatible JSON translation failed', error);
        return createAnthropicErrorResponse(502, 'api_error', JSON_TRANSLATION_ERROR_MESSAGE);
    }
}
function createAnthropicStreamingResponse(response) {
    const body = response.body;
    if (!body) {
        return createAnthropicErrorResponse(502, 'api_error', 'Upstream stream ended before a response body was available');
    }
    const parser = new sse_parser_1.SSEParser({ throwOnMalformedJson: true });
    const transformer = new glmt_transformer_1.GlmtTransformer();
    const accumulator = new delta_accumulator_1.DeltaAccumulator({});
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            const reader = body.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    if (!value) {
                        continue;
                    }
                    const events = parser.parse(Buffer.from(value));
                    for (const event of events) {
                        const anthropicEvents = transformer.transformDelta(event, accumulator);
                        for (const anthropicEvent of anthropicEvents) {
                            controller.enqueue(encoder.encode(formatSseEvent(anthropicEvent.event, anthropicEvent.data)));
                        }
                    }
                }
                if (!accumulator.isFinalized() && accumulator.isMessageStarted()) {
                    for (const anthropicEvent of transformer.finalizeDelta(accumulator)) {
                        controller.enqueue(encoder.encode(formatSseEvent(anthropicEvent.event, anthropicEvent.data)));
                    }
                }
            }
            catch (error) {
                logTranslationError('OpenAI-compatible SSE translation failed', error);
                controller.enqueue(encoder.encode(formatSseEvent('error', createAnthropicErrorPayload('api_error', STREAM_TRANSLATION_ERROR_MESSAGE))));
            }
            finally {
                reader.releaseLock();
                controller.close();
            }
        },
    });
    return new Response(readable, {
        status: response.status,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
async function createAnthropicProxyResponse(response) {
    if (!response.ok) {
        return createAnthropicErrorProxyResponse(response);
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const isEventStream = contentType === 'text/event-stream' || contentType.startsWith('text/event-stream;');
    return isEventStream
        ? createAnthropicStreamingResponse(response)
        : createAnthropicJsonResponse(response);
}
exports.createAnthropicProxyResponse = createAnthropicProxyResponse;
class ProxySseStreamTransformer {
    async transform(response) {
        return createAnthropicProxyResponse(response);
    }
    error(status, type, message) {
        return createAnthropicErrorResponse(status, type, message);
    }
}
exports.ProxySseStreamTransformer = ProxySseStreamTransformer;
//# sourceMappingURL=sse-stream-transformer.js.map