"use strict";
/**
 * ContentTransformer - Handle message sanitization and content transformations
 *
 * Responsibilities:
 * - Sanitize messages for OpenAI API compatibility
 * - Extract thinking control tags from messages
 * - Detect think keywords in user prompts
 * - Transform tools between Anthropic and OpenAI formats
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentTransformer = void 0;
class ContentTransformer {
    constructor(defaultThinking = true) {
        this.defaultThinking = defaultThinking;
    }
    /**
     * Sanitize messages for OpenAI API compatibility
     */
    sanitizeMessages(messages) {
        const result = [];
        for (const msg of messages) {
            // If content is a string, add as-is
            if (typeof msg.content === 'string') {
                result.push(msg);
                continue;
            }
            // If content is an array, process blocks
            if (Array.isArray(msg.content)) {
                // Separate tool_result blocks from other content
                const toolResults = msg.content.filter((block) => block.type === 'tool_result');
                const textBlocks = msg.content.filter((block) => block.type === 'text');
                // CRITICAL: Tool messages must come BEFORE user text in OpenAI API
                for (const toolResult of toolResults) {
                    result.push({
                        role: 'tool',
                        content: typeof toolResult.content === 'string'
                            ? toolResult.content
                            : JSON.stringify(toolResult.content),
                    });
                }
                // Add text content as user/assistant message AFTER tool messages
                if (textBlocks.length > 0) {
                    const textContent = textBlocks.length === 1
                        ? textBlocks[0].text || ''
                        : textBlocks.map((b) => b.text || '').join('\n');
                    result.push({
                        role: msg.role,
                        content: textContent,
                    });
                }
                // If no content at all, add empty message
                if (textBlocks.length === 0 && toolResults.length === 0) {
                    result.push({
                        role: msg.role,
                        content: '',
                    });
                }
                continue;
            }
            // Fallback: return message as-is
            result.push(msg);
        }
        return result;
    }
    /**
     * Transform Anthropic tools to OpenAI tools format
     */
    transformTools(anthropicTools) {
        return anthropicTools.map((tool) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema || {},
            },
        }));
    }
    /**
     * Check if messages contain thinking control tags
     */
    hasThinkingTags(messages) {
        for (const msg of messages) {
            if (msg.role !== 'user')
                continue;
            const content = msg.content;
            if (typeof content !== 'string')
                continue;
            // Check for control tags
            if (/<Thinking:(On|Off)>/i.test(content) || /<Effort:(Low|Medium|High)>/i.test(content)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Extract thinking control tags from user messages
     */
    extractThinkingControl(messages) {
        const config = {
            thinking: this.defaultThinking,
            effort: 'medium',
        };
        // Scan user messages for control tags
        for (const msg of messages) {
            if (msg.role !== 'user')
                continue;
            const content = msg.content;
            if (typeof content !== 'string')
                continue;
            // Check for <Thinking:On|Off>
            const thinkingMatch = content.match(/<Thinking:(On|Off)>/i);
            if (thinkingMatch) {
                config.thinking = thinkingMatch[1].toLowerCase() === 'on';
            }
            // Check for <Effort:Low|Medium|High>
            const effortMatch = content.match(/<Effort:(Low|Medium|High)>/i);
            if (effortMatch) {
                config.effort = effortMatch[1].toLowerCase();
            }
        }
        return config;
    }
    /**
     * Detect Anthropic-style "think" keywords in user prompts
     */
    detectThinkKeywords(messages) {
        if (!messages || messages.length === 0)
            return null;
        // Extract text from user messages
        const text = messages
            .filter((m) => m.role === 'user')
            .map((m) => {
            if (typeof m.content === 'string')
                return m.content;
            if (Array.isArray(m.content)) {
                return m.content
                    .filter((block) => block.type === 'text')
                    .map((block) => block.text || '')
                    .join(' ');
            }
            return '';
        })
            .join(' ');
        // Priority: ultrathink > think harder > think hard > think
        if (/\bultrathink\b/i.test(text)) {
            return { thinking: true, effort: 'max', keyword: 'ultrathink' };
        }
        if (/\bthink\s+harder\b/i.test(text)) {
            return { thinking: true, effort: 'high', keyword: 'think harder' };
        }
        if (/\bthink\s+hard\b/i.test(text)) {
            return { thinking: true, effort: 'medium', keyword: 'think hard' };
        }
        if (/\bthink\b/i.test(text)) {
            return { thinking: true, effort: 'low', keyword: 'think' };
        }
        return null; // No keywords detected
    }
}
exports.ContentTransformer = ContentTransformer;
//# sourceMappingURL=content-transformer.js.map