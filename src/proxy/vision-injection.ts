/**
 * Vision Injection — lets a text-only upstream model "see" pasted images.
 *
 * Claude Code sends a clipboard-pasted image as an Anthropic `image` content
 * block inline in the /v1/messages request. A text-only upstream (e.g. glm-5.2)
 * can't use it — the block reaches the model and is ignored or 400s. This module
 * intercepts those blocks BEFORE translation: it ships each image to the
 * configured vision provider (mcp-config.json → imageAnalysis), gets back a text
 * description, and swaps the image block for a text block. The upstream model
 * then receives pure text and "sees" the image through that description.
 *
 * Why here and not the `mcc-image-analysis` MCP tool: that tool only fires on a
 * file path passed via a tool call. A clipboard paste never touches a tool, so
 * the local proxy is the only point on the request path that can intercept it.
 *
 * Scope: base64 `image` blocks only. `document` (PDF) and `url` images are left
 * untouched — a focused, correct first cut (see docs/decisions.md).
 */

import * as crypto from 'crypto';
import { log, isDebugEnabled } from '../shared/logger';
import {
  readMcpConfig,
  getEnabledImageAnalysisProviders,
  type ImageAnalysisProvider,
} from '../mcp/mcp-config';

const VISION_TIMEOUT_MS = 60_000;
const MAX_TOKENS = 4096;

// Description cache keyed by content hash. Claude Code resends the full
// conversation history every turn, so a once-pasted image reappears in every
// subsequent request — without caching we'd re-bill the vision provider each
// turn. Capped to bound memory on a long-lived proxy daemon.
const CACHE_MAX = 200;
const descriptionCache = new Map<string, string>();

// Screenshot-oriented prompt: pasted images in a coding session are almost
// always UI captures, error dialogs, or diagrams. Mirrors the screenshot
// template in lib/mcp-hooks/image-analysis-runtime.cjs.
const DESCRIBE_PROMPT = `Analyze this image in detail for a developer who cannot see it.

Focus on:
1. Application/website/UI type and overall state
2. All visible UI elements (buttons, inputs, menus, modals, layout)
3. All text content — transcribe exactly, including labels and values
4. Error messages, stack traces, or console output — quote verbatim
5. Layout, spacing, alignment, and visual hierarchy (note misalignment/overflow if present)
6. Colors, styling, and any notable visual defects
7. Any code snippets shown — transcribe them

Be precise and comprehensive — this description fully replaces visual access for the assistant reading it.`;

interface ContentBlock {
  type?: string;
  source?: { type?: string; media_type?: string; data?: string; url?: string };
  [k: string]: unknown;
}

interface Message {
  role?: string;
  content?: unknown;
}

function cacheGet(key: string): string | undefined {
  return descriptionCache.get(key);
}

function cacheSet(key: string, value: string): void {
  if (descriptionCache.size >= CACHE_MAX) {
    // Evict oldest (insertion-order) entry.
    const oldest = descriptionCache.keys().next().value;
    if (oldest !== undefined) descriptionCache.delete(oldest);
  }
  descriptionCache.set(key, value);
}

/**
 * Quick check — does this request carry any base64 image block? Used to keep the
 * common text-only path zero-overhead (no config read, no scan mutation).
 */
