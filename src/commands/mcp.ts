/**
 * `mcc mcp <list|add|remove|enable|disable>` — external MCP server management.
 */

import { hasProfile } from '../accounts/store';
import { MCCInstanceManager } from '../accounts/instance-manager';
import {
  syncInstanceMcpServers,
  enableInstanceExternalMcp,
  disableInstanceExternalMcp,
} from '../mcp/installer';
import { BUILTIN_MCP_SERVERS, getAllServers } from '../mcp/registry';
import {
  readExternalMcpRegistry,
  addExternalMcpServer,
  removeExternalMcpServer,
  type ExternalMcpServer,
} from '../mcp/external-registry';

const instanceMgr = new MCCInstanceManager();

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

export async function cmdMcpList(): Promise<void> {
  const servers = getAllServers();
  console.log('MCP Servers:');
  for (const s of servers) {
    const isBuiltin = 'config' in s;
    const marker = isBuiltin && s.enabledByDefault ? ' (builtin, default)' : isBuiltin ? ' (builtin)' : '';
    console.log(`  ${s.name}${marker}`);
    console.log(`    ${s.displayName}: ${s.description}`);
    if (!isBuiltin) {
      const ext = s as ExternalMcpServer;
      console.log(`    Command: ${ext.command} ${ext.args.join(' ')}`);
    }
  }
}

export async function cmdMcpAdd(args: string[]): Promise<void> {
  const name = getFlag(args, '--name');
  const displayName = getFlag(args, '--display-name') ?? name ?? '';
  const description = getFlag(args, '--description') ?? '';
  const command = getFlag(args, '--command') ?? 'uvx';
  const argsStr = getFlag(args, '--args') ?? '';
  const argsList = argsStr ? argsStr.split(',').map((s) => s.trim()) : [];
  const providerRef = getFlag(args, '--provider-ref');
  const enabledByDefault = args.includes('--enabled-by-default');

  if (!name || !command) {
    console.error('[!] --name and --command are required');
    console.error('    Usage: mcc mcp add --name <id> --command <cmd> --args "<arg1>,<arg2>" [--display-name <name>] [--description <desc>] [--provider-ref <provider>] [--enabled-by-default]');
    process.exit(1);
  }

  const envVars: Record<string, string> = {};
  if (providerRef) {
    envVars.MINIMAX_API_KEY = `\${MCC_PROVIDER_KEY:${providerRef}}`;
    envVars.MINIMAX_API_HOST = 'https://api.minimaxi.com';
  }

  const server: ExternalMcpServer = {
    name,
    displayName,
    description,
    command,
    args: argsList,
    envVars,
    enabledByDefault,
  };
  addExternalMcpServer(server);
  console.log(`[OK] External MCP added: ${name}`);
}

export async function cmdMcpRemove(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error('[!] Usage: mcc mcp remove <name>');
    process.exit(1);
  }
  const existing = readExternalMcpRegistry().find((s) => s.name === name);
  if (!existing) {
    console.error(`[!] External MCP not found: ${name}`);
    process.exit(1);
  }
  removeExternalMcpServer(name);
  console.log(`[OK] External MCP removed: ${name}`);
}

export async function cmdMcpEnable(args: string[]): Promise<void> {
  const name = args[0];
  const profileName = args[1];
  if (!name || !profileName) {
    console.error('[!] Usage: mcc mcp enable <name> <profile>');
    process.exit(1);
  }
  if (!hasProfile(profileName)) {
    console.error(`[!] Profile not found: ${profileName}`);
    process.exit(1);
  }
  const instancePath = instanceMgr.getInstancePath(profileName);
  enableInstanceExternalMcp(instancePath, name);
  syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((s) => s.name), profileName);
  console.log(`[OK] External MCP '${name}' enabled for profile '${profileName}'`);
}

export async function cmdMcpDisable(args: string[]): Promise<void> {
  const name = args[0];
  const profileName = args[1];
  if (!name || !profileName) {
    console.error('[!] Usage: mcc mcp disable <name> <profile>');
    process.exit(1);
  }
  if (!hasProfile(profileName)) {
    console.error(`[!] Profile not found: ${profileName}`);
    process.exit(1);
  }
  const instancePath = instanceMgr.getInstancePath(profileName);
  disableInstanceExternalMcp(instancePath, name);
  syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((s) => s.name), profileName);
  console.log(`[OK] External MCP '${name}' disabled for profile '${profileName}'`);
}
