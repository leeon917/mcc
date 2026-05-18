/**
 * Dashboard Server - Express API + static file server
 */

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import type { Profile } from './accounts/store';
import { BUILTIN_MCP_SERVERS, getAllServers, type McpRegistryEntry } from './mcp/registry';
import {
  readMcpConfig,
  writeMcpConfig,
  getProviderPresets,
  type McpConfig,
} from './mcp/mcp-config';
import {
  readExternalMcpRegistry,
  addExternalMcpServer,
  removeExternalMcpServer,
  type ExternalMcpServer,
} from './mcp/external-registry';
import {
  enableInstanceExternalMcp,
  disableInstanceExternalMcp,
  readInstanceExternalEnabled,
} from './mcp/installer';
import { MCCInstanceManager } from './accounts/instance-manager';

const PORT = 3000;
const DIST_DIR = path.join(__dirname, '..', 'dist', 'ui');

async function importModule<T>(modulePath: string, fn: string): Promise<T> {
  const mod = await import(modulePath);
  return (mod as Record<string, T>)[fn] as T;
}

async function listProfiles() {
  const fn = await importModule<() => Profile[]>('./accounts/store', 'listProfiles');
  return fn();
}

async function saveProfile(profile: Profile, apiKey: string) {
  const fn = await importModule<(profile: Profile, apiKey: string) => void>(
    './accounts/store',
    'saveProfile'
  );
  return fn(profile, apiKey);
}

async function deleteProfile(name: string) {
  const fn = await importModule<(name: string) => void>('./accounts/store', 'deleteProfile');
  return fn(name);
}

async function setDefaultProfile(name: string) {
  const fn = await importModule<(name: string) => void>('./accounts/store', 'setDefaultProfile');
  return fn(name);
}

