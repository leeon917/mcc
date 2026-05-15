/**
 * MCC - My Cloud Code
 *
 * Simplified CLI for multi-provider profile switching.
 * No OAuth, no local proxy - uses provider's direct API.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import {
  listProfiles,
  getProfile,
  getProfileApiKey,
  saveProfile,
  deleteProfile,
  setDefaultProfile,
  getDefaultProfile,
  hasProfile,
  type Profile,
} from './accounts/store';
import { MCCInstanceManager } from './accounts/instance-manager';
import { buildProfileEnv } from './core/model-router';
import {
  installBuiltinServers,
  syncInstanceMcpServers,
  enableInstanceExternalMcp,
  disableInstanceExternalMcp,
} from './mcp/installer';
import { BUILTIN_MCP_SERVERS, getAllServers } from './mcp/registry';
import {
  readExternalMcpRegistry,
  addExternalMcpServer,
  removeExternalMcpServer,
  type ExternalMcpServer,
} from './mcp/external-registry';
import { startProxy } from './proxy/proxy-daemon';
import { log, init, makeSessionId } from './shared/logger';

const instanceMgr = new MCCInstanceManager();

function showHelp(): void {
  console.log(`
MCC - My Cloud Code

Usage: mcc <profile> [args...]   Launch Claude Code with a profile
       mcc profile add <name>      Add a new profile
       mcc profile list            List all profiles
       mcc profile remove <name>   Remove a profile
       mcc profile default [name] Get or set default profile
       mcc mcp list               List all MCP servers
       mcc mcp add <name>         Add external MCP server
       mcc mcp remove <name>      Remove external MCP server
       mcc mcp enable <name>       Enable external MCP for profile
       mcc mcp disable <name>      Disable external MCP for profile
       mcc dashboard               Open the web dashboard
       mcc help                   Show this help

Examples:
  mcc profile add prod --base-url https://api.deepseek.com/anthropic --api-key sk-xxxx --model deepseek-chat
  mcc profile add minimax --base-url https://api.minimax.com --api-key sk-xxxx --model MiniMax-Text-01 --protocol openai
  mcc mcp add minimax-plan --display-name "MiniMax Token Plan" --command uvx --args "minimax-coding-plan-mcp,-y" --provider-ref minimax
  mcc prod
  mcc dashboard
`.trim());
}

async function cmdLaunch(args: string[]): Promise<void> {
  const profileName = args[0];
  if (!profileName) {
    console.error('[!] Usage: mcc <profile> [args...]');
    process.exit(1);
  }

  const profile = getProfile(profileName);
  if (!profile) {
    console.error(`[!] Profile not found: ${profileName}`);
    console.error('[i] Available profiles:');
    for (const p of listProfiles()) {
      console.error(`  - ${p.name} (baseUrl: ${p.baseUrl})`);
    }
    process.exit(1);
  }

  const apiKey = getProfileApiKey(profileName);
  if (!apiKey) {
    console.error(`[!] No API key found for profile: ${profileName}`);
    process.exit(1);
  }

  const instancePath = await instanceMgr.ensureInstance(profileName);
  syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((s) => s.name), profileName);

  // Initialize logging session
  const sessionId = makeSessionId();
  const logDir = init(sessionId);
  log.info('MCC', `Session starting: ${profileName} | log: ${logDir}`);

  const env = buildProfileEnv(profile, apiKey, instancePath);
  env.MCC_CURRENT_PROFILE = profileName;
  env.MCC_LOG_SESSION_ID = sessionId;
  env.MCC_LOG_DIR = logDir;

  // Start translation proxy for OpenAI-compatible profiles
  if (profile.protocol === 'openai') {
    try {
      const proxyInfo = await startProxy(profileName, profile.baseUrl, apiKey, profile.model);
      env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${proxyInfo.port}`;
      env.ANTHROPIC_AUTH_TOKEN = proxyInfo.authToken;
      // MCP image analysis also needs to go through the proxy
      env.MCC_IMAGE_ANALYSIS_RUNTIME_BASE_URL = `http://127.0.0.1:${proxyInfo.port}`;
      env.MCC_IMAGE_ANALYSIS_RUNTIME_API_KEY = proxyInfo.authToken;
      console.log(`[i] Translation proxy started on port ${proxyInfo.port}`);
    } catch (e) {
      console.error(`[!] Failed to start translation proxy: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  const remainingArgs = args.slice(1);
  const child = spawn('claude', remainingArgs, {
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}

async function cmdProfileAdd(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error('[!] Usage: mcc profile add <name> --base-url <url> --api-key <key> --model <model> [--protocol anthropic|openai] [--opus-model <m>] [--sonnet-model <m>] [--haiku-model <m>]');
    process.exit(1);
  }

  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const baseUrl = getArg('--base-url');
  const apiKey = getArg('--api-key');
  const model = getArg('--model') ?? 'claude-sonnet-4-6';
  const protocol = (getArg('--protocol') as 'anthropic' | 'openai') ?? 'anthropic';

  if (!baseUrl || !apiKey) {
    console.error('[!] --base-url and --api-key are required');
    process.exit(1);
  }

  if (protocol !== 'anthropic' && protocol !== 'openai') {
    console.error('[!] --protocol must be "anthropic" or "openai"');
    process.exit(1);
  }

  const profile: Profile = {
    name,
    baseUrl,
    model,
    opusModel: getArg('--opus-model'),
    sonnetModel: getArg('--sonnet-model'),
    haikuModel: getArg('--haiku-model'),
    protocol,
    createdAt: new Date().toISOString(),
  };

  saveProfile(profile, apiKey);
  await instanceMgr.ensureInstance(name);
  const instancePath = instanceMgr.getInstancePath(name);
  syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((s) => s.name), name);

  console.log(`[OK] Profile created: ${name}`);
  console.log(`    Base URL: ${baseUrl}`);
  console.log(`    Model: ${model}`);
  console.log(`    Protocol: ${protocol}`);
  if (profile.opusModel) console.log(`    Opus: ${profile.opusModel}`);
  if (profile.sonnetModel) console.log(`    Sonnet: ${profile.sonnetModel}`);
  if (profile.haikuModel) console.log(`    Haiku: ${profile.haikuModel}`);
}

async function cmdProfileList(): Promise<void> {
  const profiles = listProfiles();
  const defaultProfile = getDefaultProfile();

  if (profiles.length === 0) {
    console.log('[i] No profiles. Run: mcc profile add <name> --base-url <url> --api-key <key> --model <model>');
    return;
  }

  console.log('Profiles:');
  for (const p of profiles) {
    const marker = p.name === defaultProfile ? ' (default)' : '';
    console.log(`  ${p.name}${marker}`);
    console.log(`    Base URL: ${p.baseUrl}`);
    console.log(`    Model: ${p.model}`);
    console.log(`    Protocol: ${p.protocol || 'anthropic'}`);
    if (p.opusModel) console.log(`    Opus: ${p.opusModel}`);
    if (p.sonnetModel) console.log(`    Sonnet: ${p.sonnetModel}`);
    if (p.haikuModel) console.log(`    Haiku: ${p.haikuModel}`);
    console.log();
  }
}

async function cmdProfileRemove(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error('[!] Usage: mcc profile remove <name>');
    process.exit(1);
  }
  if (!hasProfile(name)) {
    console.error(`[!] Profile not found: ${name}`);
    process.exit(1);
  }
  deleteProfile(name);
  await instanceMgr.deleteInstance(name);
  console.log(`[OK] Profile removed: ${name}`);
}

async function cmdProfileDefault(args: string[]): Promise<void> {
  const name = args[0];
  if (name) {
    if (!hasProfile(name)) {
      console.error(`[!] Profile not found: ${name}`);
      process.exit(1);
    }
    setDefaultProfile(name);
    console.log(`[OK] Default profile set: ${name}`);
  } else {
    const defaultProf = getDefaultProfile();
    console.log(defaultProf ? `Default profile: ${defaultProf}` : '[i] No default profile set');
  }
}

async function cmdMcpList(): Promise<void> {
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

async function cmdMcpAdd(args: string[]): Promise<void> {
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const getBoolArg = (flag: string) => args.includes(flag);

  const name = getArg('--name');
  const displayName = getArg('--display-name') ?? name ?? '';
  const description = getArg('--description') ?? '';
  const command = getArg('--command') ?? 'uvx';
  const argsStr = getArg('--args') ?? '';
  const argsList = argsStr ? argsStr.split(',').map((s) => s.trim()) : [];
  const providerRef = getArg('--provider-ref');
  const enabledByDefault = getBoolArg('--enabled-by-default');

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

async function cmdMcpRemove(args: string[]): Promise<void> {
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

async function cmdMcpEnable(args: string[]): Promise<void> {
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

async function cmdMcpDisable(args: string[]): Promise<void> {
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

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0 || rawArgs[0] === 'help') {
    showHelp();
    return;
  }

  installBuiltinServers();

  const command = rawArgs[0];
  const args = rawArgs.slice(1);

  switch (command) {
    // mcc <profile> - launch with profile
    case 'profile':
      switch (args[0]) {
        case 'add': await cmdProfileAdd(args.slice(1)); break;
        case 'list': await cmdProfileList(); break;
        case 'remove': await cmdProfileRemove(args.slice(1)); break;
        case 'default': await cmdProfileDefault(args.slice(1)); break;
        default:
          console.error(`[!] Unknown profile command: ${args[0]}`);
          showHelp();
          process.exit(1);
      }
      break;
    case 'dashboard': {
      spawn('node', [path.join(__dirname, 'dashboard-server.js')], {
        env: process.env,
        stdio: 'inherit',
      });
      break;
    }
    case 'mcp': {
      const sub = args[0];
      const subArgs = args.slice(1);
      switch (sub) {
        case 'list': await cmdMcpList(); break;
        case 'add': await cmdMcpAdd(subArgs); break;
        case 'remove': await cmdMcpRemove(subArgs); break;
        case 'enable': await cmdMcpEnable(subArgs); break;
        case 'disable': await cmdMcpDisable(subArgs); break;
        default:
          console.error(`[!] Unknown mcp command: ${sub}`);
          showHelp();
          process.exit(1);
      }
      break;
    }
    default:
      // Treat as profile launch
      await cmdLaunch(rawArgs);
  }
}

main().catch((err) => {
  console.error(`[!] Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
