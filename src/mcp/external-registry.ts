/**
 * External MCP Server Registry
 *
 * Stores user-added MCP server definitions in ~/.mcc/external-mcp-servers.json.
 * These are MCP servers not bundled with MCC (e.g. MiniMax Token Plan MCP).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { McpRegistryEntry } from './registry';

export interface ExternalMcpServer {
  name: string; // unique identifier, e.g. "minimax-plan"
  displayName: string;
  description: string;
  type?: 'stdio' | 'http' | 'sse'; // transport; defaults to 'stdio' when absent
  // stdio transport
  command?: string; // e.g. "uvx"
  args?: string[]; // e.g. ["minimax-coding-plan-mcp", "-y"]
  envVars?: Record<string, string>; // e.g. { MINIMAX_API_KEY: "${MCC_PROVIDER_KEY:minimax}" }
  // http / sse transport
  url?: string; // e.g. "https://example.com/mcp"
  headers?: Record<string, string>;
  enabledByDefault: boolean;
}

function getMccHome(): string {
  return process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
}

export function getExternalMcpRegistryPath(): string {
  return path.join(getMccHome(), 'external-mcp-servers.json');
}

export function readExternalMcpRegistry(): ExternalMcpServer[] {
  const filePath = getExternalMcpRegistryPath();
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

export function writeExternalMcpRegistry(servers: ExternalMcpServer[]): void {
  const filePath = getExternalMcpRegistryPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, JSON.stringify(servers, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function getExternalMcpServer(name: string): ExternalMcpServer | undefined {
  return readExternalMcpRegistry().find((s) => s.name === name);
}

export function addExternalMcpServer(server: ExternalMcpServer): void {
  const servers = readExternalMcpRegistry();
  const idx = servers.findIndex((s) => s.name === server.name);
  if (idx >= 0) {
    servers[idx] = server;
  } else {
    servers.push(server);
  }
  writeExternalMcpRegistry(servers);
}

export function removeExternalMcpServer(name: string): void {
  const servers = readExternalMcpRegistry().filter((s) => s.name !== name);
  writeExternalMcpRegistry(servers);
}

export function getAllServers(): Array<McpRegistryEntry | ExternalMcpServer> {
  // Imported here to avoid circular dependency
  const { BUILTIN_MCP_SERVERS } = require('./registry');
  return [...BUILTIN_MCP_SERVERS, ...readExternalMcpRegistry()];
}
