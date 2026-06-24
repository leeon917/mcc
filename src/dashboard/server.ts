/**
 * Dashboard Server - Express API + static file server
 */

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import {
  listProfiles,
  saveProfile,
  deleteProfile,
  setDefaultProfile,
  getDefaultProfile,
  getProfileApiKey,
  type Profile,
} from '../accounts/store';
import { BUILTIN_MCP_SERVERS, getAllServers, type McpRegistryEntry } from '../mcp/registry';
import {
  readMcpConfig,
  writeMcpConfig,
  getProviderPresets,
  type McpConfig,
} from '../mcp/mcp-config';
import {
  readExternalMcpRegistry,
  addExternalMcpServer,
  removeExternalMcpServer,
  type ExternalMcpServer,
} from '../mcp/external-registry';
import {
  enableInstanceExternalMcp,
  disableInstanceExternalMcp,
  readInstanceExternalEnabled,
} from '../mcp/installer';
import { MCCInstanceManager } from '../accounts/instance-manager';
import { PROVIDER_PRESET_DEFINITIONS } from '../shared/provider-preset-catalog';

const PORT = 3000;
// dist/dashboard/server.js → ../../dist/ui  (two levels up to reach dist/)
const DIST_DIR = path.join(__dirname, '..', '..', 'dist', 'ui');
const PKG_VERSION = ((): string => {
  try {
    return (require(path.join(__dirname, '..', '..', 'package.json')) as { version: string }).version;
  } catch {
    return '0.0.0';
  }
})();

interface ProviderTestResult {
  ok: boolean;
  latencyMs: number;
  models: string[];
  error?: string;
}

/**
 * Hit the provider's models endpoint to verify the key and return the
 * available model list. One round-trip covers both "is this key valid?"
 * and "what models can I pick from?" — they share the same auth.
 *
 *   Anthropic protocol → GET {base}/v1/models  (x-api-key + anthropic-version)
 *   OpenAI protocol    → GET {base}/models     (Authorization: Bearer)
 */
async function testProviderKey(
  baseUrl: string,
  apiKey: string,
  protocol: 'anthropic' | 'openai'
): Promise<ProviderTestResult> {
  const start = Date.now();
  const trimmedBase = baseUrl.trim().replace(/\/+$/, '');
  const url = protocol === 'anthropic' ? `${trimmedBase}/v1/models` : `${trimmedBase}/models`;
  const headers: Record<string, string> =
    protocol === 'anthropic'
      ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      : { Authorization: `Bearer ${apiKey}` };

  try {
    const resp = await fetch(url, { method: 'GET', headers });
    const latencyMs = Date.now() - start;
    if (!resp.ok) {
      let errText: string;
      try {
        errText = await resp.text();
      } catch {
        errText = '';
      }
      return {
        ok: false,
        latencyMs,
        models: [],
        error: `HTTP ${resp.status} ${resp.statusText}${errText ? ` — ${errText.slice(0, 200)}` : ''}`,
      };
    }
    const body = (await resp.json()) as unknown;
    const models = extractModelIds(body);
    return { ok: true, latencyMs, models };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      models: [],
      error: (e as Error).message,
    };
  }
}

/**
 * Extract model IDs from the various shapes providers return. We accept
 * `data: [...]`, `models: [...]`, or a bare array; each entry can be a
 * string or an object with `id` / `model` / `name`.
 */
