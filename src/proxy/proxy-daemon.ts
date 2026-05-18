/**
 * Proxy Daemon - Lifecycle management for the translation proxy
 *
 * Manages starting/stopping the proxy as a detached child process.
 * Ported from CCS proxy/proxy-daemon.js (simplified for single-profile MCC).
 */

import * as crypto from 'crypto';
import * as http from 'http';
import { spawn } from 'child_process';
import * as path from 'path';
import {
  resolveAdaptivePort,
  readProxyPid,
  writeProxyPid,
  removeProxyPid,
  readProxySession,
  writeProxySession,
  removeProxySession,
  PROXY_SERVICE_NAME,
  type ProxySession,
} from './proxy-paths';

const PROXY_ENTRY_CANDIDATES = [
  path.join(__dirname, 'proxy-entry.js'),
  path.join(__dirname, 'proxy-entry.cjs'),
];

function generateAuthToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

async function isProxyRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/health', method: 'GET', timeout: 3000 },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) { resolve(false); return; }
          try {
            const payload = JSON.parse(body);
            resolve(payload.service === PROXY_SERVICE_NAME);
          } catch {
            resolve(false);
          }
        });
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function terminateProcess(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM');
    let attempts = 0;
    while (attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      try {
        process.kill(pid, 0);
        attempts++;
      } catch {
        return; // Process exited
      }
    }
    process.kill(pid, 'SIGKILL');
  } catch {
    // Best-effort
  }
}

export interface ProxyStartResult {
  port: number;
  authToken: string;
}

/**
 * Start the translation proxy for a profile.
 * If a proxy is already running for this profile, returns its existing session.
 */
export async function startProxy(
  profileName: string,
  baseUrl: string,
  apiKey: string,
  model?: string,
  proxyChatCompletionsPath?: string,
): Promise<ProxyStartResult> {
  // Check if already running
  const existingSession = readProxySession(profileName);
  if (existingSession && await isProxyRunning(existingSession.port)) {
    // If the caller provided a different proxyChatCompletionsPath, the existing
    // proxy is incompatible — stop it and restart with the new path.
    const existingPath = existingSession.proxyChatCompletionsPath;
    if (proxyChatCompletionsPath && proxyChatCompletionsPath !== existingPath) {
      await stopProxy(profileName);
    } else {
      return { port: existingSession.port, authToken: existingSession.authToken };
    }
  }

  // Clean up stale state
  stopProxy(profileName).catch(() => {});

  const port = resolveAdaptivePort(profileName);
  const authToken = generateAuthToken();

  // Find the entry script
  let entryScript: string | null = null;
  for (const candidate of PROXY_ENTRY_CANDIDATES) {
    try {
      const fs = await import('fs');
      fs.accessSync(candidate, fs.constants.R_OK);
      entryScript = candidate;
      break;
    } catch {
      // Try next
    }
  }
  if (!entryScript) {
    throw new Error('Proxy entry script not found. Run: npm run build');
  }

  // Spawn the proxy as a detached child process
  const child = spawn(process.execPath, [
    entryScript,
    '--port', String(port),
    '--host', '127.0.0.1',
    '--base-url', baseUrl,
    '--api-key', apiKey,
    '--auth-token', authToken,
    ...(model ? ['--model', model] : []),
    ...(proxyChatCompletionsPath ? ['--proxy-chat-completions-path', proxyChatCompletionsPath] : []),
  ], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  child.unref();

  const pid = child.pid;
  if (!pid) {
    throw new Error('Failed to spawn proxy process');
  }

  // Write PID and session files
  writeProxyPid(profileName, pid);
  const session: ProxySession = {
    profileName,
    port,
    host: '127.0.0.1',
    authToken,
    baseUrl,
    proxyChatCompletionsPath,
    startedAt: new Date().toISOString(),
  };
  writeProxySession(session);

  // Wait for the proxy to be ready (up to 5 seconds)
  for (let i = 0; i < 25; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (await isProxyRunning(port)) {
      return { port, authToken };
    }
  }

  throw new Error(`Proxy failed to start within 5 seconds (PID: ${pid}, port: ${port})`);
}

/**
 * Stop the translation proxy for a profile.
 */
export async function stopProxy(profileName: string): Promise<void> {
  const pid = readProxyPid(profileName);
  if (pid) {
    await terminateProcess(pid);
  }
  removeProxyPid(profileName);
  removeProxySession(profileName);
}

/**
 * Check if a proxy is running for a profile.
 */
export async function getProxyStatus(profileName: string): Promise<{ running: boolean; port?: number }> {
  const session = readProxySession(profileName);
  if (!session) return { running: false };
  const running = await isProxyRunning(session.port);
  return { running, port: running ? session.port : undefined };
}
