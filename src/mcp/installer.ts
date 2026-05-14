/**
 * MCP Server Installer
 */

import * as fs from 'fs';
import * as path from 'path';
import { getBuiltinServerPath, BUILTIN_MCP_SERVERS, type McpServerConfig } from './registry';

function getMccHome(): string {
  return process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
}

function getMcpInstallDir(): string {
  return path.join(getMccHome(), 'mcp');
}

export function installBuiltinServers(): void {
  const installDir = getMcpInstallDir();
  fs.mkdirSync(installDir, { recursive: true, mode: 0o700 });
  for (const server of BUILTIN_MCP_SERVERS) {
    const sourcePath = getBuiltinServerPath(server.name);
    if (!sourcePath) {
      console.warn(`[!] Built-in server not found: ${server.name}`);
      continue;
    }
    const destPath = path.join(installDir, path.basename(sourcePath));
    if (fs.existsSync(destPath)) {
      const sourceContent = fs.readFileSync(sourcePath);
      const destContent = fs.readFileSync(destPath);
      if (sourceContent.equals(destContent)) continue;
    }
    fs.copyFileSync(sourcePath, destPath);
    fs.chmodSync(destPath, 0o700);
  }
}

export function readInstanceMcpConfig(instancePath: string): Record<string, McpServerConfig> {
  const configPath = path.join(instancePath, '.mcp', 'mcpServers.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

export function writeInstanceMcpConfig(instancePath: string, configs: Record<string, McpServerConfig>): void {
  const mcpDir = path.join(instancePath, '.mcp');
  fs.mkdirSync(mcpDir, { recursive: true, mode: 0o700 });
  const configPath = path.join(mcpDir, 'mcpServers.json');
  fs.writeFileSync(configPath, JSON.stringify(configs, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function syncInstanceMcpServers(instancePath: string, enabledServerNames: string[]): void {
  const configs: Record<string, McpServerConfig> = {};
  for (const name of enabledServerNames) {
    const builtin = BUILTIN_MCP_SERVERS.find((s) => s.name === name);
    if (builtin) configs[name] = builtin.config;
  }
  writeInstanceMcpConfig(instancePath, configs);
}
