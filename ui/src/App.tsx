import { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ProfileList } from '@/components/ProfileList';
import { ProfileForm, type ProfileFormPayload } from '@/components/ProfileForm';
import { WebSearchPanel } from '@/components/WebSearchPanel';
import { ImageAnalysisPanel } from '@/components/ImageAnalysisPanel';
import { McpServerStatusPanel } from '@/components/McpServerStatusPanel';
import { ExternalMcpPanel } from '@/components/ExternalMcpPanel';
import {
  getProfiles,
  addProfile,
  updateProfile,
  deleteProfile,
  setDefaultProfile,
  getMcpServers,
  getAllMcpServers,
  toggleMcp,
  getStatus,
  getMcpConfig,
  updateMcpConfig,
  getProviderPresets,
  getExternalMcpServers,
  addExternalMcpServer,
  removeExternalMcpServer,
  ping,
  type Profile,
  type McpServer,
  type McpConfig,
  type ProviderPresets,
  type AllMcpServer,
  type ExternalMcpServer,
} from '@/lib/api';

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [allMcpServers, setAllMcpServers] = useState<AllMcpServer[]>([]);
  const [externalMcpServers, setExternalMcpServers] = useState<ExternalMcpServer[]>([]);
  const [currentProfile, setCurrentProfile] = useState<string>('');
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [presets, setPresets] = useState<ProviderPresets | null>(null);
  const [mcpSaving, setMcpSaving] = useState(false);
  const [mcpDirty, setMcpDirty] = useState(false);
  const [mcpSaved, setMcpSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [editing, setEditing] = useState<Profile | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [profs, mcps, status, config, pres, allMcps, externalMcps] = await Promise.all([
        getProfiles(),
        getMcpServers(),
        getStatus(),
        getMcpConfig(),
        getProviderPresets(),
        getAllMcpServers(),
        getExternalMcpServers(),
      ]);
      setProfiles(profs);
      setMcpServers(mcps);
      setCurrentProfile(status.currentProfile || '');
      setMcpConfig(config);
      setPresets(pres);
      setAllMcpServers(allMcps);
      setExternalMcpServers(externalMcps);
      setMcpDirty(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Poll connection status every 5s.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const ok = await ping();
      if (!cancelled) setConnected(ok);
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleSubmitProfile(payload: ProfileFormPayload) {
    try {
      if (editing) {
        await updateProfile(editing.name, {
          baseUrl: payload.baseUrl,
          apiKey: payload.apiKey,
          model: payload.model,
          protocol: payload.protocol,
          opusModel: payload.opusModel,
          sonnetModel: payload.sonnetModel,
          haikuModel: payload.haikuModel,
        });
        setEditing(null);
      } else {
        if (!payload.apiKey) return;
        await addProfile({
          name: payload.name,
          baseUrl: payload.baseUrl,
          apiKey: payload.apiKey,
          model: payload.model,
          protocol: payload.protocol,
          opusModel: payload.opusModel,
          sonnetModel: payload.sonnetModel,
          haikuModel: payload.haikuModel,
        });
      }
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    }
  }

  async function handleDelete(name: string) {
    try {
      await deleteProfile(name);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  async function handleSetDefault(name: string) {
    try {
      await setDefaultProfile(name);
      setCurrentProfile(name);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set default');
    }
  }

  async function handleToggleMcp(name: string, enabled: boolean, instance?: string) {
    try {
      await toggleMcp(name, enabled, instance);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle MCP');
    }
  }

  async function handleAddExternalMcp(server: ExternalMcpServer) {
    try {
      await addExternalMcpServer(server);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add external MCP');
    }
  }

  async function handleRemoveExternalMcp(name: string) {
    try {
      await removeExternalMcpServer(name);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove external MCP');
    }
  }

  const handleSaveMcpConfig = useCallback(async () => {
    if (!mcpConfig || !mcpDirty) return;
    setMcpSaving(true);
    try {
      await updateMcpConfig(mcpConfig);
      setMcpDirty(false);
      setMcpSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setMcpSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save MCP config');
    } finally {
      setMcpSaving(false);
    }
  }, [mcpConfig, mcpDirty]);

  function updateWsField(id: string, field: string, value: unknown) {
    setMcpConfig((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next.websearch.providers[id] as any)[field] = value;
      return next;
    });
    setMcpDirty(true);
  }

  function updateIaField(id: string, field: string, value: unknown) {
    setMcpConfig((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next.imageAnalysis.providers[id] as any)[field] = value;
      return next;
    });
    setMcpDirty(true);
  }

  function toggleWsProvider(id: string) {
    setMcpConfig((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.websearch.providers[id].enabled = !next.websearch.providers[id].enabled;
      return next;
    });
    setMcpDirty(true);
  }

  function toggleIaProvider(id: string) {
    setMcpConfig((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.imageAnalysis.providers[id].enabled = !next.imageAnalysis.providers[id].enabled;
      return next;
    });
    setMcpDirty(true);
  }

  function toggleMcpSection(section: 'websearch' | 'imageAnalysis') {
    setMcpConfig((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next[section].enabled = !next[section].enabled;
      return next;
    });
    setMcpDirty(true);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--app-bg)' }}>
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">MCC Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {currentProfile ? `Current profile: ${currentProfile}` : 'No profile selected'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionBadge connected={connected} />
            <Button variant="outline" onClick={loadAll}>
              Refresh
            </Button>
          </div>
        </header>

        {error && <div className="banner-error mb-4 rounded-md p-3 text-sm">{error}</div>}

        <Tabs defaultValue="profiles">
          <TabsList className="mb-4">
            <TabsTrigger value="profiles">Profiles</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>

          <TabsContent value="profiles">
            <div className="grid gap-4 md:grid-cols-2">
              <ProfileList
                profiles={profiles}
                currentProfile={currentProfile}
                onEdit={setEditing}
                onSetDefault={handleSetDefault}
                onDelete={handleDelete}
              />
              <ProfileForm
                editingProfile={editing}
                onSubmit={handleSubmitProfile}
                onCancel={() => setEditing(null)}
              />
            </div>
          </TabsContent>

          <TabsContent value="mcp">
            <div
              className="space-y-4"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' && mcpDirty && !mcpSaving) {
                  const tag = (e.target as HTMLElement).tagName;
                  if (tag === 'INPUT' || tag === 'TEXTAREA') {
                    e.preventDefault();
                    handleSaveMcpConfig();
                  }
                }
              }}
            >
              <SaveBar
                dirty={mcpDirty}
                saved={mcpSaved}
                saving={mcpSaving}
                onSave={handleSaveMcpConfig}
              />

              {mcpConfig && presets && (
                <>
                  <WebSearchPanel
                    config={mcpConfig}
                    presets={presets}
                    onToggleSection={() => toggleMcpSection('websearch')}
                    onToggleProvider={toggleWsProvider}
                    onUpdateField={updateWsField}
                  />
                  <ImageAnalysisPanel
                    config={mcpConfig}
                    presets={presets}
                    onToggleSection={() => toggleMcpSection('imageAnalysis')}
                    onToggleProvider={toggleIaProvider}
                    onUpdateField={updateIaField}
                  />
                </>
              )}

              <McpServerStatusPanel
                servers={mcpServers}
                onToggle={(name, enabled) => handleToggleMcp(name, enabled)}
              />

              <ExternalMcpPanel
                externalMcpServers={externalMcpServers}
                allMcpServers={allMcpServers}
                currentProfile={currentProfile}
                onAdd={handleAddExternalMcp}
                onRemove={handleRemoveExternalMcp}
                onToggle={(name, enabled, instance) => handleToggleMcp(name, enabled, instance)}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-medium ${
        connected ? 'status-online' : 'status-offline'
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected ? 'status-online-dot' : 'status-offline-dot'
        }`}
      />
      {connected ? 'Connected' : 'Disconnected'}
    </span>
  );
}

interface SaveBarProps {
  dirty: boolean;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
}

function SaveBar({ dirty, saved, saving, onSave }: SaveBarProps) {
  if (!dirty && !saved) return null;
  return (
    <div
      className={`rounded-lg p-3 flex items-center justify-between ${
        saved ? 'banner-success' : 'banner-warning'
      }`}
    >
      <div>
        {saved ? (
          <>
            <span className="text-sm font-medium">Saved</span>
            <p className="text-xs text-muted-foreground mt-1">
              改动不会影响正在运行的 MCC 实例，重启后生效。
            </p>
          </>
        ) : (
          <span className="text-sm">You have unsaved changes</span>
        )}
      </div>
      {dirty && (
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      )}
    </div>
  );
}
