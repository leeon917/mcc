/**
 * Update checker + one-shot upgrade command.
 *
 * - checkForUpdates() runs at startup. It defers to `update-notifier`, which
 *   forks a child to query the npm registry and caches the result for a day.
 *   The notification is printed on the NEXT run (defer:false here makes it
 *   print at process exit of the current run if a cached result is already
 *   present).
 *
 * - runUpdate() detects how the binary was installed (npm/pnpm/yarn/bun) and
 *   invokes the matching `add -g` command. Detection is a path heuristic; the
 *   user can override via ~/.mcc/config.json { "packageManager": "pnpm" }.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import pc from 'picocolors';
import updateNotifier from 'update-notifier';
import { isUpdateCheckEnabled, readConfig, writeConfig } from './shared/config';

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

const PKG_NAME = '@hileeon/mcc';

export function checkForUpdates(currentVersion: string): void {
  if (!isUpdateCheckEnabled()) return;
  if (process.env.CI || process.env.MCC_NO_UPDATE_NOTIFIER) return;

  try {
    const notifier = updateNotifier({
      pkg: { name: PKG_NAME, version: currentVersion },
      updateCheckInterval: 1000 * 60 * 60 * 24, // 1 day
      shouldNotifyInNpmScript: false,
    });

    if (notifier.update) {
      notifier.notify({
        defer: false,
        isGlobal: true,
        message:
          `Update available ${pc.dim('{currentVersion}')} → ${pc.green('{latestVersion}')}\n` +
          `Run ${pc.cyan('mcc update')} to upgrade\n` +
          `${pc.dim('Disable with `mcc update-check off`')}`,
      });
    }
  } catch {
    // Network failures, registry errors, etc. — never block the CLI.
  }
}

/**
 * Heuristic detection of which global package manager owns this binary.
 *
 * We look at the directory `mcc.js` is running from. pnpm puts globals under
 * `.../pnpm/...`, yarn classic under `.../Yarn/...` or `.yarn/global`, bun
 * under `.bun/install/global`. Everything else we assume npm. User can pin
 * the answer in ~/.mcc/config.json if the heuristic guesses wrong.
 */
export function detectPackageManager(): PackageManager {
  const override = readConfig().packageManager;
  if (override) return override;

  const dir = __dirname.toLowerCase();
  if (dir.includes(`${path.sep}pnpm${path.sep}`) || dir.includes('/pnpm/')) return 'pnpm';
  if (dir.includes(`${path.sep}.bun${path.sep}`) || dir.includes('/.bun/')) return 'bun';
  if (dir.includes(`${path.sep}yarn${path.sep}`) || dir.includes('/yarn/') || dir.includes('.yarn/global')) return 'yarn';
  return 'npm';
}

function buildInstallCommand(pm: PackageManager, target: string): { cmd: string; args: string[] } {
  switch (pm) {
    case 'pnpm': return { cmd: 'pnpm', args: ['add', '-g', target] };
    case 'yarn': return { cmd: 'yarn', args: ['global', 'add', target] };
    case 'bun':  return { cmd: 'bun',  args: ['add', '-g', target] };
    case 'npm':
    default:     return { cmd: 'npm',  args: ['install', '-g', target] };
  }
}

export async function runUpdate(opts: { checkOnly?: boolean; pmOverride?: PackageManager } = {}): Promise<void> {
  const pm = opts.pmOverride ?? detectPackageManager();

  if (opts.checkOnly) {
    // Force a synchronous check by asking update-notifier directly. We do this
    // via fetchInfo() so we don't depend on the deferred notification path.
    const notifier = updateNotifier({
      pkg: { name: PKG_NAME, version: getOwnVersion() },
      updateCheckInterval: 0,
    });
    try {
      const info = await notifier.fetchInfo();
      if (info.type === 'latest') {
        console.log(`${pc.green('✓')} mcc is up to date (${info.current})`);
      } else {
        console.log(`${pc.yellow('!')} Update available: ${pc.dim(info.current)} → ${pc.green(info.latest)}`);
        console.log(`  Run ${pc.cyan('mcc update')} to upgrade`);
      }
    } catch (e) {
      console.error(`[!] Could not reach the npm registry: ${(e as Error).message}`);
      process.exit(1);
    }
    return;
  }

  const target = `${PKG_NAME}@latest`;
  const { cmd, args } = buildInstallCommand(pm, target);
  console.log(`${pc.cyan('●')} Upgrading via ${pc.bold(pm)}: ${pc.dim(`${cmd} ${args.join(' ')}`)}`);

  const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') {
      console.error(`[!] ${cmd} not found on PATH.`);
      console.error(`    If you installed mcc with a different package manager, pin it in ~/.mcc/config.json:`);
      console.error(`      { "packageManager": "npm" | "pnpm" | "yarn" | "bun" }`);
    } else {
      console.error(`[!] Upgrade failed: ${err.message}`);
    }
    process.exit(1);
  });
  child.on('exit', (code) => {
    if (code === 0) {
      console.log(`\n${pc.green('✓')} mcc upgraded. Run ${pc.cyan('mcc -v')} to confirm.`);
    } else {
      console.error(`\n[!] ${cmd} exited with code ${code}.`);
      if (process.platform !== 'win32' && pm === 'npm') {
        console.error(`    If this was a permission error, try: ${pc.cyan(`sudo npm install -g ${target}`)}`);
        console.error(`    Or switch to a node version manager (nvm / volta / fnm) to avoid sudo.`);
      }
    }
    process.exit(code ?? 0);
  });
}

function getOwnVersion(): string {
  try {
    // dist/update.js -> ../package.json
    const pkg = require(path.join(__dirname, '..', 'package.json'));
    return pkg.version as string;
  } catch {
    return '0.0.0';
  }
}

export function setUpdateCheckCmd(arg: string | undefined): void {
  if (!arg) {
    console.log(`update check is currently ${isUpdateCheckEnabled() ? pc.green('on') : pc.dim('off')}`);
    console.log(`  Usage: ${pc.cyan('mcc update-check on')} | ${pc.cyan('mcc update-check off')}`);
    return;
  }
  if (arg !== 'on' && arg !== 'off') {
    console.error(`[!] Usage: mcc update-check on|off`);
    process.exit(1);
  }
  const cfg = readConfig();
  cfg.updateCheck = arg === 'on';
  writeConfig(cfg);
  console.log(`${pc.green('✓')} update check ${arg === 'on' ? 'enabled' : 'disabled'}`);
}
