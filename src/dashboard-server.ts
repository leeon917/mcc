/**
 * Dashboard Server - Express API + static file server
 */

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

const PORT = 3000;
const DIST_DIR = path.join(__dirname, '..', 'ui', 'dist');

async function importModule<T>(modulePath: string, fn: string): Promise<T> {
  const mod = await import(modulePath);
  return (mod as Record<string, T>)[fn] as T;
}

async function getAccountsList() {
  const fn = await importModule<() => ReturnType<typeof import('./accounts/store').listAccounts>>(
    './accounts/store',
    'listAccounts'
  );
  return fn();
}

async function getAccount(name: string) {
  const fn = await importModule<typeof import('./accounts/store').getAccount>(
    './accounts/store',
    'getAccount'
  );
  return fn(name);
}

async function saveAccount(info: Parameters<typeof import('./accounts/store').saveAccount>[0], apiKey: string) {
  const fn = await importModule<typeof import('./accounts/store').saveAccount>(
    './accounts/store',
    'saveAccount'
  );
  return fn(info, apiKey);
}

async function deleteAccount(name: string) {
  const fn = await importModule<typeof import('./accounts/store').deleteAccount>(
    './accounts/store',
    'deleteAccount'
  );
  return fn(name);
}

async function setDefaultAccount(name: string) {
  const fn = await importModule<typeof import('./accounts/store').setDefaultAccount>(
    './accounts/store',
    'setDefaultAccount'
  );
  return fn(name);
}

async function getDefaultAccount() {
  const fn = await importModule<typeof import('./accounts/store').getDefaultAccount>(
    './accounts/store',
    'getDefaultAccount'
  );
  return fn();
}

async function getModelsList() {
  const fn = await importModule<typeof import('./core/model-router').listMccPresets>(
    './core/model-router',
    'listMccPresets'
  );
  return fn();
}

function openBrowser(url: string) {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
}

async function main() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Serve static UI files
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }

  // ========== API Routes ==========

  // GET /api/accounts
  app.get('/api/accounts', async (_req, res) => {
    try {
      const accounts = await getAccountsList();
      res.json(accounts);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // POST /api/accounts
  app.post('/api/accounts', async (req, res) => {
    try {
      const { name, provider, apiKey } = req.body as {
        name: string;
        provider: string;
        apiKey: string;
      };
      if (!name || !provider || !apiKey) {
        res.status(400).json({ error: 'Missing fields' });
        return;
      }
      await saveAccount(
        { name, provider, createdAt: new Date().toISOString() },
        apiKey
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // DELETE /api/accounts/:name
  app.delete('/api/accounts/:name', async (req, res) => {
    try {
      await deleteAccount(req.params.name);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // PUT /api/accounts/:name/default
  app.put('/api/accounts/:name/default', async (req, res) => {
    try {
      await setDefaultAccount(req.params.name);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // GET /api/models
  app.get('/api/models', async (_req, res) => {
    try {
      const models = await getModelsList();
      res.json(models);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // GET /api/mcp
  app.get('/api/mcp', async (_req, res) => {
    try {
      const mcpServers = [
        { name: 'mcc-websearch', displayName: 'WebSearch', description: 'Multi-provider web search', enabled: true },
        { name: 'mcc-image-analysis', displayName: 'Image Analysis', description: 'Image and PDF analysis', enabled: true },
      ];
      res.json(mcpServers);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // PUT /api/mcp/:name/enable
  app.put('/api/mcp/:name/enable', async (_req, res) => {
    res.json({ ok: true });
  });

  // PUT /api/mcp/:name/disable
  app.put('/api/mcp/:name/disable', async (_req, res) => {
    res.json({ ok: true });
  });

  // GET /api/status
  app.get('/api/status', async (_req, res) => {
    try {
      const defaultAccount = await getDefaultAccount();
      let currentModel: string | undefined;
      if (defaultAccount) {
        const acc = await getAccount(defaultAccount);
        currentModel = acc?.defaultModel;
      }
      res.json({ currentAccount: defaultAccount, currentModel });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // SPA fallback
  app.get('*', (_req, res) => {
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Dashboard not built. Run: npm run build:ui');
    }
  });

  app.listen(PORT, () => {
    console.log(`[OK] MCC Dashboard: http://localhost:${PORT}`);
    openBrowser(`http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(`[!] Dashboard server error: ${err.message}`);
  process.exit(1);
});
