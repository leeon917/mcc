/**
 * Instance Manager - Account isolation via CLAUDE_CONFIG_DIR
 */

import * as fs from 'fs';
import * as path from 'path';

function getMccHome(): string {
  return process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
}

function getInstancesDir(): string {
  return path.join(getMccHome(), 'instances');
}

export class MCCInstanceManager {
  async ensureInstance(accountName: string): Promise<string> {
    const instancePath = this.getInstancePath(accountName);
    if (!fs.existsSync(instancePath)) {
      fs.mkdirSync(instancePath, { recursive: true, mode: 0o700 });
      const subdirs = ['session-env', 'todos', 'logs', 'file-history', 'shell-snapshots', 'debug', '.anthropic'];
      for (const dir of subdirs) {
        fs.mkdirSync(path.join(instancePath, dir), { recursive: true, mode: 0o700 });
      }
    }
    return instancePath;
  }

  getInstancePath(accountName: string): string {
    const safeName = accountName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    return path.join(getInstancesDir(), safeName);
  }

  async deleteInstance(accountName: string): Promise<void> {
    const instancePath = this.getInstancePath(accountName);
    if (fs.existsSync(instancePath)) {
      fs.rmSync(instancePath, { recursive: true, force: true });
    }
  }

  listInstances(): string[] {
    const instancesDir = getInstancesDir();
    if (!fs.existsSync(instancesDir)) return [];
    return fs.readdirSync(instancesDir).filter((name) => {
      if (name.startsWith('.')) return false;
      return fs.statSync(path.join(instancesDir, name)).isDirectory();
    });
  }

  hasInstance(accountName: string): boolean {
    return fs.existsSync(this.getInstancePath(accountName));
  }
}
