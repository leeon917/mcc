#!/usr/bin/env node
"use strict";
/**
 * LocaleEnforcer - Force English output from GLM models
 *
 * Purpose: GLM models default to Chinese when prompts are ambiguous or contain Chinese context.
 * This module always injects "MUST respond in English" instruction into system prompt or first user message.
 *
 * Usage:
 *   const enforcer = new LocaleEnforcer();
 *   const modifiedMessages = enforcer.injectInstruction(messages);
 *
 * Strategy:
 *   1. If system prompt exists: Prepend instruction
 *   2. If no system prompt: Prepend to first user message
 *   3. Preserve message structure (string vs array content)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocaleEnforcer = void 0;
class LocaleEnforcer {
    constructor(options = {}) {
        this.instruction =
            options.instruction ||
                'CRITICAL: You MUST respond in English only, regardless of the input language or context. This is a strict requirement.';
    }
    /**
     * Inject English instruction into messages
     * @param messages - Messages array to modify
     * @returns Modified messages array
     */
    injectInstruction(messages) {
        // Clone messages to avoid mutation
        const modifiedMessages = JSON.parse(JSON.stringify(messages));
        // Strategy 1: Inject into system prompt (preferred)
        const systemIndex = modifiedMessages.findIndex((m) => m.role === 'system');
        if (systemIndex >= 0) {
            const systemMsg = modifiedMessages[systemIndex];
            if (typeof systemMsg.content === 'string') {
                systemMsg.content = `${this.instruction}\n\n${systemMsg.content}`;
            }
            else if (Array.isArray(systemMsg.content)) {
                systemMsg.content.unshift({
                    type: 'text',
                    text: this.instruction,
                });
            }
            return modifiedMessages;
        }
        // Strategy 2: Prepend to first user message
        const userIndex = modifiedMessages.findIndex((m) => m.role === 'user');
        if (userIndex >= 0) {
            const userMsg = modifiedMessages[userIndex];
            if (typeof userMsg.content === 'string') {
                userMsg.content = `${this.instruction}\n\n${userMsg.content}`;
            }
            else if (Array.isArray(userMsg.content)) {
                userMsg.content.unshift({
                    type: 'text',
                    text: this.instruction,
                });
            }
            return modifiedMessages;
        }
        // No system or user messages found (edge case)
        return modifiedMessages;
    }
}
exports.LocaleEnforcer = LocaleEnforcer;
//# sourceMappingURL=locale-enforcer.js.map