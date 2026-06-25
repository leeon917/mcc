/**
 * Proxy Server - Simplified translation proxy for MCC
 *
 * Accepts Anthropic /v1/messages requests, translates to OpenAI chat/completions,
 * forwards to upstream provider, translates response back.
 *
 * Ported from CCS proxy/server/proxy-server.js + messages-route.js + http-helpers.js
 * Simplified: single-profile, no multi-profile routing, no CCS logging, native fetch.
 */

import * as http from 'http';
import * as stream from 'stream';
import { createRequire } from 'module';
import * as path from 'path';
import { resolveOpenAIChatCompletionsUrl } from './upstream-url';
import { PROXY_SERVICE_NAME } from './proxy-paths';
import { hasImageBlocks, injectVision } from './vision-injection';
import { log, isDebugEnabled } from '../shared/logger';

// Load compiled JS modules from CCS (copied to lib/proxy/)
const libProxyDir = path.resolve(__dirname, '..', '..', 'lib', 'proxy');
const requireFromLib = createRequire(path.join(libProxyDir, 'noop.js'));
const { ProxyRequestTransformer } = requireFromLib('./transformers/request-transformer');
const { ProxySseStreamTransformer } = requireFromLib('./transformers/sse-stream-transformer');

const REQUEST_TIMEOUT_MS = 600_000; // 10 minutes

export interface ProxyServerOptions {
  host: string;
  port: number;
  authToken: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
  chatCompletionsPath?: string; // e.g. '/chat/completions' for BigModel (defaults to /v1/chat/completions)
  reasoningEffort?: string;     // 'off'|'low'|'medium'|'high'|'max'; undefined ⇒ 'high'
}

// --- HTTP Helpers (from CCS http-helpers.js) ---

function writeJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const MAX_BODY_SIZE = 10 * 1024 * 1024;

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const resolveOnce = (payload: Record<string, unknown>) => {
      if (!settled) { settled = true; resolve(payload); }
    };
    const rejectOnce = (error: Error) => {
      if (!settled) { settled = true; reject(error); }
    };

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_SIZE) {
        req.pause();
        rejectOnce(new Error('Request body too large (max 10MB)'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) { resolveOnce({}); return; }
      try { resolveOnce(JSON.parse(raw)); }
      catch { rejectOnce(new Error('Invalid JSON in request body')); }
    });

    req.on('error', (error: Error) => { rejectOnce(error); });
  });
}

async function pipeWebResponseToNode(response: Response, res: http.ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => { res.setHeader(key, value); });
  if (!response.body) { res.end(); return; }
  const nodeStream = stream.Readable.fromWeb(response.body as any);
  await new Promise<void>((resolve, reject) => {
    nodeStream.on('error', reject);
    nodeStream.on('end', resolve);
    nodeStream.pipe(res);
  });
}

// --- Auth ---

function extractIncomingToken(headers: http.IncomingHttpHeaders): string | null {
  const xApiKey = headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.trim().length > 0) return xApiKey.trim();

  const anthropicApiKey = headers['anthropic-api-key'];
  if (typeof anthropicApiKey === 'string' && anthropicApiKey.trim().length > 0) return anthropicApiKey.trim();

  const authHeader = headers.authorization;
  if (typeof authHeader === 'string' && authHeader.trim().length > 0) {
    const trimmed = authHeader.trim();
    const bearerPrefix = 'Bearer ';
    return trimmed.startsWith(bearerPrefix) ? trimmed.slice(bearerPrefix.length).trim() : trimmed;
  }
  return null;
}

function validateAuth(headers: http.IncomingHttpHeaders, expectedToken: string): boolean {
  return extractIncomingToken(headers) === expectedToken;
}

// --- Request Translation ---

/**
 * Build the provider-specific reasoning/thinking params to inject upstream.
 *
 * The generic transformer only knows `reasoning_effort`, which Qwen ignores and
 * which can't carry GLM's `thinking` object. So we re-derive the params per
 * upstream dialect (detected by host) to get thinking ON by default at the
 * configured intensity:
 *   - Qwen (dashscope) → enable_thinking + thinking_budget (tokens)
 *   - GLM (bigmodel)   → thinking{type:enabled} + reasoning_effort
 *   - generic          → reasoning_effort (max/xhigh clamped to high — most
 *                        OpenAI-compat providers 400 on unknown effort values)
 */
