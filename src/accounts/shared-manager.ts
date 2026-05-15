/**
 * SharedManager - Symlink management for shared directories
 * Ported from CCS management/shared-manager.js (simplified)
 *
 * Creates symlinks: ~/.mcc/instances/<name>/<item> -> ~/.claude/<item>
 * so that skills, commands, agents, plugins, and settings are shared across instances.
 */

import * as fs from 'fs';
import * as path from 'path';

function getHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '~';
}

interface SharedItem {
  name: string;
  type: 'directory' | 'file';
}

const SHARED_ITEMS: readonly SharedItem[] = [
  { name: 'commands', type: 'directory' },
  { name: 'skills', type: 'directory' },
  { name: 'agents', type: 'directory' },
  { name: 'plugins', type: 'directory' },
  { name: 'settings.json', type: 'file' },
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
      } catch (_err) {
        // Windows fallback: copy if symlink fails (Developer Mode not enabled)
        if (process.platform === 'win32') {
          if (item.type === 'directory') {
            this.copyDirectoryFallback(claudePath, linkPath);
          } else {
            fs.copyFileSync(claudePath, linkPath);
          }
          console.warn(`[!] Symlink failed for ${item.name}, copied instead (enable Developer Mode for symlinks)`);
        } else {
          throw _err;
        }
      }
    }
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
