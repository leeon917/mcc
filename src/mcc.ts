/**
 * MCC - My Cloud Code
 *
 * Simplified CLI for multi-provider account switching.
 * No OAuth, no local proxy - uses provider's direct API.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import {
  listAccounts,
  getAccount,
  getAccountApiKey,
  saveAccount,
  deleteAccount,
  setDefaultAccount,
  getDefaultAccount,
  hasAccount,
  type AccountInfo,
} from './accounts/store';
import { MCCInstanceManager } from './accounts/instance-manager';
import {
  getPresetById,
  buildDirectApiEnv,
  isValidMccPreset,
  listMccPresets,
} from './core/model-router';
import {
  installBuiltinServers,
  syncInstanceMcpServers,
} from './mcp/installer';
import { BUILTIN_MCP_SERVERS } from './mcp/registry';

const instanceMgr = new MCCInstanceManager();

function showHelp(): void {
  console.log(`
MCC - My Cloud Code

Usage: mcc <command> [options]

Commands:
  use <account>          Switch to account and run Claude Code
  account add <name>    Add a new account
  account list          List all accounts
  account remove <name> Remove an account
  account default [name] Get or set default account
  model list            List available provider presets
  mcp list              List MCP servers
  dashboard             Open the web dashboard
  help                  Show this help

Examples:
  mcc account add prod --provider deepseek --api-key sk-xxxx
  mcc use prod
  mcc model list
  mcc dashboard
`.trim());
}

async function cmdUse(args: string[]): Promise<void> {
  const accountName = args[0];
  if (!accountName) {
    console.error('[!] Usage: mcc use <account>');
    process.exit(1);
  }

  const account = getAccount(accountName);
  if (!account) {
    console.error(`[!] Account not found: ${accountName}`);
    console.error('[i] Available accounts:');
    for (const a of listAccounts()) {
      console.error(`  - ${a.name} (${a.provider})`);
    }
    process.exit(1);
  }

  const apiKey = getAccountApiKey(accountName);
  if (!apiKey) {
    console.error(`[!] No API key found for account: ${accountName}`);
    process.exit(1);
  }

  const preset = getPresetById(account.provider);
  if (!preset) {
    console.error(`[!] Unknown provider: ${account.provider}`);
    process.exit(1);
  }

  const env = buildDirectApiEnv(preset, apiKey, account.defaultModel);
  const instancePath = await instanceMgr.ensureInstance(accountName);
  syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((server) => server.name));
  const fullEnv = { ...env, CLAUDE_CONFIG_DIR: instancePath };

  const remainingArgs = args.slice(1);
  const child = spawn('claude', remainingArgs, {
    env: { ...process.env, ...fullEnv },
    stdio: 'inherit',
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}

async function cmdAccountAdd(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error('[!] Usage: mcc account add <name> --provider <provider> --api-key <key>');
    process.exit(1);
  }

  const providerIndex = args.indexOf('--provider');
  const apiKeyIndex = args.indexOf('--api-key');
  if (providerIndex === -1 || apiKeyIndex === -1) {
    console.error('[!] Usage: mcc account add <name> --provider <provider> --api-key <key>');
    process.exit(1);
  }

  const provider = args[providerIndex + 1];
  const apiKey = args[apiKeyIndex + 1];

  if (!isValidMccPreset(provider)) {
    console.error(`[!] Unknown provider: ${provider}`);
    console.error('[i] Available providers:');
    for (const p of listMccPresets()) {
      console.error(`  - ${p.id}: ${p.name}`);
    }
    process.exit(1);
  }

  const info: AccountInfo = {
    name,
    provider,
    createdAt: new Date().toISOString(),
  };

  saveAccount(info, apiKey);
  await instanceMgr.ensureInstance(name);
  const instancePath = instanceMgr.getInstancePath(name);
  syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((server) => server.name));

  console.log(`[OK] Account created: ${name} (${provider})`);
}

async function cmdAccountList(): Promise<void> {
  const accounts = listAccounts();
  const defaultAccount = getDefaultAccount();

  if (accounts.length === 0) {
    console.log('[i] No accounts. Run: mcc account add <name> --provider <provider> --api-key <key>');
    return;
  }

  console.log('Accounts:');
  for (const acc of accounts) {
    const marker = acc.name === defaultAccount ? ' (default)' : '';
    console.log(`  - ${acc.name} [${acc.provider}]${marker}`);
  }
}

async function cmdAccountRemove(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error('[!] Usage: mcc account remove <name>');
    process.exit(1);
  }
  if (!hasAccount(name)) {
    console.error(`[!] Account not found: ${name}`);
    process.exit(1);
  }
  deleteAccount(name);
  await instanceMgr.deleteInstance(name);
  console.log(`[OK] Account removed: ${name}`);
}

async function cmdAccountDefault(args: string[]): Promise<void> {
  const name = args[0];
  if (name) {
    if (!hasAccount(name)) {
      console.error(`[!] Account not found: ${name}`);
      process.exit(1);
    }
    setDefaultAccount(name);
    console.log(`[OK] Default account set: ${name}`);
  } else {
    const defaultAcc = getDefaultAccount();
    console.log(defaultAcc ? `Default account: ${defaultAcc}` : '[i] No default account set');
  }
}

async function cmdModelList(): Promise<void> {
  const presets = listMccPresets();
  console.log('Available provider presets:');
  for (const p of presets) {
    console.log(`  ${p.id}`);
    console.log(`    Name: ${p.name}`);
    console.log(`    Default model: ${p.defaultModel}`);
    console.log(`    Base URL: ${p.baseUrl || '(Anthropic direct)'}`);
    console.log(`    Description: ${p.description}`);
    console.log();
  }
}

async function cmdMcpList(): Promise<void> {
  console.log('Built-in MCP servers:');
  for (const server of BUILTIN_MCP_SERVERS) {
    console.log(`  ${server.name}`);
    console.log(`    Display: ${server.displayName}`);
    console.log(`    Description: ${server.description}`);
    console.log();
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
    case 'use':
      await cmdUse(args);
      break;
    case 'account':
      switch (args[0]) {
        case 'add': await cmdAccountAdd(args.slice(1)); break;
        case 'list': await cmdAccountList(); break;
        case 'remove': await cmdAccountRemove(args.slice(1)); break;
        case 'default': await cmdAccountDefault(args.slice(1)); break;
        default:
          console.error(`[!] Unknown account command: ${args[0]}`);
          showHelp();
          process.exit(1);
      }
      break;
    case 'model':
      if (args[0] === 'list') {
        await cmdModelList();
      } else {
        console.error(`[!] Unknown model command: ${args[0]}`);
        showHelp();
        process.exit(1);
      }
      break;
    case 'mcp':
      if (args[0] === 'list') {
        await cmdMcpList();
      } else {
        console.error(`[!] Unknown mcp command: ${args[0]}`);
        showHelp();
        process.exit(1);
      }
      break;
    case 'dashboard': {
      const { spawn } = await import('child_process');
      spawn('node', [path.join(__dirname, 'dashboard-server.js')], {
        env: process.env,
        stdio: 'inherit',
      });
      break;
    }
    default:
      console.error(`[!] Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[!] Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
