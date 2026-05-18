/**
 * Upstream URL resolution
 * Ported from CCS proxy/upstream-url.js
 */

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '';
}

function ensureSupportedProtocol(parsed: URL): void {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported upstream protocol: ${parsed.protocol}`);
  }
}

function buildResolvedUrl(baseUrl: string, suffix: string): string {
  const parsed = new URL(baseUrl);
  ensureSupportedProtocol(parsed);
  const pathname = normalizePathname(parsed.pathname);
  if (pathname.endsWith(suffix)) {
    return parsed.toString();
  }
  if (pathname.endsWith('/v1') || pathname.endsWith('/api')) {
    parsed.pathname = `${pathname}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
    return parsed.toString();
  }
  parsed.pathname = pathname ? `${pathname}/v1${suffix}` : `/v1${suffix}`;
  return parsed.toString();
}

export function resolveOpenAIChatCompletionsUrl(baseUrl: string, chatCompletionsPath?: string): string {
  let suffix = chatCompletionsPath ?? '/v1/chat/completions';
  // Normalize: strip leading './' so './chat/completions' becomes '/chat/completions'
  if (suffix.startsWith('./')) suffix = '/' + suffix.slice(2);
  // Strip leading /v1 so buildResolvedUrl can add it back — except when
  // the pathname already ends with a versioned segment (e.g. /v4 for BigModel),
  // in which case we append the suffix directly without re-adding /v1.
  const normalizedSuffix = suffix.startsWith('/v1/') ? suffix.slice('/v1'.length) : suffix;
  const parsed = new URL(baseUrl);
  const pathname = normalizePathname(parsed.pathname);
  // If pathname already carries a version segment that isn't /v1 (e.g. /v4),
  // just append the suffix without adding another /v1.
  const alreadyVersioned = /\/v\d+$/.test(pathname);
  if (alreadyVersioned) {
    const needsSlash = !pathname.endsWith('/') && !normalizedSuffix.startsWith('/');
    parsed.pathname = pathname + (needsSlash ? '/' : '') + normalizedSuffix;
    return parsed.toString();
  }
  return buildResolvedUrl(baseUrl, normalizedSuffix);
}

export function resolveOpenAIModelsUrl(baseUrl: string): string {
  return buildResolvedUrl(baseUrl, '/models');
}
