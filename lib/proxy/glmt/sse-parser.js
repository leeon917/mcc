#!/usr/bin/env node
"use strict";
/**
 * SSEParser - Parse Server-Sent Events (SSE) stream
 *
 * Handles:
 * - Incomplete events across chunks
 * - Multiple events in single chunk
 * - Malformed data (skip gracefully)
 * - [DONE] marker
 *
 * Usage:
 *   const parser = new SSEParser();
 *   stream.on('data', chunk => {
 *     const events = parser.parse(chunk);
 *     events.forEach(event => { ... });
 *   });
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSEParser = void 0;
class SSEParser {
    constructor(options = {}) {
        this.buffer = '';
        this.eventCount = 0;
        this.maxBufferSize = options.maxBufferSize || 1024 * 1024; // 1MB default
        this.throwOnMalformedJson = options.throwOnMalformedJson === true;
    }
    /**
     * Parse chunk and extract SSE events
     * @param chunk - Data chunk from stream
     * @returns Array of parsed events
     */
    parse(chunk) {
        this.buffer += chunk.toString().replace(/\r\n?/g, '\n');
        // C-01 Fix: Prevent unbounded buffer growth (DoS protection)
        if (this.buffer.length > this.maxBufferSize) {
            throw new Error(`SSE buffer exceeded ${this.maxBufferSize} bytes (DoS protection)`);
        }
        const events = [];
        const segments = this.buffer.split('\n\n');
        this.buffer = segments.pop() || '';
        for (const segment of segments) {
            const lines = segment.split('\n');
            const currentEvent = { event: 'message', data: '' };
            const dataLines = [];
            for (const rawLine of lines) {
                const line = rawLine.trimEnd();
                if (!line || line.startsWith(':')) {
                    continue;
                }
                if (line.startsWith('event: ')) {
                    currentEvent.event = line.substring(7).trim();
                    continue;
                }
                if (line.startsWith('data:')) {
                    dataLines.push(line.substring(5).trimStart());
                    continue;
                }
                if (line.startsWith('id: ')) {
                    currentEvent.id = line.substring(4).trim();
                    continue;
                }
                if (line.startsWith('retry: ')) {
                    currentEvent.retry = parseInt(line.substring(7), 10);
                }
            }
            const data = dataLines.join('\n');
            if (!data) {
                continue;
            }
            if (data === '[DONE]') {
                this.eventCount++;
                events.push({ event: 'done', data: null, index: this.eventCount });
                continue;
            }
            try {
                currentEvent.data = JSON.parse(data);
                this.eventCount++;
                currentEvent.index = this.eventCount;
                events.push({ ...currentEvent });
            }
            catch (e) {
                if (typeof console !== 'undefined' && console.error) {
                    console.error('[SSEParser] Malformed JSON event:', e.message, 'Data:', data.substring(0, 100));
                }
                if (this.throwOnMalformedJson) {
                    throw new Error(`Malformed SSE JSON event: ${e.message}`);
                }
            }
        }
        return events;
    }
    /**
     * Reset parser state (for reuse)
     */
    reset() {
        this.buffer = '';
        this.eventCount = 0;
    }
}
exports.SSEParser = SSEParser;
//# sourceMappingURL=sse-parser.js.map