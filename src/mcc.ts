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
} from './mcp/installer';
import { BUILTIN_MCP_SERVERS } from './mcp/registry';

const instanceMgr = new MCCInstanceManager();

function showHelp(): void {
  console.log(`
MCC - My Cloud Code

Usage: mcc <profile> [args...]   Launch Claude Code with a profile
       mcc profile add <name>      Add a new profile
       mcc profile list            List all profiles
       mcc profile remove <name>   Remove a profile
       mcc profile default [name] Get or set default profile
       mcc dashboard               Open the web dashboard
       mcc help                   Show this help

Examples:
  mcc profile add prod --base-url https://api.deepseek.com/anthropic --api-key sk-xxxx --model deepseek-chat
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
  syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((s) => s.name));

  const env = buildProfileEnv(profile, apiKey, instancePath);

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
    console.error('[!] Usage: mcc profile add <name> --base-url <url> --api-key <key> --model <model> [--opus-model <m>] [--sonnet-model <m>] [--haiku-model <m>]');
    process.exit(1);
  }

  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const baseUrl = getArg('--base-url');
  const apiKey = getArg('--api-key');
  const model = getArg('--model') ?? 'claude-sonnet-4-6';

  if (!baseUrl || !apiKey) {
    console.error('[!] --base-url and --api-key are required');
    process.exit(1);
  }

  const profile: Profile = {
    name,
    baseUrl,
    model,
    opusModel: getArg('--opus-model'),
    sonnetModel: getArg('--sonnet-model'),
    haikuModel: getArg('--haiku-model'),
    createdAt: new Date().toISOString(),
  };

  saveProfile(profile, apiKey);
  await instanceMgr.ensureInstance(name);
  const instancePath = instanceMgr.getInstancePath(name);
  syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((s) => s.name));

  console.log(`[OK] Profile created: ${name}`);
  console.log(`    Base URL: ${baseUrl}`);
  console.log(`    Model: ${model}`);
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
    default:
      // Treat as profile launch
      await cmdLaunch(rawArgs);
  }
}

main().catch((err) => {
  console.error(`[!] Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
