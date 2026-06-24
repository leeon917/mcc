#!/usr/bin/env node
/**
 * Proxy Daemon Entrypoint
 *
 * This file is spawned as a detached child process by proxy-daemon.ts.
 * It parses CLI args and starts the proxy server.
 *
 * Ported from CCS proxy/proxy-daemon-entry.js (simplified for single-profile MCC).
 */

import { startProxyServer, type ProxyServerOptions } from './proxy-server';
import { log, initFromEnv } from '../shared/logger';

initFromEnv();

function parseArgs(argv: string[]): ProxyServerOptions {
  let port = 43456;
  let host = '127.0.0.1';
  let baseUrl = '';
  let apiKey = '';
  let model = '';
  let authToken = '';
  let chatCompletionsPath = '';
  let reasoningEffort = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) { port = Number.parseInt(argv[++i] || '', 10) || port; continue; }
    if (arg === '--host' && argv[i + 1]) { host = argv[++i] || host; continue; }
    if (arg === '--base-url' && argv[i + 1]) { baseUrl = argv[++i] || ''; continue; }
    if (arg === '--api-key' && argv[i + 1]) { apiKey = argv[++i] || ''; continue; }
    if (arg === '--model' && argv[i + 1]) { model = argv[++i] || ''; continue; }
    if (arg === '--auth-token' && argv[i + 1]) { authToken = argv[++i] || ''; continue; }
    if (arg === '--proxy-chat-completions-path' && argv[i + 1]) { chatCompletionsPath = argv[++i] || ''; continue; }
    if (arg === '--reasoning-effort' && argv[i + 1]) { reasoningEffort = argv[++i] || ''; continue; }
  }

  if (!authToken.trim()) {
    throw new Error('Missing local proxy auth token');
  }
  if (!baseUrl.trim()) {
    throw new Error('Missing upstream base URL');
  }
  if (!apiKey.trim()) {
    throw new Error('Missing upstream API key');
  }

  return { port, host, baseUrl, apiKey, model: model || undefined, authToken, chatCompletionsPath: chatCompletionsPath || undefined, reasoningEffort: reasoningEffort || undefined };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const server = startProxyServer(options);

  server.once('error', (error) => {
    log.error('PROXY', `server error: ${error.message}`);
    process.exit(1);
  });

  log.info('PROXY', `listening on http://${options.host}:${options.port} model=${options.model ?? '(default)'}`);

  const shutdown = () => {
    log.info('PROXY', 'shutting down');
    server.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
