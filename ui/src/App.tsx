import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Ui } from '@/components/icons/Ui';
import { ProfileList } from '@/components/ProfileList';
import { ProfileForm, type ProfileFormPayload } from '@/components/ProfileForm';
import { WebSearchPanel } from '@/components/WebSearchPanel';
import { ImageAnalysisPanel } from '@/components/ImageAnalysisPanel';
import { McpServerStatusPanel } from '@/components/McpServerStatusPanel';
import { ExternalMcpPanel } from '@/components/ExternalMcpPanel';
import { PresetGallery } from '@/components/PresetGallery';
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
  getProfilePresets,
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
  type ProfilePreset,
} from '@/lib/api';

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [allMcpServers, setAllMcpServers] = useState<AllMcpServer[]>([]);
  const [externalMcpServers, setExternalMcpServers] = useState<ExternalMcpServer[]>([]);
  const [profilePresets, setProfilePresets] = useState<ProfilePreset[]>([]);
  const [currentProfile, setCurrentProfile] = useState<string>('');
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'templates' | 'profiles' | 'mcp'>('templates');

  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [presets, setPresets] = useState<ProviderPresets | null>(null);
  const [mcpSaving, setMcpSaving] = useState(false);
  const [mcpDirty, setMcpDirty] = useState(false);
  const [mcpSaved, setMcpSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [editing, setEditing] = useState<Profile | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [profs, mcps, status, config, pres, allMcps, externalMcps, profPres] =
        await Promise.all([
          getProfiles(),
          getMcpServers(),
          getStatus(),
          getMcpConfig(),
          getProviderPresets(),
          getAllMcpServers(),
          getExternalMcpServers(),
          getProfilePresets(),
        ]);
      setProfiles(profs);
      setMcpServers(mcps);
      setCurrentProfile(status.currentProfile || '');
      setMcpConfig(config);
      setPresets(pres);
      setAllMcpServers(allMcps);
      setExternalMcpServers(externalMcps);
      setProfilePresets(profPres);
      setMcpDirty(false);
      setError('');
      // first run: if there are already profiles, jump to Profiles tab
      if (profs.length > 0 && activeTab === 'templates' && loading) {
        setActiveTab('profiles');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

  const existingProfileNames = useMemo(() => profiles.map((p) => p.name), [profiles]);

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

  async function handleInstallPreset(args: {
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    protocol: 'anthropic' | 'openai';
  }): Promise<boolean> {
    try {
      await addProfile(args);
      await loadAll();
      setActiveTab('profiles');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to install preset');
      return false;
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
    return <BootSplash />;
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader
        connected={connected}
        currentProfile={currentProfile}
        profileCount={profiles.length}
        onRefresh={loadAll}
      />

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        {error && (
          <div className="banner-error mb-4 flex items-start gap-2 px-4 py-3 text-sm">
            <Ui name="x" size={14} className="mt-0.5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError('')}
              className="text-current opacity-70 transition-opacity hover:opacity-100"
              aria-label="Dismiss"
            >
              <Ui name="x" size={12} />
            </button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="mb-6 flex items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="templates">
                <Ui name="sparkle" size={14} />
                Templates
              </TabsTrigger>
              <TabsTrigger value="profiles">
                <Ui name="profile" size={14} />
                Profiles
                {profiles.length > 0 && (
                  <span className="pixel-chip pixel-chip-tangerine ml-1">{profiles.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="mcp">
                <Ui name="mcp" size={14} />
                MCP
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="templates">
            <PresetGallery
              presets={profilePresets}
              existingProfileNames={existingProfileNames}
              onInstall={handleInstallPreset}
            />
          </TabsContent>

          <TabsContent value="profiles">
            <div className="grid gap-5 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <ProfileList
                  profiles={profiles}
                  currentProfile={currentProfile}
                  onEdit={(p) => {
                    setEditing(p);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onSetDefault={handleSetDefault}
                  onDelete={handleDelete}
                />
              </div>
              <div className="lg:col-span-2">
                <ProfileForm
                  editingProfile={editing}
                  onSubmit={handleSubmitProfile}
                  onCancel={() => setEditing(null)}
                />
              </div>
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
                onToggle={(name, enabled, instance) =>
                  handleToggleMcp(name, enabled, instance)
                }
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AppFooter />
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────────── */

function AppHeader({
  connected,
  currentProfile,
  profileCount,
  onRefresh,
}: {
  connected: boolean;
  currentProfile: string;
  profileCount: number;
  onRefresh: () => void;
}) {
  return (
    <header className="px-5 pt-6 pb-8 sm:px-8 sm:pt-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <ArcadeLogo />
            <div>
              <p className="font-pixel text-xs uppercase tracking-[0.22em] text-arcade-tangerine-ink">
                ★ MCC · Multi-Cloud Console
              </p>
              <h1 className="font-rounded text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
                你的 Claude Code Provider 控制台
              </h1>
              <p className="mt-1 text-xs text-ink-400 sm:text-sm">
                {profileCount === 0
                  ? '从 Templates 挑一个 Provider 开始，30 秒就能跑起来。'
                  : currentProfile
                    ? `当前默认 · ${currentProfile} — 切换或新增都在这里。`
                    : '当前没有设默认 profile。'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ConnectionBadge connected={connected} />
            <Button size="sm" variant="outline" onClick={onRefresh} aria-label="Refresh">
              <Ui name="refresh" size={14} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function ArcadeLogo() {
  // Compact pixel-art MCC tile — three stacked block letters in arcade colors.
  return (
    <div className="provider-halo crt-scanline" aria-label="MCC logo">
      <svg viewBox="0 0 32 32" width={32} height={32} shapeRendering="crispEdges">
        <rect x="3" y="6" width="2" height="20" fill="var(--arcade-tangerine)" />
        <rect x="5" y="6" width="2" height="2" fill="var(--arcade-tangerine)" />
        <rect x="9" y="6" width="2" height="2" fill="var(--arcade-tangerine)" />
        <rect x="7" y="8" width="2" height="2" fill="var(--arcade-tangerine)" />
        <rect x="11" y="6" width="2" height="20" fill="var(--arcade-tangerine)" />

        <rect x="15" y="6" width="2" height="20" fill="var(--arcade-lagoon)" />
        <rect x="17" y="6" width="6" height="2" fill="var(--arcade-lagoon)" />
        <rect x="17" y="24" width="6" height="2" fill="var(--arcade-lagoon)" />

        <rect x="25" y="6" width="2" height="20" fill="var(--arcade-hibiscus)" />
        <rect x="27" y="6" width="2" height="2" fill="var(--arcade-hibiscus)" />
        <rect x="27" y="24" width="2" height="2" fill="var(--arcade-hibiscus)" />
      </svg>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        connected
          ? 'border-arcade-leaf bg-arcade-leaf/15 status-online'
          : 'border-arcade-hibiscus bg-arcade-hibiscus/15 status-offline'
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected ? 'status-online-dot' : 'status-offline-dot'
        }`}
      />
      <span className="font-pixel uppercase tracking-widest text-[10px]">
        {connected ? 'Online' : 'Offline'}
      </span>
    </span>
  );
}

function BootSplash() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <div className="provider-halo crt-scanline">
        <svg viewBox="0 0 32 32" width={36} height={36} shapeRendering="crispEdges">
          <rect x="6" y="6" width="20" height="20" fill="var(--arcade-tangerine)" />
          <rect x="10" y="10" width="12" height="12" fill="var(--paper-50)" />
          <rect x="14" y="14" width="4" height="4" fill="var(--ink-900)" />
        </svg>
      </div>
      <p className="font-pixel text-xs uppercase tracking-[0.3em] text-ink-400">loading…</p>
    </div>
  );
}

function AppFooter() {
  return (
    <footer className="mx-auto mt-12 max-w-6xl px-5 sm:px-8">
      <div className="border-t border-paper-300 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-400">
          <span className="font-pixel uppercase tracking-widest">
            MCC v0.1 · cupertino arcade build
          </span>
          <span className="flex items-center gap-1.5">
            <Ui name="heart" size={11} className="text-arcade-hibiscus" />
            <span>made for ⌘+K life-switching</span>
          </span>
        </div>
      </div>
    </footer>
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
      className={`flex items-center justify-between rounded-2xl p-3.5 ${
        saved ? 'banner-success' : 'banner-warning'
      }`}
    >
      <div className="flex items-center gap-2">
        <Ui name={saved ? 'check-bold' : 'lightning'} size={16} />
        {saved ? (
          <div>
            <span className="font-rounded text-sm font-semibold">已保存</span>
            <p className="mt-0.5 text-xs opacity-80">
              改动不会影响正在运行的 MCC 实例，重启后生效。
            </p>
          </div>
        ) : (
          <span className="font-rounded text-sm font-semibold">未保存的改动</span>
        )}
      </div>
      {dirty && (
        <Button size="sm" onClick={onSave} disabled={saving}>
          <Ui name="check-bold" size={14} />
          {saving ? '保存中…' : '保存'}
        </Button>
      )}
    </div>
  );
}
