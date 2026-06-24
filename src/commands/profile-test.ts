/**
 * `mcc profile test [name] [--vision]` — live health-check a profile's key.
 *
 * Three independent probes, each reported separately:
 *   1. models  — GET the provider's model list. Proves the key *authenticates*.
 *   2. usable  — a 1-token chat/messages call. Proves the account is actually
 *                callable (catches "key valid but balance = 0", e.g. DeepSeek 402,
 *                which the models endpoint alone reports as OK).
 *   3. vision  — (only with --vision) sends a 4-quadrant probe image to the
 *                profile's own model and checks it names all four colors, i.e.
 *                whether the main model can natively see images.
 *
 * Calls the upstream provider directly (not through the local proxy) so the
 * result reflects the real provider, not the translation layer.
 */

import pc from 'picocolors';
import { getProfile, getProfileApiKey, listProfiles, type Profile } from '../accounts/store';
import { makeVisionProbeBase64, passesVisionProbe, VISION_PROBE_PROMPT } from '../shared/test-image';

type Protocol = 'anthropic' | 'openai';

interface Probe {
  ok: boolean;
  detail: string;
  neutral?: boolean; // not a pass/fail — e.g. provider has no /v1/models endpoint
}

const TIMEOUT_MS = 30_000;

function trimBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function authHeaders(key: string, protocol: Protocol): Record<string, string> {
  return protocol === 'anthropic'
    ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
    : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function http(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
): Promise<{ status: number; json: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    const text = await resp.text();
    let json: unknown = undefined;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
    return { status: resp.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

function errSnippet(status: number, json: unknown, text: string): string {
  const j = json as { error?: { message?: string }; message?: string } | undefined;
  const raw = j?.error?.message ?? j?.message ?? text;
  // Collapse whitespace and strip HTML so a 404 error page stays one tidy line.
  const msg = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  return `HTTP ${status}${msg ? ` — ${msg}` : ''}`;
}

async function probeModels(base: string, key: string, protocol: Protocol): Promise<Probe> {
  const url = protocol === 'anthropic' ? `${base}/v1/models` : `${base}/models`;
  try {
    const { status, json, text } = await http(url, { method: 'GET', headers: authHeaders(key, protocol) });
    // Many Anthropic-compatible providers don't expose /v1/models — a 404 here
    // says nothing about the key (the `usable` probe is the real auth check).
    if (status === 404) return { ok: true, neutral: true, detail: 'no /v1/models endpoint' };
    if (status !== 200) return { ok: false, detail: errSnippet(status, json, text) };
    const body = json as { data?: unknown[]; models?: unknown[] };
    const list = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
    return { ok: true, detail: `${list.length} models` };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}

async function probeUsable(base: string, key: string, protocol: Protocol, model: string): Promise<Probe> {
  const url = protocol === 'anthropic' ? `${base}/v1/messages` : `${base}/chat/completions`;
  const body = JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'hi' }] });
  try {
    const { status, json, text } = await http(url, { method: 'POST', headers: authHeaders(key, protocol), body });
    if (status !== 200) return { ok: false, detail: errSnippet(status, json, text) };
    return { ok: true, detail: `model=${model}` };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}

function extractReply(protocol: Protocol, json: unknown): string {
  if (protocol === 'anthropic') {
    const d = json as { content?: Array<{ type?: string; text?: string }> };
    return (d?.content ?? [])
      .filter((b) => b?.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join(' ');
  }
  const d = json as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> };
  const m = d?.choices?.[0]?.message;
  return m?.content || m?.reasoning_content || '';
}

async function probeVision(base: string, key: string, protocol: Protocol, model: string): Promise<Probe> {
  const url = protocol === 'anthropic' ? `${base}/v1/messages` : `${base}/chat/completions`;
  const b64 = makeVisionProbeBase64();
  const content =
    protocol === 'anthropic'
      ? [
          { type: 'text', text: VISION_PROBE_PROMPT },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
        ]
      : [
          { type: 'text', text: VISION_PROBE_PROMPT },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        ];
  const body = JSON.stringify({ model, max_tokens: 300, messages: [{ role: 'user', content }] });
  try {
    const { status, json, text } = await http(url, { method: 'POST', headers: authHeaders(key, protocol), body });
    if (status !== 200) return { ok: false, detail: errSnippet(status, json, text) };
    const reply = extractReply(protocol, json).replace(/\s+/g, ' ').trim();
    if (passesVisionProbe(reply)) return { ok: true, detail: `read image: "${reply.slice(0, 60)}"` };
    return { ok: false, detail: `wrong/blind: "${reply.slice(0, 60) || '(empty)'}"` };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}

function line(label: string, probe: Probe | null): string {
  if (!probe) return `    ${pc.dim('vision'.padEnd(7))} ${pc.dim('–')} ${pc.dim('skipped (pass --vision)')}`;
  const mark = probe.neutral ? pc.dim('•') : probe.ok ? pc.green('✓') : pc.red('✗');
  const text = probe.neutral || probe.ok ? pc.dim(probe.detail) : pc.red(probe.detail);
  return `    ${pc.dim(label.padEnd(7))} ${mark} ${text}`;
}

async function testOne(profile: Profile, wantVision: boolean): Promise<boolean> {
  const protocol: Protocol = profile.protocol || 'anthropic';
  const key = getProfileApiKey(profile.name);
  const head = `  ${pc.bold(profile.name)} ${pc.dim('·')} ${pc.dim(protocol)} ${pc.dim('·')} ${pc.cyan(profile.model)}`;
  if (!key) {
    console.log(head);
    console.log(`    ${pc.red('✗')} ${pc.red('no API key stored')}`);
    return false;
  }
  const base = trimBase(profile.baseUrl);
  const models = await probeModels(base, key, protocol);
  const usable = await probeUsable(base, key, protocol, profile.model);
  const vision = wantVision ? await probeVision(base, key, protocol, profile.model) : null;

  console.log(head);
  console.log(line('models', models));
  console.log(line('usable', usable));
  console.log(line('vision', vision));

  // "Healthy" = can actually be used. Models-only success with an unusable
  // account (balance 0) is still a failure worth surfacing in the exit code.
  return usable.ok;
}

export async function cmdProfileTest(args: string[]): Promise<void> {
  const wantVision = args.includes('--vision');
  const names = args.filter((a) => !a.startsWith('--'));

  const targets = names.length
    ? names.map((n) => getProfile(n)).filter((p): p is Profile => Boolean(p))
    : listProfiles();

  if (names.length) {
    const missing = names.filter((n) => !getProfile(n));
    if (missing.length) {
      console.error(`[!] Profile not found: ${missing.join(', ')}`);
      process.exit(1);
    }
  }
  if (targets.length === 0) {
    console.log('[i] No profiles to test.');
    return;
  }

  console.log(
    `Testing ${targets.length} profile(s)${wantVision ? ' + vision' : ''}  ${pc.dim('(models = auth · usable = balance · vision = main model sees images)')}\n`,
  );

  let failures = 0;
  for (const p of targets) {
    const ok = await testOne(p, wantVision);
    if (!ok) failures++;
    console.log();
  }

  if (failures > 0) {
    console.log(pc.dim(`${failures}/${targets.length} profile(s) not usable.`));
    process.exit(1);
  }
  console.log(pc.green(`All ${targets.length} profile(s) usable.`));
}