async function getDefaultProfile() {
  const fn = await importModule<() => string | undefined>('./accounts/store', 'getDefaultProfile');
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

  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }

  // GET /api/profiles
  app.get('/api/profiles', async (_req, res) => {
    try {
      res.json(await listProfiles());
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // POST /api/profiles
  app.post('/api/profiles', async (req, res) => {
    try {
      const { name, baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel, protocol, proxyChatCompletionsPath } = req.body as {
        name: string;
        baseUrl: string;
        apiKey: string;
        model: string;
        opusModel?: string;
        sonnetModel?: string;
        haikuModel?: string;
        protocol?: 'anthropic' | 'openai';
        proxyChatCompletionsPath?: string;
      };
      if (!name || !baseUrl || !apiKey || !model) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const profile: Profile = { name, baseUrl, model, opusModel, sonnetModel, haikuModel, protocol: protocol || 'anthropic', proxyChatCompletionsPath: proxyChatCompletionsPath || undefined, createdAt: new Date().toISOString() };
      await saveProfile(profile, apiKey);
      console.log(`[i] Profile created: ${name} (model: ${model}, protocol: ${protocol || 'anthropic'})`);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // PUT /api/profiles/:name — update profile
  app.put('/api/profiles/:name', async (req, res) => {
    try {
      const { baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel, protocol, proxyChatCompletionsPath } = req.body as {
        baseUrl?: string;
        apiKey?: string;
        model?: string;
        opusModel?: string;
        sonnetModel?: string;
        haikuModel?: string;
        protocol?: 'anthropic' | 'openai';
        proxyChatCompletionsPath?: string;
      };
      const profileName = req.params.name;
      const getProfileApiKey = await importModule<(name: string) => string | undefined>(
        './accounts/store',
        'getProfileApiKey'
      );
      const existingKey = getProfileApiKey(profileName);
      const profiles = await listProfiles();
      const existing = profiles.find((p) => p.name === profileName);
      if (!existing) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      const updated: Profile = {
        ...existing,
        baseUrl: baseUrl ?? existing.baseUrl,
        model: model ?? existing.model,
        opusModel: opusModel !== undefined ? (opusModel || undefined) : existing.opusModel,
        sonnetModel: sonnetModel !== undefined ? (sonnetModel || undefined) : existing.sonnetModel,
        haikuModel: haikuModel !== undefined ? (haikuModel || undefined) : existing.haikuModel,
        protocol: protocol ?? existing.protocol,
        proxyChatCompletionsPath: proxyChatCompletionsPath !== undefined ? (proxyChatCompletionsPath || undefined) : existing.proxyChatCompletionsPath,
      };
      // Only update API key if a new one is provided
      await saveProfile(updated, apiKey ?? existingKey ?? '');
      console.log(`[i] Profile updated: ${profileName} (model: ${updated.model}, protocol: ${updated.protocol || 'anthropic'})`);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // DELETE /api/profiles/:name
  app.delete('/api/profiles/:name', async (req, res) => {
    try {
      const name = req.params.name;
      await deleteProfile(name);
      console.log(`[i] Profile deleted: ${name}`);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // PUT /api/profiles/:name/default
  app.put('/api/profiles/:name/default', async (req, res) => {
    try {
      await setDefaultProfile(req.params.name);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // GET /api/ping - connection health check
  app.get('/api/ping', (_req, res) => {
    res.json({ ok: true });
  });

  // GET /api/status
  app.get('/api/status', async (_req, res) => {
    try {
      const defaultProfile = await getDefaultProfile();
      let currentProfile = defaultProfile;
      res.json({ currentProfile });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // GET /api/mcp
  app.get('/api/mcp', (_req, res) => {
    const servers = BUILTIN_MCP_SERVERS.map((s) => ({
      name: s.name,
      displayName: s.displayName,
      description: s.description,
      enabled: s.enabledByDefault,
    }));
    res.json(servers);
  });

  // PUT /api/mcp/:name/:action
  app.put('/api/mcp/:name/:action', (req, res) => {
    const { name, action } = req.params;
    if (action !== 'enable' && action !== 'disable') {
      res.status(400).json({ error: `Invalid action: ${action}` });
      return;
    }
    // Built-in servers: no per-instance tracking yet
    const builtin = BUILTIN_MCP_SERVERS.find((s) => s.name === name);
    if (builtin) {
      res.json({ ok: true });
      return;
    }
    // External servers: require instance param
    const instanceName = req.query.instance as string | undefined;
    if (!instanceName) {
      res.status(400).json({ error: 'instance query param required for external MCPs' });
      return;
    }
    const instanceMgr = new MCCInstanceManager();
    const instancePath = instanceMgr.getInstancePath(instanceName);
    if (action === 'enable') {
      enableInstanceExternalMcp(instancePath, name);
    } else {
      disableInstanceExternalMcp(instancePath, name);
    }
    res.json({ ok: true });
  });

  // GET /api/mcp/all - all servers (built-in + external) with enabled state
  app.get('/api/mcp/all', (req, res) => {
    try {
      const instanceName = req.query.instance as string | undefined;
      const instanceMgr = new MCCInstanceManager();
      let instanceExternalEnabled: string[] = [];
      if (instanceName) {
        const instancePath = instanceMgr.getInstancePath(instanceName);
        instanceExternalEnabled = readInstanceExternalEnabled(instancePath);
      }
      const servers = getAllServers();
      const result = servers.map((s: McpRegistryEntry | ExternalMcpServer) => {
        const isBuiltin = 'config' in s;
        const isEnabled = isBuiltin
          ? s.enabledByDefault
          : instanceExternalEnabled.includes(s.name);
        return {
          name: s.name,
          displayName: s.displayName,
          description: s.description,
          builtin: isBuiltin,
          enabledByDefault: isBuiltin ? s.enabledByDefault : (s as ExternalMcpServer).enabledByDefault,
          enabled: isEnabled,
        };
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // GET /api/mcp/external - list external MCP servers
  app.get('/api/mcp/external', (_req, res) => {
    try {
      res.json(readExternalMcpRegistry());
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // POST /api/mcp/external - add external MCP server
  app.post('/api/mcp/external', (req, res) => {
    try {
      const server = req.body as ExternalMcpServer;
      if (!server.name || !server.command || !server.args) {
        res.status(400).json({ error: 'name, command, and args are required' });
        return;
      }
      addExternalMcpServer(server);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // DELETE /api/mcp/external/:name - remove external MCP server
  app.delete('/api/mcp/external/:name', (req, res) => {
    try {
      removeExternalMcpServer(req.params.name);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // GET /api/mcp-config
  app.get('/api/mcp-config', (_req, res) => {
    try {
      res.json(readMcpConfig());
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // PUT /api/mcp-config
  app.put('/api/mcp-config', (req, res) => {
    try {
      const newConfig = req.body as McpConfig;
      if (!newConfig || !newConfig.websearch || !newConfig.imageAnalysis) {
        res.status(400).json({ error: 'Invalid MCP config' });
        return;
      }

      const oldConfig = readMcpConfig();
      const changes: string[] = [];

      // Section-level toggles
      if (oldConfig.websearch.enabled !== newConfig.websearch.enabled) {
        changes.push(`websearch ${newConfig.websearch.enabled ? 'enabled' : 'disabled'}`);
      }
      if (oldConfig.imageAnalysis.enabled !== newConfig.imageAnalysis.enabled) {
        changes.push(`imageAnalysis ${newConfig.imageAnalysis.enabled ? 'enabled' : 'disabled'}`);
      }

      // WebSearch provider changes
      for (const [id, np] of Object.entries(newConfig.websearch.providers)) {
        const op = oldConfig.websearch.providers[id];
        if (!op) continue;
        if (op.enabled !== np.enabled) {
          changes.push(`websearch.${id} ${np.enabled ? 'on' : 'off'}`);
        }
        if (op.apiKey !== np.apiKey) {
          changes.push(np.apiKey ? `websearch.${id} apiKey updated` : `websearch.${id} apiKey cleared`);
        }
      }

      // ImageAnalysis provider changes
      for (const [id, np] of Object.entries(newConfig.imageAnalysis.providers)) {
        const op = oldConfig.imageAnalysis.providers[id];
        if (!op) continue;
        if (op.enabled !== np.enabled) {
          changes.push(`imageAnalysis.${id} ${np.enabled ? 'on' : 'off'}`);
        }
        if (op.apiKey !== np.apiKey) {
          changes.push(np.apiKey ? `imageAnalysis.${id} apiKey updated` : `imageAnalysis.${id} apiKey cleared`);
        }
        if (op.model !== np.model) {
          changes.push(`imageAnalysis.${id} model=${np.model}`);
        }
        if (op.baseUrl !== np.baseUrl) {
          changes.push(`imageAnalysis.${id} endpoint updated`);
        }
      }

      writeMcpConfig(newConfig);

      if (changes.length > 0) {
        console.log(`[i] MCP config updated: ${changes.join('; ')}`);
      } else {
        console.log('[i] MCP config saved (no changes detected)');
      }

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // GET /api/mcp-config/presets
  app.get('/api/mcp-config/presets', (_req, res) => {
    res.json(getProviderPresets());
  });

  app.get('*', (_req, res) => {
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Dashboard not built. Run: npm run build:ui');
    }
  });

  const startServer = async (): Promise<void> => {
    let port = PORT;
    while (port < PORT + 10) {
      try {
        await new Promise<void>((resolve, reject) => {
          const server = app.listen(port, () => resolve());
          server.on('error', reject);
        });
        console.log(`[OK] MCC Dashboard: http://localhost:${port}`);
        openBrowser(`http://localhost:${port}`);
        return;
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
          console.log(`[!] Port ${port} in use, trying ${port + 1}...`);
          port++;
        } else {
          throw err;
        }
      }
    }
    console.error(`[!] Could not find an available port in range ${PORT}–${PORT + 9}`);
  };

  startServer();
}

process.on('SIGINT', () => {
  console.log('\n[i] Dashboard shutting down...');
  process.exit(0);
});

main().catch((err) => {
  console.error(`[!] Dashboard server error: ${err.message}`);
  process.exit(1);
});
