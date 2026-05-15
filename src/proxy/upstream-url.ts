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

export function resolveOpenAIChatCompletionsUrl(baseUrl: string): string {
  return buildResolvedUrl(baseUrl, '/chat/completions');
}

export function resolveOpenAIModelsUrl(baseUrl: string): string {
  return buildResolvedUrl(baseUrl, '/models');
}
