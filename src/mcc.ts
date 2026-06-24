#!/usr/bin/env node
/**
 * MCC - My Cloud Code
 *
 * CLI entry point: parses argv, prints help/version, dispatches to command
 * modules under src/commands/ (and the dashboard subprocess). Business logic
 * lives in those modules, not here.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { installBuiltinServers } from './mcp/installer';
import { checkForUpdates, runUpdate, setUpdateCheckCmd } from './update';
import { cmdLaunch } from './commands/launch';
import {
  cmdProfileAdd,
  cmdProfileList,
  cmdProfileRemove,
  cmdProfileDefault,
} from './commands/profile';
import {
  cmdMcpList,
  cmdMcpAdd,
  cmdMcpRemove,
  cmdMcpEnable,
  cmdMcpDisable,
} from './commands/mcp';

function readPkgVersion(): string {
  try {
    return (require(path.join(__dirname, '..', 'package.json')) as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

const PKG_VERSION = readPkgVersion();

function showVersion(): void {
  console.log(`@hileeon/mcc ${PKG_VERSION}`);
}

function showHelp(): void {
  console.log(`
MCC - My Cloud Code

Usage: mcc [mcc-options] <profile> [claude-options...]

  <profile>          Profile name to launch (required)
  [claude-options...]  All options after profile are passed directly to Claude Code

MCC Options:
  -h, --help          Show this help
  -v, --version       Show version number
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

  mcc update              Upgrade mcc to the latest version
  mcc update --check      Check for a new version without installing
  mcc update-check off    Disable the "update available" reminder (default: on)
`.trim());
}

function spawnDashboard(): void {
  spawn('node', [path.join(__dirname, 'dashboard', 'server.js')], {
    env: process.env,
    stdio: 'inherit',
  });
}

async function dispatchProfile(args: string[]): Promise<void> {
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
}

async function dispatchMcp(args: string[]): Promise<void> {
  switch (args[0]) {
    case 'list': await cmdMcpList(); break;
    case 'add': await cmdMcpAdd(args.slice(1)); break;
    case 'remove': await cmdMcpRemove(args.slice(1)); break;
    case 'enable': await cmdMcpEnable(args.slice(1)); break;
    case 'disable': await cmdMcpDisable(args.slice(1)); break;
    default:
      console.error(`[!] Unknown mcp command: ${args[0]}`);
      showHelp();
      process.exit(1);
  }
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  // Kick off the (async, cached) update check as early as possible so any
  // pending notification can print at process exit. No-op when disabled / in CI.
  checkForUpdates(PKG_VERSION);

  // Global flags — always intercepted regardless of position.
  if (rawArgs[0] === '-h' || rawArgs[0] === '--help') return showHelp();
  if (rawArgs[0] === '-v' || rawArgs[0] === '--version') return showVersion();
  if (rawArgs.length === 0) return showHelp();

  // Parse: mcc <profile> [claude-args...]
  // Explicit separator: mcc <profile> -- <claude-args...>
  // Everything after the first arg (the profile) is passed to Claude as-is.
  const dashIdx = rawArgs.indexOf('--');
  const profileArgs = dashIdx === -1 ? rawArgs : rawArgs.slice(0, dashIdx);
  const claudeArgs = dashIdx === -1 ? [] : rawArgs.slice(dashIdx); // includes '--'

  if (profileArgs.length === 0) return showHelp();

  installBuiltinServers();

  const command = profileArgs[0];
  const args = profileArgs.slice(1);

  switch (command) {
    case 'profile':   await dispatchProfile(args); break;
    case 'mcp':       await dispatchMcp(args); break;
    case 'dashboard': spawnDashboard(); break;
    case 'update':    await runUpdate({ checkOnly: args.includes('--check') }); break;
    case 'update-check': setUpdateCheckCmd(args[0]); break;
    default:
      // Treat unknown command as profile launch; pass profile name + claude args
      await cmdLaunch([command, ...args, ...claudeArgs]);
  }
}

main().catch((err) => {
  console.error(`[!] Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
