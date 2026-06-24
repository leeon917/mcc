/**
 * Update checker + one-shot upgrade command.
 *
 * Why not `update-notifier`? Its background-check path proved unreliable here:
 * the detached child it spawns to query the registry never persisted a result
 * to configstore, so the "update available" banner effectively never fired —
 * and even when it works it's deferred by one run and rate-limited to once/day,
 * so a freshly published version isn't noticed for up to a day. We replaced it
 * with a self-managed check:
 *
 * - checkForUpdates() runs at startup. It reads a small cache
 *   (~/.mcc/update-cache.json). If the cache already knows a newer version, the
 *   banner prints on THIS run (registered at process 'exit' so it lands on the
 *   clean shell prompt after Claude's TUI closes — not buried under it). If the
 *   cache is stale, it kicks off an in-process registry fetch that writes the
 *   cache. The fetch's socket is unref'd, so it never delays a fast command
 *   like `mcc -v`; on the long-lived `mcc <profile>` launch path the spawned
 *   `claude` keeps the event loop alive, so the fetch completes and the cache
 *   refreshes for next time.
 *
 * - runUpdate() detects how the binary was installed (npm/pnpm/yarn/bun) and
 *   invokes the matching `add -g` command. Detection is a path heuristic; the
 *   user can override via ~/.mcc/config.json { "packageManager": "pnpm" }.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import pc from 'picocolors';
import { getMccHome, isUpdateCheckEnabled, readConfig, writeConfig } from './shared/config';

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

const PKG_NAME = '@hileeon/mcc';

// How long a cached registry result is trusted before we refresh in the
// background. The refresh is free (backgrounded + unref'd), so this is just a
// politeness throttle on registry hits, not a freshness ceiling the user feels.
const CHECK_INTERVAL_MS = 1000 * 60 * 60; // 1 hour

interface UpdateCache {
  lastCheck: number;
  latest: string;
}

function getCachePath(): string {
  return path.join(getMccHome(), 'update-cache.json');
}

function readCache(): UpdateCache | null {
  try {
    return JSON.parse(fs.readFileSync(getCachePath(), 'utf8')) as UpdateCache;
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCache): void {
  try {
    const home = getMccHome();
    if (!fs.existsSync(home)) fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(getCachePath(), JSON.stringify(cache));
  } catch {
    // Cache is best-effort; a write failure just means we re-check next run.
  }
}

/** Strict-enough semver compare for this project's plain x.y.z versions. */
function parseVersion(v: string): number[] {
  return v.split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
}

function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/**
 * Fetch the latest published version straight from the npm registry over native
 * https — no transitive dependency, no detached child. Resolves to null on any
 * failure (offline, registry error, timeout).
 *
 * `background: true` unref's the socket so a pending request never keeps a
 * fast-exiting command (e.g. `mcc -v`) alive — used by the startup check, where
 * the result is fire-and-forget. The awaited `mcc update --check` path must NOT
 * unref: with the promise suspended, an unref'd socket is the only thing left to
 * keep the loop alive, so Node would exit 0 before the fetch resolves.
 */
function fetchLatest(opts: { timeoutMs?: number; background?: boolean } = {}): Promise<string | null> {
  const { timeoutMs = 5000, background = false } = opts;
  return new Promise((resolve) => {
    // The `/latest` endpoint returns the latest dist-tag's manifest, which has
    // `.version`. Note: do NOT send the abbreviated-metadata Accept header here —
    // that content-type only applies to the full packument, and `/latest`
    // answers it with 406 Not Acceptable.
    const url = `https://registry.npmjs.org/${PKG_NAME.replace('/', '%2F')}/latest`;
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve((JSON.parse(body).version as string) ?? null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
    // For the background startup check, don't let an in-flight request hold the
    // process open on its own. (Never unref on the awaited path — see above.)
    if (background) req.on('socket', (s) => s.unref());
  });
}

let bannerArmed = false;

function armBanner(current: string, latest: string): void {
  if (bannerArmed) return;
  bannerArmed = true;
  // Print at exit so it lands on the clean shell prompt — after Claude's
  // full-screen TUI has closed — instead of scrolling away behind it.
  process.on('exit', () => {
    process.stderr.write(
      '\n' +
        `  ${pc.yellow('✨ Update available')} ${pc.dim(current)} → ${pc.green(latest)}\n` +
        `     Run ${pc.cyan('mcc update')} to upgrade  ${pc.dim('·')}  ` +
        `${pc.dim('silence with')} ${pc.cyan('mcc update-check off')}\n\n`,
    );
  });
}

export function checkForUpdates(currentVersion: string): void {
  if (!isUpdateCheckEnabled()) return;
  if (process.env.CI || process.env.MCC_NO_UPDATE_NOTIFIER) return;

  try {
    const cache = readCache();

    // If we already know about a newer version, surface it on this run.
    if (cache?.latest && isNewer(cache.latest, currentVersion)) {
      armBanner(currentVersion, cache.latest);
    }

    // Refresh in the background when the cache is missing or stale. Fire and
    // forget — unref'd, so it never delays exit.
    const stale = !cache || Date.now() - cache.lastCheck > CHECK_INTERVAL_MS;
    if (stale) {
      void fetchLatest({ background: true }).then((latest) => {
        if (latest) writeCache({ lastCheck: Date.now(), latest });
      });
    }
  } catch {
    // Never let the update check block or crash the CLI.
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
    const current = getOwnVersion();
    const latest = await fetchLatest();
    if (latest === null) {
      console.error(`[!] Could not reach the npm registry.`);
      process.exit(1);
    }
    if (isNewer(latest, current)) {
      console.log(`${pc.yellow('!')} Update available: ${pc.dim(current)} → ${pc.green(latest)}`);
      console.log(`  Run ${pc.cyan('mcc update')} to upgrade`);
    } else {
      console.log(`${pc.green('✓')} mcc is up to date (${current})`);
    }
    // Keep the cache warm so the next launch reflects what we just learned.
    writeCache({ lastCheck: Date.now(), latest });
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
      // Clear the stale "update available" cache so we don't nag post-upgrade.
      writeCache({ lastCheck: Date.now(), latest: getOwnVersion() });
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
