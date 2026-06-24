/**
 * Provider registry — single source of truth for everything that talks
 * about an LLM/MCP provider in the UI.
 *
 * Two concerns live here:
 * 1. LLM provider metadata (id + display name + brand colors) — read by
 *    design/icons/ProviderIcon to paint the pixel sprite, and by
 *    ProfileList/PresetGallery to tint cards.
 * 2. MCP provider refs — the set of providerId keys that
 *    `${MCC_PROVIDER_KEY:<id>}` placeholders can reference. Read by
 *    ExternalMcpPanel's provider dropdown so we don't hardcode the list
 *    in two places.
 *
 * Brand colors are intentionally raw hex literals here, not design tokens.
 * They are *somebody else's brand*, not part of the MCC design system —
 * routing them through tokens/primitive.css would pollute the palette
 * with non-UI concerns. The right level for them is "data".
 */

export type ProviderId =
  | 'openrouter'
  | 'alibaba-coding-plan'
  | 'huggingface'
  | 'ollama'
  | 'llamacpp'
  | 'anthropic'
  | 'glm'
  | 'km'
  | 'foundry'
  | 'mm'
  | 'deepseek'
  | 'qwen'
  | 'xiaomi-mimo'
  | 'ollama-cloud'
  | 'novita'
  | 'bigmodel'
  | 'generic';

export interface ProviderMeta {
  id: ProviderId;
  displayName: string;
  /** Brand accent color (foreground / stripe). */
  accent: string;
  /** Brand tint color (soft background, halo, card stripe). */
  bg: string;
}

/**
 * Ordered so iteration / generated dropdowns surface the popular ones first.
 * Keep ProviderId union in sync if you add an entry.
 */
export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  anthropic:             { id: 'anthropic',             displayName: 'Anthropic',           accent: '#d97706', bg: '#fbeed3' },
  deepseek:              { id: 'deepseek',              displayName: 'DeepSeek',            accent: '#1e6bf1', bg: '#cfe1ff' },
  qwen:                  { id: 'qwen',                  displayName: 'Qwen',                accent: '#615ced', bg: '#dad7ff' },
  'alibaba-coding-plan': { id: 'alibaba-coding-plan',   displayName: 'Alibaba Coding Plan', accent: '#ff6a00', bg: '#ffd6b0' },
  km:                    { id: 'km',                    displayName: 'Kimi',                accent: '#0b1f3a', bg: '#bcd0ec' },
  glm:                   { id: 'glm',                   displayName: 'GLM / Z.AI',          accent: '#1b6dff', bg: '#c9dcff' },
  mm:                    { id: 'mm',                    displayName: 'MiniMax',             accent: '#e91e63', bg: '#fbc6d8' },
  'xiaomi-mimo':         { id: 'xiaomi-mimo',           displayName: 'Xiaomi MiMo',         accent: '#ff6900', bg: '#ffd2ad' },
  openrouter:            { id: 'openrouter',            displayName: 'OpenRouter',          accent: '#7a5af8', bg: '#dccff8' },
  ollama:                { id: 'ollama',                displayName: 'Ollama (local)',      accent: '#1b1b1b', bg: '#f3eee3' },
  llamacpp:              { id: 'llamacpp',              displayName: 'llama.cpp',           accent: '#10b981', bg: '#c2efdf' },
  huggingface:           { id: 'huggingface',           displayName: 'HuggingFace',         accent: '#facc15', bg: '#fde68a' },
  foundry:               { id: 'foundry',               displayName: 'Azure Foundry',       accent: '#0078d4', bg: '#c6e2f6' },
  novita:                { id: 'novita',                displayName: 'Novita',              accent: '#6366f1', bg: '#d0d3ff' },
  bigmodel:              { id: 'bigmodel',              displayName: 'BigModel / Zhipu',    accent: '#3b82f6', bg: '#bedaff' },
  'ollama-cloud':        { id: 'ollama-cloud',          displayName: 'Ollama Cloud',        accent: '#0ea5e9', bg: '#bae6fd' },
  generic:               { id: 'generic',               displayName: 'Custom Provider',     accent: 'var(--arcade-tangerine)', bg: 'var(--arcade-tangerine-soft)' },
};

export function getProvider(id: string): ProviderMeta {
  return (PROVIDERS as Record<string, ProviderMeta | undefined>)[id] ?? PROVIDERS.generic;
}

export function getProviderAccent(id: string): string {
  return getProvider(id).accent;
}

export function getProviderTint(id: string): string {
  return getProvider(id).bg;
}

/**
 * Best-effort baseUrl → providerId mapping, used to badge existing profiles
 * whose preset origin isn't recorded in storage.
 */
export function guessProviderId(baseUrl: string): ProviderId {
  const u = baseUrl.toLowerCase();
  if (!u) return 'anthropic';
  if (u.includes('openrouter')) return 'openrouter';
  if (u.includes('dashscope.aliyuncs') && u.includes('coding-intl')) return 'alibaba-coding-plan';
  if (u.includes('dashscope.aliyuncs')) return 'qwen';
  if (u.includes('huggingface')) return 'huggingface';
  if (u.includes('ollama.com')) return 'ollama-cloud';
  if (u.includes('localhost:11434') || u.includes('11434')) return 'ollama';
  if (u.includes(':8080')) return 'llamacpp';
  if (u.includes('anthropic.com') || u === '') return 'anthropic';
  if (u.includes('z.ai')) return 'glm';
  if (u.includes('kimi') || u.includes('moonshot')) return 'km';
  if (u.includes('azure')) return 'foundry';
  if (u.includes('minimaxi') || u.includes('minimax')) return 'mm';
  if (u.includes('deepseek')) return 'deepseek';
  if (u.includes('xiaomimimo') || u.includes('xiaomi')) return 'xiaomi-mimo';
  if (u.includes('novita')) return 'novita';
  if (u.includes('bigmodel')) return 'bigmodel';
  return 'generic';
}

/* ── MCP provider refs ────────────────────────────────────────────────── */

/**
 * Keys that `${MCC_PROVIDER_KEY:<id>}` placeholders may reference.
 * These map to entries in ~/.mcc/mcp-config.json's websearch.providers
 * and imageAnalysis.providers sections.
 *
 * If you add a new MCP-eligible provider, add it here AND in the backend
 * config catalog (src/shared/provider-preset-catalog.ts).
 */
export interface McpProviderRef {
  value: string;
  label: string;
}

export const MCP_PROVIDER_REFS: McpProviderRef[] = [
  { value: 'minimax',  label: 'MiniMax' },
  { value: 'ali',      label: 'Ali (DashScope)' },
  { value: 'kimi',     label: 'Kimi' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'xiaomi',   label: 'Xiaomi MiMo' },
  { value: 'bocha',    label: '博查 Bocha' },
];
