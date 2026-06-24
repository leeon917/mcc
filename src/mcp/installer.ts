/**
 * MCP Server Installer
 */

import * as fs from 'fs';
import * as path from 'path';
import pc from 'picocolors';
import { isDebugEnabled } from '../shared/logger';
import {
  getBuiltinServerPath,
  BUILTIN_MCP_SERVERS,
  getServerByName,
  type McpServerConfig,
} from './registry';
import {
  readExternalMcpRegistry,
  type ExternalMcpServer,
} from './external-registry';
import { readMcpConfig } from './mcp-config';

function getMccHome(): string {
  return process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
}

function getMcpInstallDir(): string {
  return path.join(getMccHome(), 'mcp');
}

export function installBuiltinServers(): void {
  const installDir = getMcpInstallDir();
  fs.mkdirSync(installDir, { recursive: true, mode: 0o700 });
  const copied: string[] = [];

  // Install MCP server entry points
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
    copied.push(server.name);
  }

  // Install mcp-hooks/ (runtime files referenced by MCP servers)
  const hooksSourceDir = path.join(__dirname, '..', '..', 'lib', 'mcp-hooks');
  const hooksInstallDir = path.join(getMccHome(), 'mcp-hooks');
  if (fs.existsSync(hooksSourceDir)) {
    fs.mkdirSync(hooksInstallDir, { recursive: true, mode: 0o700 });
    for (const entry of fs.readdirSync(hooksSourceDir)) {
      if (!entry.endsWith('.cjs')) continue;
      const src = path.join(hooksSourceDir, entry);
      const dest = path.join(hooksInstallDir, entry);
      if (fs.existsSync(dest)) {
        if (fs.readFileSync(src).equals(fs.readFileSync(dest))) continue;
      }
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, 0o700);
      copied.push(`hooks/${entry}`);
    }
  }

  // Install shared logger to ~/.mcc/shared/logger.cjs
  const sharedSource = path.join(__dirname, '..', '..', 'lib', 'shared', 'logger.cjs');
  const sharedDestDir = path.join(getMccHome(), 'shared');
  if (fs.existsSync(sharedSource)) {
    fs.mkdirSync(sharedDestDir, { recursive: true, mode: 0o700 });
    const sharedDest = path.join(sharedDestDir, 'logger.cjs');
    if (!fs.existsSync(sharedDest) || !fs.readFileSync(sharedSource).equals(fs.readFileSync(sharedDest))) {
      fs.copyFileSync(sharedSource, sharedDest);
      fs.chmodSync(sharedDest, 0o700);
      copied.push('shared/logger.cjs');
    }
  }

  if (copied.length > 0) {
    console.log(`  ${pc.dim('install')}  ${pc.dim(copied.join(', '))}`);
  }
}

export function readInstanceMcpConfig(instancePath: string): Record<string, McpServerConfig> {
  // Read from .claude.json (where Claude Code actually reads MCP config)
  const claudeJsonPath = path.join(instancePath, '.claude.json');
  if (fs.existsSync(claudeJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
      if (data.mcpServers) return data.mcpServers;
    } catch { /* ignore */ }
  }
  return {};
}

function readClaudeJson(instancePath: string): Record<string, unknown> {
  const claudeJsonPath = path.join(instancePath, '.claude.json');
  if (fs.existsSync(claudeJsonPath)) {
    try {
      return JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    } catch { /* ignore */ }
  }
  return {};
}

