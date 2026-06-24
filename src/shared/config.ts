/**
 * MCC global config — ~/.mcc/config.json
 *
 * General per-user settings that don't belong in a profile. Today: the update
 * notifier toggle and the package-manager hint used by `mcc update`.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MccConfig {
  updateCheck?: boolean;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
}

export function getMccHome(): string {
  return process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
}

function getConfigPath(): string {
  return path.join(getMccHome(), 'config.json');
}

export function readConfig(): MccConfig {
  const p = getConfigPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as MccConfig;
  } catch {
    return {};
  }
}

export function writeConfig(cfg: MccConfig): void {
  const home = getMccHome();
  if (!fs.existsSync(home)) fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2));
}

export function isUpdateCheckEnabled(): boolean {
  return readConfig().updateCheck !== false;
}

export function setUpdateCheck(enabled: boolean): void {
  const cfg = readConfig();
  cfg.updateCheck = enabled;
  writeConfig(cfg);
}
