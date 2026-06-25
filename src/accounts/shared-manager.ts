/**
 * SharedManager - Symlink management for shared directories
 * Ported from CCS management/shared-manager.js (simplified)
 *
 * Creates symlinks: ~/.mcc/instances/<name>/<item> -> ~/.claude/<item>
 * so that skills, commands, agents, plugins, and settings are shared across instances.
 */

import * as fs from 'fs';
import * as path from 'path';
import pc from 'picocolors';

function getHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '~';
}

interface SharedItem {
  name: string;
  type: 'directory' | 'file';
}

// NOTE: settings.json is intentionally NOT shared via symlink. Each instance
// gets its OWN real settings.json (see writeInstanceSettings) so we can inject a
// per-profile `env` block with ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN. Interactive
// Claude Code only trusts auth declared in settings.json's `env` block — auth passed
// purely via the spawned process env is ignored and triggers a `/login` prompt. The
// instance settings still mirror the global file's contents (regenerated each launch),
// so skills/hooks/theme stay consistent across profiles.
const SHARED_ITEMS: readonly SharedItem[] = [
  { name: 'commands', type: 'directory' },
  { name: 'skills', type: 'directory' },
  { name: 'agents', type: 'directory' },
  { name: 'plugins', type: 'directory' },
];

export class SharedManager {
  private claudeDir: string;

  constructor() {
    this.claudeDir = path.join(getHome(), '.claude');
  }

  /**
   * Link shared directories to an instance.
   * Creates symlinks from instance/<item> -> ~/.claude/<item>
   */
  linkSharedDirectories(instancePath: string): void {
    const linked: string[] = [];
    for (const item of SHARED_ITEMS) {
      const claudePath = path.join(this.claudeDir, item.name);
      const linkPath = path.join(instancePath, item.name);

      // Ensure source exists in ~/.claude/
      if (!this.pathExists(claudePath)) {
        if (item.type === 'directory') {
          fs.mkdirSync(claudePath, { recursive: true, mode: 0o700 });
        } else {
          fs.writeFileSync(claudePath, '{}', 'utf8');
        }
      }

      // Skip if already a symlink pointing to the correct target
      if (this.isCorrectSymlink(linkPath, claudePath)) {
        continue;
      }

      // Remove existing path (file, dir, or stale symlink)
      this.removeExisting(linkPath, item.type);

      // Create symlink
      try {
        const symlinkType = item.type === 'directory' ? 'dir' : 'file';
        fs.symlinkSync(claudePath, linkPath, symlinkType);
        linked.push(item.name);
      } catch (_err) {
        // Windows fallback: copy if symlink fails (Developer Mode not enabled)
        if (process.platform === 'win32') {
          if (item.type === 'directory') {
            this.copyDirectoryFallback(claudePath, linkPath);
          } else {
            fs.copyFileSync(claudePath, linkPath);
          }
          console.warn(`[!] Symlink failed for ${item.name}, copied instead (enable Developer Mode for symlinks)`);
          linked.push(`${item.name} (copied)`);
        } else {
          throw _err;
        }
      }
    }
    if (linked.length > 0) {
      console.log(`  ${pc.dim('shared')}   ${pc.dim(linked.join(', '))}`);
    }
  }

  /**
   * Write the instance's own settings.json = global settings + a per-profile
   * `env` block carrying auth (ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN/model).
   *
   * Why a real file instead of the old symlink: interactive Claude Code only
   * honors ANTHROPIC_AUTH_TOKEN when it is declared in settings.json's `env`
   * block. Auth passed solely through the spawned process env is treated as
   * untrusted and the TUI falls back to "Not logged in · Please run /login"
   * (whereas `claude -p` accepts the process env directly). Regenerated on every
   * launch so it always mirrors the current global settings and proxy token.
   */
  writeInstanceSettings(instancePath: string, authEnv: Record<string, string>): void {
    const globalSettingsPath = path.join(this.claudeDir, 'settings.json');
    let base: Record<string, unknown> = {};
    if (this.pathExists(globalSettingsPath)) {
      try {
        base = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf8')) as Record<string, unknown>;
      } catch {
        base = {};
      }
    }
    const existingEnv = (base.env && typeof base.env === 'object') ? (base.env as Record<string, string>) : {};
    const merged = { ...base, env: { ...existingEnv, ...authEnv } };

    const target = path.join(instancePath, 'settings.json');
    // Older mcc versions symlinked this file — replace any symlink/file with a real one.
    this.removeExisting(target, 'file');
    fs.writeFileSync(target, JSON.stringify(merged, null, 2), 'utf8');
  }

  /**
   * Remove symlinks from an instance (cleanup).
   */
  unlinkSharedDirectories(instancePath: string): void {
    for (const item of SHARED_ITEMS) {
      const linkPath = path.join(instancePath, item.name);
      if (!this.pathExists(linkPath)) continue;

      try {
        const stats = fs.lstatSync(linkPath);
        if (stats.isSymbolicLink()) {
          fs.unlinkSync(linkPath);
        }
      } catch {
        // Best-effort
      }
    }
  }

  private pathExists(p: string): boolean {
    try {
      fs.lstatSync(p);
      return true;
    } catch {
      return false;
    }
  }

  private isCorrectSymlink(linkPath: string, expectedTarget: string): boolean {
    try {
      const stats = fs.lstatSync(linkPath);
      if (!stats.isSymbolicLink()) return false;
      const currentTarget = fs.readlinkSync(linkPath);
      const resolved = path.resolve(path.dirname(linkPath), currentTarget);
      return resolved === expectedTarget;
    } catch {
      return false;
    }
  }

  private removeExisting(p: string, type: 'directory' | 'file'): void {
    if (!this.pathExists(p)) return;
    if (type === 'directory') {
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      try {
        fs.unlinkSync(p);
      } catch {
        fs.rmSync(p, { force: true });
      }
    }
  }

  private copyDirectoryFallback(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirectoryFallback(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