export function hasImageBlocks(rawBody: Record<string, unknown>): boolean {
  const messages = rawBody.messages;
  if (!Array.isArray(messages)) return false;
  for (const msg of messages as Message[]) {
    if (!msg || !Array.isArray(msg.content)) continue;
    for (const block of msg.content as ContentBlock[]) {
      if (block && block.type === 'image' && block.source?.type === 'base64' && block.source.data) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Replace every base64 image block in the request with a text block carrying a
 * vision-model description. Mutates `rawBody` in place. Returns the number of
 * blocks replaced. Degrades gracefully: a per-image failure becomes a short
 * placeholder text rather than aborting the request.
 */
export async function injectVision(rawBody: Record<string, unknown>): Promise<{ injected: number }> {
  const providers = getEnabledImageAnalysisProviders(readMcpConfig());
  if (providers.length === 0) {
    log.warn('VISION', 'image block present but no vision provider enabled — leaving image as-is (upstream may ignore it)');
    return { injected: 0 };
  }

  const messages = rawBody.messages as Message[];
  let injected = 0;

  for (const msg of messages) {
    if (!msg || !Array.isArray(msg.content)) continue;
    const content = msg.content as ContentBlock[];
    for (let i = 0; i < content.length; i++) {
      const block = content[i];
      if (!block || block.type !== 'image' || block.source?.type !== 'base64' || !block.source.data) {
        continue;
      }
      const mediaType = block.source.media_type || 'image/png';
      const data = block.source.data;
      const text = await describeImage(mediaType, data, providers);
      content[i] = { type: 'text', text };
      injected++;
    }
  }

  return { injected };
}

async function describeImage(
  mediaType: string,
  data: string,
  providers: Array<ImageAnalysisProvider & { id: string }>,
): Promise<string> {
  const key = crypto.createHash('sha256').update(data).digest('hex');
  const cached = cacheGet(key);
  if (cached) {
    log.debug('VISION', `cache hit ${key.slice(0, 12)} (${(cached.length / 1024).toFixed(1)}KB desc)`);
    return `[Pasted image — visual analysis]\n${cached}`;
  }

  let lastError: Error | null = null;
  for (const [index, provider] of providers.entries()) {
    try {
      log.debug('VISION', `describing via ${provider.id} (${provider.model}) [${index + 1}/${providers.length}] size=${Math.round((data.length * 3) / 4 / 1024)}KB`);
      const desc = await callVisionProvider(provider, mediaType, data);
      cacheSet(key, desc);
      log.info('VISION', `image described via ${provider.id}/${provider.model} (${desc.length} chars)`);
      return `[Pasted image — visual analysis]\n${desc}`;
    } catch (err) {
      lastError = err as Error;
      const more = index < providers.length - 1;
      log.warn('VISION', `provider ${provider.id} failed: ${(err as Error).message}${more ? ' — trying next' : ''}`);
    }
  }

  // All providers failed — degrade to a placeholder so the request still flows.
  return `[Pasted image could not be analyzed: ${lastError?.message ?? 'no vision provider succeeded'}. The image content is unavailable; ask the user to describe it if needed.]`;
}

function buildVisionBody(provider: ImageAnalysisProvider, mediaType: string, data: string): string {
  if (provider.format === 'openai') {
    return JSON.stringify({
      model: provider.model,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: DESCRIBE_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${data}` } },
          ],
        },
      ],
    });
  }
  // anthropic format
  return JSON.stringify({
    model: provider.model,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: DESCRIBE_PROMPT },
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
        ],
      },
    ],
  });
}

function parseVisionResponse(provider: ImageAnalysisProvider, text: string): string {
  const json = JSON.parse(text);
  if (provider.format === 'openai') {
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const joined = content
        .filter((b: { type?: string; text?: string }) => b?.type === 'text' && typeof b.text === 'string')
        .map((b: { text: string }) => b.text)
        .join('\n\n')
        .trim();
      if (joined) return joined;
    }
    throw new Error('no text content in OpenAI vision response');
  }
  // anthropic format
  const blocks = json?.content;
  if (Array.isArray(blocks)) {
    const joined = blocks
      .filter((b: { type?: string; text?: string }) => b?.type === 'text' && typeof b.text === 'string')
      .map((b: { text: string }) => b.text)
      .join('\n\n')
      .trim();
    if (joined) return joined;
  }
  throw new Error('no text content in Anthropic vision response');
}

async function callVisionProvider(
  provider: ImageAnalysisProvider,
  mediaType: string,
  data: string,
): Promise<string> {
  const base = provider.baseUrl.replace(/\/+$/, '');
  const endpoint = provider.format === 'openai' ? `${base}/chat/completions` : `${base}/v1/messages`;
  const body = buildVisionBody(provider, mediaType, data);

  if (isDebugEnabled()) {
    log.debug('VISION', `POST ${endpoint} model=${provider.model} format=${provider.format}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
        'x-api-key': provider.apiKey,
      },
      body,
      signal: controller.signal,
    });

    const responseText = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error(`auth error (HTTP ${res.status})`);
    }
    if (res.status === 429) {
      throw new Error('rate limited (HTTP 429)');
    }
    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}: ${responseText.slice(0, 200)}`);
    }
    return parseVisionResponse(provider, responseText);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`timeout after ${VISION_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
