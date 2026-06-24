/**
 * `mcc mcp <list|add|remove|enable|disable>` — external MCP server management.
 */

import * as fs from 'fs';
import * as path from 'path';
import { hasProfile, listProfiles } from '../accounts/store';
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
      const transport = ext.type ?? 'stdio';
      if (transport === 'http' || transport === 'sse') {
        console.log(`    ${transport.toUpperCase()}: ${ext.url ?? '(no url)'}`);
      } else {
        console.log(`    Command: ${ext.command ?? ''} ${(ext.args ?? []).join(' ')}`.trimEnd());
      }
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

/** Parse positional (non-flag) args, skipping values consumed by valued flags. */
function positionalArgs(args: string[], valuedFlags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (valuedFlags.includes(a)) {
      i++; // skip this flag's value
      continue;
    }
    if (a.startsWith('--')) continue;
    out.push(a);
  }
  return out;
}

function getGlobalClaudeJsonPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '~';
  return path.join(home, '.claude.json');
}

interface GlobalMcpServerCfg {
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

function toExternalServer(name: string, cfg: GlobalMcpServerCfg): ExternalMcpServer {
  const transport = (cfg.type as ExternalMcpServer['type']) ?? (cfg.url ? 'http' : 'stdio');
  const base = {
    name,
    displayName: name,
    description: 'Imported from global ~/.claude.json',
    enabledByDefault: false,
  };
  if (transport === 'http' || transport === 'sse') {
    return { ...base, type: transport, url: cfg.url, headers: cfg.headers ?? {} };
  }
  return { ...base, type: 'stdio', command: cfg.command, args: cfg.args ?? [], envVars: cfg.env ?? {} };
}

/**
 * `mcc mcp import-global [profile] [--all-profiles] [--only a,b] [--exclude a,b] [--include-ccs]`
 *
 * Imports the MCP servers from the user's global ~/.claude.json into MCC's
 * external registry and enables them on the target profile(s). Because MCC
 * rewrites each instance's .claude.json on every launch, importing via the
 * registry (not a manual edit) is what makes the servers survive relaunch.
 *
 * By default skips MCC builtins (mcc-*) and CCS-owned servers (ccs-*).
 */
export async function cmdMcpImportGlobal(args: string[]): Promise<void> {
  const allProfiles = args.includes('--all-profiles');
  const includeCcs = args.includes('--include-ccs');
  const only = getFlag(args, '--only');
  const exclude = getFlag(args, '--exclude');
  const onlySet = only ? new Set(only.split(',').map((s) => s.trim()).filter(Boolean)) : null;
  const excludeSet = new Set(exclude ? exclude.split(',').map((s) => s.trim()).filter(Boolean) : []);

  const positional = positionalArgs(args, ['--only', '--exclude']);
  const profileName = positional[0];

  if (!allProfiles && !profileName) {
    console.error('[!] Usage: mcc mcp import-global <profile> [--all-profiles] [--only a,b] [--exclude a,b] [--include-ccs]');
    process.exit(1);
  }

  // Resolve target profiles
  const targets = allProfiles ? listProfiles().map((p) => p.name) : [profileName];
  for (const t of targets) {
    if (!hasProfile(t)) {
      console.error(`[!] Profile not found: ${t}`);
      process.exit(1);
    }
  }
  if (targets.length === 0) {
    console.error('[!] No profiles to import into.');
    process.exit(1);
  }

  // Read global ~/.claude.json
  const globalPath = getGlobalClaudeJsonPath();
  if (!fs.existsSync(globalPath)) {
    console.error(`[!] Global config not found: ${globalPath}`);
    process.exit(1);
  }
  let globalServers: Record<string, GlobalMcpServerCfg>;
  try {
    const data = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
    globalServers = (data.mcpServers as Record<string, GlobalMcpServerCfg>) ?? {};
  } catch (e) {
    console.error(`[!] Failed to parse ${globalPath}: ${(e as Error).message}`);
    process.exit(1);
  }

  const builtinNames = new Set(BUILTIN_MCP_SERVERS.map((s) => s.name));
  const skipped: string[] = [];
  const picked: Array<[string, GlobalMcpServerCfg]> = [];

  for (const [name, cfg] of Object.entries(globalServers)) {
    if (builtinNames.has(name)) { skipped.push(`${name} (mcc builtin)`); continue; }
    if (onlySet) {
      if (!onlySet.has(name)) { skipped.push(`${name} (not in --only)`); continue; }
    } else {
      if (excludeSet.has(name)) { skipped.push(`${name} (--exclude)`); continue; }
      if (!includeCcs && name.startsWith('ccs-')) { skipped.push(`${name} (ccs-*, use --include-ccs)`); continue; }
    }
    picked.push([name, cfg]);
  }

  if (picked.length === 0) {
    console.log('[i] Nothing to import.');
    if (skipped.length > 0) console.log(`    Skipped: ${skipped.join(', ')}`);
    return;
  }

  // Register in external registry (idempotent upsert)
  for (const [name, cfg] of picked) {
    addExternalMcpServer(toExternalServer(name, cfg));
  }

  // Enable on each target profile + resync its .claude.json
  for (const profile of targets) {
    const instancePath = instanceMgr.getInstancePath(profile);
    for (const [name] of picked) {
      enableInstanceExternalMcp(instancePath, name);
    }
    syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((s) => s.name), profile);
  }

  const importedNames = picked.map(([n, cfg]) => {
    const t = (cfg.type as string) ?? (cfg.url ? 'http' : 'stdio');
    return `${n} [${t}]`;
  });
  console.log(`[OK] Imported ${picked.length} MCP server(s) into ${targets.length} profile(s).`);
  console.log(`    Servers:  ${importedNames.join(', ')}`);
  console.log(`    Profiles: ${targets.join(', ')}`);
  if (skipped.length > 0) console.log(`    Skipped:  ${skipped.join(', ')}`);
}