function writeClaudeJson(instancePath: string, data: Record<string, unknown>): void {
  const claudeJsonPath = path.join(instancePath, '.claude.json');
  fs.writeFileSync(claudeJsonPath, JSON.stringify(data, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
}

/**
 * Read which external MCPs are enabled for a given instance.
 */
export function readInstanceExternalEnabled(instancePath: string): string[] {
  const filePath = path.join(instancePath, 'external-mcp-enabled.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Write which external MCPs are enabled for a given instance.
 */
function writeInstanceExternalEnabled(instancePath: string, names: string[]): void {
  const filePath = path.join(instancePath, 'external-mcp-enabled.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, JSON.stringify(names, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
}

/**
 * Resolve ${MCC_PROVIDER_KEY:<providerId>} placeholders from mcp-config.json.
 */
function resolveEnvVar(value: string): string {
  const match = value.match(/^\$\{MCC_PROVIDER_KEY:([^}]+)\}$/);
  if (!match) return value;

  const providerId = match[1];
  const mcpConfig = readMcpConfig();

  // Check imageAnalysis providers first
  const iaProvider = mcpConfig.imageAnalysis.providers[providerId];
  if (iaProvider?.apiKey) return iaProvider.apiKey;

  // Check websearch providers
  const wsProvider = mcpConfig.websearch.providers[providerId];
  if (wsProvider?.apiKey) return wsProvider.apiKey;

  return value; // Return placeholder if not resolved
}

/**
 * Resolve all env vars for an external MCP server.
 */
function resolveExternalServerEnv(server: ExternalMcpServer): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(server.envVars)) {
    resolved[key] = resolveEnvVar(value);
  }
  return resolved;
}

/**
 * Sync MCP servers for an instance into .claude.json.
 *
 * @param instancePath - Path to the instance directory
 * @param enabledServerNames - Names of servers to enable (from built-in + external)
 * @param profileName - Profile name, used to look up provider API keys
 */
export function syncInstanceMcpServers(
  instancePath: string,
  enabledServerNames: string[],
  _profileName?: string,
): void {
  const mcpServers: Record<string, McpServerConfig> = {};
  const instanceExternalEnabled = readInstanceExternalEnabled(instancePath);

  // Collect all enabled names: explicit list + per-instance external enables
  const allEnabled = new Set([...enabledServerNames, ...instanceExternalEnabled]);

  for (const name of allEnabled) {
    const server = getServerByName(name);
    if (!server) continue;

    if ('config' in server) {
      // Built-in server (has config field)
      mcpServers[name] = server.config;
    } else {
      // External server (ExternalMcpServer)
      const external = server as ExternalMcpServer;
      mcpServers[name] = {
        type: 'stdio',
        command: external.command,
        args: external.args,
        env: resolveExternalServerEnv(external),
      };
    }
  }

  // Write to .claude.json (Claude Code reads MCP config from here)
  const claudeJson = readClaudeJson(instancePath);
  claudeJson.mcpServers = mcpServers;
  writeClaudeJson(instancePath, claudeJson);

  // Also write to .mcp/mcpServers.json (for reference/compatibility)
  const mcpDir = path.join(instancePath, '.mcp');
  fs.mkdirSync(mcpDir, { recursive: true, mode: 0o700 });
  const configPath = path.join(mcpDir, 'mcpServers.json');
  fs.writeFileSync(configPath, JSON.stringify(mcpServers, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });

  if (isDebugEnabled()) {
    const count = Object.keys(mcpServers).length;
    console.log(`  ${pc.dim('mcp')}       ${pc.dim(`${count} server(s) synced`)}`);
  }
}

/**
 * Enable an external MCP for a specific instance.
 */
export function enableInstanceExternalMcp(instancePath: string, name: string): void {
  const enabled = readInstanceExternalEnabled(instancePath);
  if (!enabled.includes(name)) {
    enabled.push(name);
    writeInstanceExternalEnabled(instancePath, enabled);
  }
}

/**
 * Disable an external MCP for a specific instance.
 */
export function disableInstanceExternalMcp(instancePath: string, name: string): void {
  const enabled = readInstanceExternalEnabled(instancePath);
  writeInstanceExternalEnabled(
    instancePath,
    enabled.filter((n) => n !== name),
  );
}

/**
 * Get all known server names (built-in + external).
 */
export function getAllServerNames(): string[] {
  const builtinNames = BUILTIN_MCP_SERVERS.map((s) => s.name);
  const externalNames = readExternalMcpRegistry().map((s) => s.name);
  return [...builtinNames, ...externalNames];
}
