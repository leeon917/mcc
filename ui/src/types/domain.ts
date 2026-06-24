/**
 * Domain types — single source of truth for business concepts.
 *
 * API request/response shapes stay in lib/api.ts (boundary layer).
 * Things that get passed around between components/hooks live here.
 *
 * Rule of thumb: if more than one component or hook needs the type,
 * it belongs in this file.
 */

/**
 * Wire protocol a profile uses to talk to its upstream LLM endpoint.
 * - 'anthropic' → direct Anthropic-compatible /v1/messages
 * - 'openai'    → goes through local translator proxy
 */
export type Protocol = 'anthropic' | 'openai';

/** Thinking / reasoning intensity. 'off' disables; undefined defaults to 'high'. */
export type ReasoningEffort = 'off' | 'low' | 'medium' | 'high' | 'max';

/**
 * Payload emitted by ProfileForm on submit. Mirrors the wire shape of
 * `POST /api/profiles` minus server-managed fields (createdAt etc).
 *
 * `apiKey` is optional because edit-mode allows leaving it blank to
 * keep the existing key.
 */
export interface ProfileFormPayload {
  name: string;
  displayName?: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  protocol: Protocol;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
  reasoningEffort?: ReasoningEffort;
}

/**
 * Args used to install a preset from the Templates gallery.
 * apiKey is required here (PresetGallery handles the local-only case
 * by stuffing the placeholder value in before calling).
 */
export interface PresetInstallArgs {
  name: string;
  displayName?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  protocol: Protocol;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
}

/**
 * The three tabs of the Dashboard top-level nav.
 */
export type DashboardTab = 'templates' | 'profiles' | 'mcp';

/**
 * Which MCP section is being toggled (used by the unified handler in App).
 */
export type McpSection = 'websearch' | 'imageAnalysis';
