/**
 * `mcc profile <add|list|remove|default>` — profile lifecycle commands.
 */

import {
  listProfiles,
  saveProfile,
  deleteProfile,
  setDefaultProfile,
  getDefaultProfile,
  hasProfile,
  type Profile,
} from '../accounts/store';
import { MCCInstanceManager } from '../accounts/instance-manager';
import { syncInstanceMcpServers } from '../mcp/installer';
import { BUILTIN_MCP_SERVERS } from '../mcp/registry';

const instanceMgr = new MCCInstanceManager();

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

export async function cmdProfileAdd(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error('[!] Usage: mcc profile add <name> --base-url <url> --api-key <key> --model <model> [--protocol anthropic|openai] [--opus-model <m>] [--sonnet-model <m>] [--haiku-model <m>]');
    process.exit(1);
  }

  const baseUrl = getFlag(args, '--base-url');
  const apiKey = getFlag(args, '--api-key');
  const model = getFlag(args, '--model') ?? 'claude-sonnet-4-6';
  const protocol = (getFlag(args, '--protocol') as 'anthropic' | 'openai') ?? 'anthropic';
  const proxyChatCompletionsPath = getFlag(args, '--proxy-chat-completions-path');

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
    opusModel: getFlag(args, '--opus-model'),
    sonnetModel: getFlag(args, '--sonnet-model'),
    haikuModel: getFlag(args, '--haiku-model'),
    protocol,
    proxyChatCompletionsPath: proxyChatCompletionsPath || undefined,
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
  if (profile.proxyChatCompletionsPath) console.log(`    Proxy chat path: ${profile.proxyChatCompletionsPath}`);
}

export async function cmdProfileList(): Promise<void> {
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
    if (p.proxyChatCompletionsPath) console.log(`    Proxy chat path: ${p.proxyChatCompletionsPath}`);
    console.log();
  }
}

export async function cmdProfileRemove(args: string[]): Promise<void> {
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

export async function cmdProfileDefault(args: string[]): Promise<void> {
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
