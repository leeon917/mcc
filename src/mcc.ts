/**
 * MCC - My Cloud Code
 *
 * Simplified CLI for multi-provider profile switching.
 * No OAuth, no local proxy - uses provider's direct API.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import pc from 'picocolors';
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
import { log, init, makeSessionId, isDebugEnabled } from './shared/logger';
import { readMcpConfig, getEnabledWebSearchProviders, getActiveImageAnalysisProvider } from './mcp/mcp-config';

const instanceMgr = new MCCInstanceManager();

function showHelp(): void {
  console.log(`
MCC - My Cloud Code

Usage: mcc [mcc-options] <profile> [claude-options...]

  <profile>          Profile name to launch (required)
  [claude-options...]  All options after profile are passed directly to Claude Code

MCC Options:
  -h, --help          Show this help
  --                Explicit separator (everything after is for Claude Code)

  Note: All flags after <profile> are passed directly to Claude Code.

  Debug logging:  MCC_LOG_LEVEL=debug node dist/mcc.js deepseek

Examples:
  mcc deepseek                                    Interactive session
  mcc deepseek --print "hello"                   Non-interactive
  mcc deepseek --print "hello" --verbose         Claude Code verbose mode

  mcc profile add prod --base-url https://api.deepseek.com/anthropic --api-key sk-xxxx --model deepseek-chat
  mcc profile list
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

  const proto = profile.protocol || 'anthropic';
  console.log(`  ${pc.cyan(pc.bold('●'))} ${pc.bold(profileName)}  ${pc.dim('·')}  ${pc.cyan(profile.model)}  ${pc.dim('·')}  ${pc.dim(proto)}`);

  const apiKey = getProfileApiKey(profileName);
  if (!apiKey) {
    console.error(`[!] No API key found for profile: ${profileName}`);
    process.exit(1);
  }

  // Read MCP config early so we can display provider info
  const mcpConfig = readMcpConfig();
  const wsProviders = getEnabledWebSearchProviders(mcpConfig);
  const iaProvider = getActiveImageAnalysisProvider(mcpConfig);

  const instancePath = await instanceMgr.ensureInstance(profileName);
  console.log(`  ${pc.dim('instance')}  ${pc.dim(instancePath)}`);

  syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((s) => s.name), profileName);

  // Initialize logging session
  const sessionId = makeSessionId();
  const mccHome = process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
  const logDir = path.join(mccHome, 'logs', profileName, sessionId);
  init(sessionId, logDir);
  log.info('MCC', `Session starting: ${profileName} | log: ${logDir}`);
  console.log(`  ${pc.dim('session')}   ${pc.dim(sessionId)}`);

  // MCP provider summary
  if (wsProviders.length > 0) {
    console.log(`  ${pc.dim('websearch')}      ${pc.dim(wsProviders.join(', '))}`);
  } else if (mcpConfig.websearch.enabled) {
    console.log(`  ${pc.dim('websearch')}      ${pc.dim('none enabled')}`);
  }
  if (mcpConfig.imageAnalysis.enabled) {
    if (iaProvider) {
      console.log(`  ${pc.dim('image')}   ${pc.dim(iaProvider.id)} ${pc.dim('·')} ${pc.cyan(iaProvider.model)}`);
    } else {
      console.log(`  ${pc.dim('image')}   ${pc.dim('no active provider')}`);
    }
  }

  const env = buildProfileEnv(profile, apiKey, instancePath);
  env.MCC_CURRENT_PROFILE = profileName;
  env.MCC_LOG_SESSION_ID = sessionId;
  env.MCC_LOG_DIR = logDir;

  // Debug: key env vars (no secrets)
  if (isDebugEnabled()) {
    const debugEnvs: [string, string][] = [
      ['ANTHROPIC_BASE_URL', env.ANTHROPIC_BASE_URL],
      ['ANTHROPIC_MODEL', env.ANTHROPIC_MODEL],
      ['CLAUDE_CONFIG_DIR', env.CLAUDE_CONFIG_DIR],
      ['MCC_WEBSEARCH_ENABLED', env.MCC_WEBSEARCH_ENABLED || '0'],
      ['MCC_IMAGE_ANALYSIS_ENABLED', env.MCC_IMAGE_ANALYSIS_ENABLED || '0'],
    ];
    if (env.ANTHROPIC_DEFAULT_OPUS_MODEL !== env.ANTHROPIC_MODEL)
      debugEnvs.push(['ANTHROPIC_DEFAULT_OPUS_MODEL', env.ANTHROPIC_DEFAULT_OPUS_MODEL]);
    if (env.ANTHROPIC_DEFAULT_SONNET_MODEL !== env.ANTHROPIC_MODEL)
      debugEnvs.push(['ANTHROPIC_DEFAULT_SONNET_MODEL', env.ANTHROPIC_DEFAULT_SONNET_MODEL]);
    if (env.ANTHROPIC_DEFAULT_HAIKU_MODEL !== env.ANTHROPIC_MODEL)
      debugEnvs.push(['ANTHROPIC_DEFAULT_HAIKU_MODEL', env.ANTHROPIC_DEFAULT_HAIKU_MODEL]);

    console.log(`  ${pc.dim('---')}`);
    for (const [k, v] of debugEnvs) {
      console.log(`  ${pc.dim('env')}       ${pc.dim(k)}=${pc.dim(v)}`);
    }
  }

  // Start translation proxy for OpenAI-compatible profiles
  if (profile.protocol === 'openai') {
    try {
      const proxyInfo = await startProxy(profileName, profile.baseUrl, apiKey, profile.model);
      env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${proxyInfo.port}`;
      env.ANTHROPIC_AUTH_TOKEN = proxyInfo.authToken;
      // MCP image analysis also needs to go through the proxy
      env.MCC_IMAGE_ANALYSIS_RUNTIME_BASE_URL = `http://127.0.0.1:${proxyInfo.port}`;
      env.MCC_IMAGE_ANALYSIS_RUNTIME_API_KEY = proxyInfo.authToken;
      console.log(`  ${pc.dim('proxy')}     ${pc.cyan(`:${proxyInfo.port}`)}`);
    } catch (e) {
      console.error(`[!] Failed to start translation proxy: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  console.log(`\n  ${pc.green('✓')} ${pc.bold('launching Claude Code')}`);
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

  // -h / --help
  if (rawArgs[0] === '-h' || rawArgs[0] === '--help' || rawArgs.length === 0) {
    showHelp();
    return;
  }

  // Simple parse: first arg is the profile, everything after goes to Claude
  // Use -- to explicitly separate: mcc deepseek -- --print "hello"
  const remaining: string[] = [];
  let i = 0;
  while (i < rawArgs.length) {
    const arg = rawArgs[i];
    if (arg === '--') {
      // Explicit separator: rest goes to Claude (including --)
      remaining.push(...rawArgs.slice(i));
      break;
    } else {
      // First non-flag = profile; everything after it (incl. flags) goes to Claude
      remaining.push(...rawArgs.slice(i));
      break;
    }
  }

  if (remaining.length === 0) {
    showHelp();
    return;
  }

  installBuiltinServers();

  const command = remaining[0];
  const args = remaining.slice(1);

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
