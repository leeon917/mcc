/**
 * Proxy path constants and session/PID file management
 * Ported from CCS proxy-daemon-paths.js + proxy-daemon-state.js
 */

import * as fs from 'fs';
import * as path from 'path';

function getMccHome(): string {
  return process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
}

export const PROXY_PORT_START = 43456;
export const PROXY_PORT_END = 43555;
export const PROXY_SERVICE_NAME = 'mcc-openai-compat-proxy';

export function getProxyDir(): string {
  return path.join(getMccHome(), 'proxy');
}

export function getProxyPidPath(profileName: string): string {
  return path.join(getProxyDir(), `${encodeURIComponent(profileName)}.daemon.pid`);
}

export function getProxySessionPath(profileName: string): string {
  return path.join(getProxyDir(), `${encodeURIComponent(profileName)}.session.json`);
}

export interface ProxySession {
  profileName: string;
  port: number;
  host: string;
  authToken: string;
  baseUrl: string;
  startedAt: string;
  proxyChatCompletionsPath?: string;
  reasoningEffort?: string;
  // mcc version that spawned this proxy. Used to auto-restart a stale daemon
  // after an upgrade: the long-lived proxy keeps running OLD code until the
  // version recorded here differs from the launching CLI's version. Absent on
  // sessions written by mcc ≤0.4.0 (treated as "old" ⇒ triggers a restart).
  mccVersion?: string;
}

function ensureProxyDir(): void {
  fs.mkdirSync(getProxyDir(), { recursive: true, mode: 0o700 });
}

export function readProxyPid(profileName: string): number | null {
  try {
    const raw = fs.readFileSync(getProxyPidPath(profileName), 'utf8').trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function writeProxyPid(profileName: string, pid: number): void {
  ensureProxyDir();
  fs.writeFileSync(getProxyPidPath(profileName), String(pid), 'utf8');
}

export function removeProxyPid(profileName: string): void {
  try {
    fs.unlinkSync(getProxyPidPath(profileName));
  } catch {
    // Best-effort cleanup
  }
}

export function readProxySession(profileName: string): ProxySession | null {
  try {
    return JSON.parse(fs.readFileSync(getProxySessionPath(profileName), 'utf8'));
  } catch {
    return null;
  }
}

export function writeProxySession(session: ProxySession): void {
  ensureProxyDir();
  fs.writeFileSync(getProxySessionPath(session.profileName), JSON.stringify(session, null, 2) + '\n', 'utf8');
}

export function removeProxySession(profileName: string): void {
  try {
    fs.unlinkSync(getProxySessionPath(profileName));
  } catch {
    // Best-effort cleanup
  }
}

export function hashProfileName(profileName: string): number {
  let hash = 0;
  for (const char of profileName.trim()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function resolveAdaptivePort(profileName: string): number {
  const rangeSize = PROXY_PORT_END - PROXY_PORT_START + 1;
  return PROXY_PORT_START + (hashProfileName(profileName) % rangeSize);
}
