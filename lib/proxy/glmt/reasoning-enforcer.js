"use strict";
/**
 * ReasoningEnforcer - Inject explicit reasoning instructions into prompts
 *
 * Purpose: Force GLM models to use structured reasoning output format (<reasoning_content>)
 * This complements API parameters (reasoning: true) with explicit prompt instructions.
 *
 * Strategy:
 *   1. If system prompt exists: Prepend reasoning instruction
 *   2. If no system prompt: Prepend to first user message
 *   3. Select prompt template based on effort level (low/medium/high/max)
 *   4. Preserve message structure (string vs array content)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReasoningEnforcer = void 0;
class ReasoningEnforcer {
    constructor(options = {}) {
        this.enabled = options.enabled ?? false; // Opt-in by default
        this.prompts = options.prompts || this.getDefaultPrompts();
    }
    /**
     * Inject reasoning instruction into messages
     * @param messages - Messages array to modify
     * @param thinkingConfig - { thinking: boolean, effort: string }
     * @returns Modified messages array
     */
    injectInstruction(messages, thinkingConfig = {}) {
        // Only inject if enabled or thinking explicitly requested
        if (!this.enabled && !thinkingConfig.thinking) {
            return messages;
        }
        // Clone messages to avoid mutation
        const modifiedMessages = JSON.parse(JSON.stringify(messages));
        // Select prompt based on effort level
        const effort = (thinkingConfig.effort?.toLowerCase() || 'medium');
        const prompt = this.selectPrompt(effort);
        // Strategy 1: Inject into system prompt (preferred)
        const systemIndex = modifiedMessages.findIndex((m) => m.role === 'system');
        if (systemIndex >= 0) {
            const systemMsg = modifiedMessages[systemIndex];
            if (typeof systemMsg.content === 'string') {
                systemMsg.content = `${prompt}\n\n${systemMsg.content}`;
            }
            else if (Array.isArray(systemMsg.content)) {
                systemMsg.content.unshift({
                    type: 'text',
                    text: prompt,
                });
            }
            return modifiedMessages;
        }
        // Strategy 2: Prepend to first user message
        const userIndex = modifiedMessages.findIndex((m) => m.role === 'user');
        if (userIndex >= 0) {
            const userMsg = modifiedMessages[userIndex];
            if (typeof userMsg.content === 'string') {
                userMsg.content = `${prompt}\n\n${userMsg.content}`;
            }
            else if (Array.isArray(userMsg.content)) {
                userMsg.content.unshift({
                    type: 'text',
                    text: prompt,
                });
            }
            return modifiedMessages;
        }
        // No system or user messages found (edge case)
        return modifiedMessages;
    }
    /**
     * Select prompt template based on effort level
     */
    selectPrompt(effort) {
        return this.prompts[effort] || this.prompts.medium;
    }
    /**
     * Get default prompt templates
     */
    getDefaultPrompts() {
        return {
            low: `You are an expert reasoning model using GLM-4.6 architecture.

CRITICAL: Before answering, write 2-3 sentences of reasoning in <reasoning_content> tags.

OUTPUT FORMAT:
<reasoning_content>
(Brief analysis: what is the problem? what's the approach?)
</reasoning_content>

(Write your final answer here)`,
            medium: `You are an expert reasoning model using GLM-4.6 architecture.

CRITICAL REQUIREMENTS:
1. Always think step-by-step before answering
2. Write your reasoning process explicitly in <reasoning_content> tags
3. Never skip your chain of thought, even for simple problems

OUTPUT FORMAT:
<reasoning_content>
(Write your detailed thinking here: analyze the problem, explore approaches,
evaluate trade-offs, and arrive at a conclusion)
</reasoning_content>

(Write your final answer here based on your reasoning above)`,
            high: `You are an expert reasoning model using GLM-4.6 architecture.

CRITICAL REQUIREMENTS:
1. Think deeply and systematically before answering
2. Write comprehensive reasoning in <reasoning_content> tags
3. Explore multiple approaches and evaluate trade-offs
4. Show all steps in your problem-solving process

OUTPUT FORMAT:
<reasoning_content>
(Write exhaustive analysis here:
 - Problem decomposition
 - Multiple approach exploration
 - Trade-off analysis for each approach
 - Edge case consideration
 - Final conclusion with justification)
</reasoning_content>

(Write your final answer here based on your systematic reasoning above)`,
            max: `You are an expert reasoning model using GLM-4.6 architecture.

CRITICAL REQUIREMENTS:
1. Think exhaustively from first principles
2. Write extremely detailed reasoning in <reasoning_content> tags
3. Analyze ALL possible angles, approaches, and edge cases
4. Challenge your own assumptions and explore alternatives
5. Provide rigorous justification for every claim

OUTPUT FORMAT:
<reasoning_content>
(Write comprehensive analysis here:
 - First principles breakdown
 - Exhaustive approach enumeration
 - Comparative analysis of all approaches
 - Edge case and failure mode analysis
 - Assumption validation
 - Counter-argument consideration
 - Final conclusion with rigorous justification)
</reasoning_content>

(Write your final answer here based on your exhaustive reasoning above)`,
        };
    }
}
exports.ReasoningEnforcer = ReasoningEnforcer;
exports.default = ReasoningEnforcer;
//# sourceMappingURL=reasoning-enforcer.js.map