function extractModelIds(body: unknown): string[] {
  if (!body) return [];
  const raw = body as { data?: unknown[]; models?: unknown[] };
  const list: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray(raw.data)
      ? raw.data
      : Array.isArray(raw.models)
        ? raw.models
        : [];
  const ids: string[] = [];
  for (const item of list) {
    if (typeof item === 'string') {
      ids.push(item);
    } else if (item && typeof item === 'object') {
      const o = item as { id?: unknown; model?: unknown; name?: unknown };
      const id = o.id ?? o.model ?? o.name;
      if (typeof id === 'string') ids.push(id);
    }
  }
  return Array.from(new Set(ids));
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
  app.get('/api/profiles', (_req, res) => {
    try {
      res.json(listProfiles());
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // POST /api/profiles
  app.post('/api/profiles', (req, res) => {
    try {
      const { name, displayName, baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel, protocol, proxyChatCompletionsPath } = req.body as {
        name: string;
        displayName?: string;
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
      const profile: Profile = {
        name,
        displayName: displayName?.trim() || undefined,
        baseUrl,
        model,
        opusModel,
        sonnetModel,
        haikuModel,
        protocol: protocol || 'anthropic',
        proxyChatCompletionsPath: proxyChatCompletionsPath || undefined,
        createdAt: new Date().toISOString(),
      };
      saveProfile(profile, apiKey);
      console.log(`[i] Profile created: ${name} (model: ${model}, protocol: ${protocol || 'anthropic'})`);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // PUT /api/profiles/:name — update profile
  app.put('/api/profiles/:name', (req, res) => {
    try {
      const { displayName, baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel, protocol, proxyChatCompletionsPath } = req.body as {
        displayName?: string;
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
      const existingKey = getProfileApiKey(profileName);
      const existing = listProfiles().find((p) => p.name === profileName);
      if (!existing) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      const updated: Profile = {
        ...existing,
        displayName: displayName !== undefined ? (displayName.trim() || undefined) : existing.displayName,
        baseUrl: baseUrl ?? existing.baseUrl,
        model: model ?? existing.model,
        opusModel: opusModel !== undefined ? (opusModel || undefined) : existing.opusModel,
        sonnetModel: sonnetModel !== undefined ? (sonnetModel || undefined) : existing.sonnetModel,
        haikuModel: haikuModel !== undefined ? (haikuModel || undefined) : existing.haikuModel,
        protocol: protocol ?? existing.protocol,
        proxyChatCompletionsPath: proxyChatCompletionsPath !== undefined ? (proxyChatCompletionsPath || undefined) : existing.proxyChatCompletionsPath,
      };
      // Only update API key if a new one is provided
      saveProfile(updated, apiKey ?? existingKey ?? '');
      console.log(`[i] Profile updated: ${profileName} (model: ${updated.model}, protocol: ${updated.protocol || 'anthropic'})`);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // GET /api/profiles/:name/key — return stored API key (dashboard is localhost-only)
  app.get('/api/profiles/:name/key', (req, res) => {
    try {
      const name = req.params.name;
      const key = getProfileApiKey(name);
      if (key === undefined) {
        res.status(404).json({ error: 'Profile or key not found' });
        return;
      }
      res.json({ apiKey: key });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // POST /api/profiles/test — test API key + fetch model list in one shot.
  // Body: { baseUrl, protocol, apiKey?, profileName? } — apiKey falls back to
  // the stored key for `profileName` when omitted (used by the edit form).
  app.post('/api/profiles/test', async (req, res) => {
    try {
      const { baseUrl, protocol, apiKey, profileName } = req.body as {
        baseUrl: string;
        protocol: 'anthropic' | 'openai';
        apiKey?: string;
        profileName?: string;
      };
      if (!baseUrl || !protocol) {
        res.status(400).json({ error: 'baseUrl and protocol required' });
        return;
      }
      const effectiveKey =
        apiKey?.trim() ||
        (profileName ? getProfileApiKey(profileName) : undefined) ||
        '';
      if (!effectiveKey) {
        res.status(400).json({ error: 'No API key available' });
        return;
      }

      const result = await testProviderKey(baseUrl, effectiveKey, protocol);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // DELETE /api/profiles/:name
  app.delete('/api/profiles/:name', (req, res) => {
    try {
      const name = req.params.name;
      deleteProfile(name);
      console.log(`[i] Profile deleted: ${name}`);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // PUT /api/profiles/:name/default
  app.put('/api/profiles/:name/default', (req, res) => {
    try {
      setDefaultProfile(req.params.name);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // GET /api/ping - connection health check (UI 用，5s 轮询)
  app.get('/api/ping', (_req, res) => {
    res.json({ ok: true });
  });

  // GET /api/health - 进程级探活（用于 systemd / Docker / 外部监控）
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: PKG_VERSION, uptime: process.uptime() });
  });

  // GET /api/status
  app.get('/api/status', (_req, res) => {
    try {
      res.json({ currentProfile: getDefaultProfile() });
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

  // GET /api/profile-presets - provider templates for the Templates gallery
  app.get('/api/profile-presets', (_req, res) => {
    res.json(PROVIDER_PRESET_DEFINITIONS);
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