function buildReasoningInjection(baseUrl: string, effort: string): Record<string, unknown> {
  const host = baseUrl.toLowerCase();
  const isQwen = host.includes('dashscope');
  const isGlm = host.includes('bigmodel');

  if (effort === 'off') {
    // GLM defaults thinking ON, so disabling must be explicit; others default
    // off (Qwen) or are model-controlled, so omitting the param is enough.
    return isGlm ? { thinking: { type: 'disabled' } } : {};
  }

  if (isQwen) {
    const budget: Record<string, number> = { low: 4096, medium: 16384, high: 32768, max: 81920 };
    return { enable_thinking: true, thinking_budget: budget[effort] ?? 32768 };
  }
  if (isGlm) {
    // GLM-5.x accepts low/medium/high/max/xhigh directly.
    return { thinking: { type: 'enabled' }, reasoning_effort: effort };
  }
  const clamped = effort === 'max' || effort === 'xhigh' ? 'high' : effort;
  return { reasoning_effort: clamped };
}

const EFFORT_VALUES = new Set(['low', 'medium', 'high', 'max']);

/** Normalize an effort string Claude Code may send (low/medium/high/max/xhigh/auto). */
function normEffort(e: unknown): string | undefined {
  if (typeof e !== 'string') return undefined;
  const v = e.trim().toLowerCase();
  if (v === 'xhigh') return 'max';
  return EFFORT_VALUES.has(v) ? v : undefined; // 'auto' / unknown ⇒ fall back
}

/** Map a legacy thinking budget_tokens to a coarse effort bucket. */
function budgetToEffort(b: number): string {
  if (b >= 24000) return 'max';
  if (b >= 8000) return 'high';
  if (b >= 2000) return 'medium';
  return 'low';
}

/**
 * Resolve the effort to use, treating Claude Code's own thinking signal as the
 * source of truth (so the user's /effort + Tab toggle map straight through):
 *   - thinking disabled            → 'off'
 *   - thinking adaptive            → output_config.effort (Claude Code's dial)
 *   - thinking enabled w/ budget   → bucketed from budget_tokens
 *   - nothing usable from client   → the profile default (keeps thinking on)
 */
function resolveEffort(rawBody: Record<string, unknown>, profileDefault: string): string {
  const thinking = rawBody.thinking as { type?: string; budget_tokens?: number } | undefined;
  const oc = rawBody.output_config as { effort?: unknown } | undefined;
  if (thinking?.type === 'disabled') return 'off';
  if (thinking?.type === 'enabled' && typeof thinking.budget_tokens === 'number') {
    return budgetToEffort(thinking.budget_tokens);
  }
  // adaptive, enabled-without-budget, or no thinking field: prefer the effort
  // Claude Code attached, else the profile's configured default.
  return normEffort(oc?.effort) ?? profileDefault;
}

function buildUpstreamRequest(rawBody: Record<string, unknown>, options: ProxyServerOptions): string {
  const transformer = new ProxyRequestTransformer();
  const transformed = transformer.transform(rawBody) as Record<string, unknown>;
  // Strip fields standard OpenAI-compat providers don't accept (metadata) and
  // the transformer's coarse reasoning_effort — we re-inject per dialect below.
  const { metadata: _metadata, reasoning_effort: _droppedEffort, ...rest } = transformed;

  // Claude Code drives the thinking intensity; the profile's reasoningEffort is
  // only the fallback when the client sends no usable signal.
  const effort = resolveEffort(rawBody, options.reasoningEffort || 'high');
  const reasoning = buildReasoningInjection(options.baseUrl, effort);

  // GLM only accepts tool_choice "auto"; clamp anything else to avoid a 400.
  if (options.baseUrl.toLowerCase().includes('bigmodel') && 'tool_choice' in rest && rest.tool_choice !== 'auto') {
    rest.tool_choice = 'auto';
  }

  const streaming = rest.stream === true;
  const body = {
    ...rest,
    ...reasoning,
    model: rest.model || options.model || 'gpt-4',
    stream: streaming,
    // Ask the upstream for a trailing usage chunk (token counts + cache
    // hit/miss) so we can log real cost/cache stats. OpenAI-standard; the SSE
    // stream-parser already tolerates the usage-only/empty-choices final chunk.
    ...(streaming ? { stream_options: { include_usage: true } } : {}),
  };
  return JSON.stringify(body);
}

// --- Usage logging (cache hit/miss diagnostics) ---

function toNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Log token usage for one upstream response, normalizing the cache-hit fields
 * across provider dialects:
 *   - DeepSeek: prompt_cache_hit_tokens / prompt_cache_miss_tokens
 *   - OpenAI-style: prompt_tokens_details.cached_tokens (miss = prompt - hit)
 * Providers without prefix caching simply report no hit field ⇒ rate "n/a".
 */
function logUsage(model: string, usage: Record<string, unknown>): void {
  const prompt = toNum(usage.prompt_tokens) ?? toNum(usage.input_tokens);
  const completion = toNum(usage.completion_tokens) ?? toNum(usage.output_tokens);
  const details = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  const hit = toNum(usage.prompt_cache_hit_tokens) ?? toNum(details?.cached_tokens);
  let miss = toNum(usage.prompt_cache_miss_tokens);
  if (miss === undefined && prompt !== undefined && hit !== undefined) miss = prompt - hit;
  const rate = hit !== undefined && prompt ? `${((hit / prompt) * 100).toFixed(1)}%` : 'n/a';
  log.info(
    'USAGE',
    `model=${model} prompt=${prompt ?? '?'} (cache hit=${hit ?? '?'} miss=${miss ?? '?'} rate=${rate}) completion=${completion ?? '?'}`,
  );
}

function usageFromSseLine(line: string): Record<string, unknown> | null {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    const obj = JSON.parse(payload) as Record<string, unknown>;
    return obj && typeof obj.usage === 'object' && obj.usage !== null
      ? (obj.usage as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function consumeUsage(
  body: ReadableStream<Uint8Array>,
  model: string,
  isStream: boolean,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let usage: Record<string, unknown> | null = null;
  try {
    if (isStream) {
      let pending = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = pending.indexOf('\n')) >= 0) {
          const found = usageFromSseLine(pending.slice(0, nl).trim());
          if (found) usage = found;
          pending = pending.slice(nl + 1);
        }
      }
      const tail = usageFromSseLine(pending.trim());
      if (tail) usage = tail;
    } else {
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      try {
        const obj = JSON.parse(text) as Record<string, unknown>;
        if (obj && typeof obj.usage === 'object' && obj.usage !== null) {
          usage = obj.usage as Record<string, unknown>;
        }
      } catch {
        /* not JSON — nothing to log */
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (usage) logUsage(model, usage);
}

/**
 * Non-destructively tap the upstream response to log token usage (incl. cache
 * hit/miss) without disturbing the bytes Claude Code receives. Tees the body:
 * one branch flows to the transformer untouched, the other is parsed for the
 * usage chunk. Best-effort — any tap error is swallowed so it can never break
 * the client-facing path.
 */
function tapUsageForLogging(upstream: Response, model: string, isStream: boolean): Response {
  if (!upstream.body) return upstream;
  const [forClient, forTap] = upstream.body.tee();
  void consumeUsage(forTap, model, isStream).catch(() => {});
  return new Response(forClient, { status: upstream.status, headers: upstream.headers });
}

// --- Server ---

export function startProxyServer(options: ProxyServerOptions): http.Server {
  const server = http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const requestUrl = req.url || '/';
    const parsedUrl = new URL(requestUrl, 'http://127.0.0.1');
    const pathname = parsedUrl.pathname.length > 1
      ? parsedUrl.pathname.replace(/\/+$/, '')
      : parsedUrl.pathname;

    try {
      await handleRequest(req, res, method, pathname, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (!res.headersSent) {
        writeJson(res, 500, { type: 'error', error: { type: 'api_error', message } });
      }
    }
  });

  server.listen(options.port, options.host);
  return server;
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  method: string,
  pathname: string,
  options: ProxyServerOptions,
): Promise<void> {
  // Health check
  if ((method === 'GET' || method === 'HEAD') && pathname === '/health') {
    if (method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end();
    } else {
      writeJson(res, 200, {
        ok: true,
        service: PROXY_SERVICE_NAME,
        host: options.host,
        port: options.port,
      });
    }
    return;
  }

  // Root info
  if ((method === 'GET' || method === 'HEAD') && pathname === '/') {
    if (method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end();
    } else {
      writeJson(res, 200, {
        ok: true,
        service: PROXY_SERVICE_NAME,
        bind: { host: options.host, port: options.port },
        endpoints: ['/health', '/v1/messages', '/v1/models'],
      });
    }
    return;
  }

  // Models endpoint
  if (method === 'GET' && pathname === '/v1/models') {
    if (!validateAuth(req.headers, options.authToken)) {
      writeJson(res, 401, {
        type: 'error',
        error: { type: 'authentication_error', message: 'Missing or invalid local proxy token' },
      });
      return;
    }
    const models = [options.model].filter(Boolean).map((id) => ({
      id,
      object: 'model',
      created: 0,
      owned_by: 'mcc-proxy',
    }));
    writeJson(res, 200, { object: 'list', data: models });
    return;
  }

  // Messages endpoint (main translation)
  if (method === 'POST' && pathname === '/v1/messages') {
    await handleMessages(req, res, options);
    return;
  }

  writeJson(res, 404, { error: 'Not found' });
}

async function handleMessages(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ProxyServerOptions,
): Promise<void> {
  const transformer = new ProxySseStreamTransformer();

  if (!validateAuth(req.headers, options.authToken)) {
    await pipeWebResponseToNode(
      transformer.error(401, 'authentication_error', 'Missing or invalid local proxy token'),
      res,
    );
    return;
  }

  const timeoutMs = REQUEST_TIMEOUT_MS;
  try {
    const rawBody = await readJsonBody(req);

    // Log request summary
    const reqModel = typeof rawBody.model === 'string' ? rawBody.model : '(none)';
    const msgCount = Array.isArray(rawBody.messages) ? rawBody.messages.length : 0;
    const isStream = rawBody.stream === true;
    log.info('PROXY', `→ /v1/messages model=${reqModel} msgs=${msgCount} stream=${isStream}`);

    // Vision injection: a clipboard-pasted image arrives as an inline base64
    // image block. A text-only upstream can't use it, so swap each image for a
    // vision-model text description before translation. No-op (and zero cost)
    // when no image is present; degrades to a placeholder on provider failure.
    if (hasImageBlocks(rawBody)) {
      try {
        const { injected } = await injectVision(rawBody);
        if (injected > 0) {
          log.info('PROXY', `vision injection: replaced ${injected} image block(s) with text`);
        }
      } catch (e) {
        log.warn('PROXY', `vision injection failed: ${(e as Error).message}`);
      }
    }

    const upstreamBody = buildUpstreamRequest(rawBody, options);
    const upstreamUrl = resolveOpenAIChatCompletionsUrl(options.baseUrl, options.chatCompletionsPath);

    if (isDebugEnabled()) {
      log.debug('PROXY', `upstream url: ${upstreamUrl}`);
      log.debug('PROXY', `upstream body: ${upstreamBody.slice(0, 2000)}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Client disconnect detection
    const abortOnDisconnect = (_source: string) => {
      if (!controller.signal.aborted && !res.writableEnded) {
        controller.abort();
      }
    };
    req.on('aborted', () => abortOnDisconnect('req.aborted'));
    req.socket?.on('close', () => abortOnDisconnect('socket.close'));

    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
          'User-Agent': 'MCC-OpenAI-Compat-Proxy/1.0',
        },
        body: upstreamBody,
        signal: controller.signal,
      });

      if (upstreamResponse.status >= 400) {
        // Buffer error body for logging, then reconstruct for transformer
        const errorText = await upstreamResponse.text();
        log.error('PROXY', `← ${upstreamResponse.status} upstream error: ${errorText.slice(0, 500)}`);
        const headers = new Headers();
        upstreamResponse.headers.forEach((v, k) => headers.set(k, v));
        const reconstructed = new Response(errorText, { status: upstreamResponse.status, headers });
        const response = await transformer.transform(reconstructed);
        await pipeWebResponseToNode(response, res);
      } else {
        log.info('PROXY', `← ${upstreamResponse.status} OK`);
        const tapped = tapUsageForLogging(upstreamResponse, reqModel, isStream);
        const response = await transformer.transform(tapped);
        await pipeWebResponseToNode(response, res);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const status = isAbort ? 502 : message.includes('Request body too large') ? 413 : message.includes('Invalid JSON') ? 400 : 502;
    const type = status >= 500 ? 'api_error' : 'invalid_request_error';
    const errorMessage = isAbort
      ? `The upstream provider did not respond within ${timeoutMs / 1000} seconds`
      : message;
    log.error('PROXY', `request failed: ${message}`);

    await pipeWebResponseToNode(transformer.error(status, type, errorMessage), res);
  }
}
