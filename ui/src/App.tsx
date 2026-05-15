import { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

  // MCP config state
  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [presets, setPresets] = useState<ProviderPresets | null>(null);
  const [mcpSaving, setMcpSaving] = useState(false);
  const [mcpDirty, setMcpDirty] = useState(false);
  const [mcpSaved, setMcpSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Form state
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newProtocol, setNewProtocol] = useState<'anthropic' | 'openai'>('anthropic');
  const [newOpus, setNewOpus] = useState('');
  const [newSonnet, setNewSonnet] = useState('');
  const [newHaiku, setNewHaiku] = useState('');
  const [editingProfile, setEditingProfile] = useState<string | null>(null);

  // External MCP form state
  const [showAddExternal, setShowAddExternal] = useState(false);
  const [extName, setExtName] = useState('');
  const [extDisplayName, setExtDisplayName] = useState('');
  const [extDescription, setExtDescription] = useState('');
  const [extCommand, setExtCommand] = useState('uvx');
  const [extArgs, setExtArgs] = useState('minimax-coding-plan-mcp,-y');
  const [extProviderRef, setExtProviderRef] = useState('minimax');
  const [extEnabledByDefault, setExtEnabledByDefault] = useState(false);

  async function loadAll() {
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
  }

  useEffect(() => { loadAll(); }, []);

  // Poll connection status every 5s
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const ok = await ping();
      if (!cancelled) setConnected(ok);
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  function startEditProfile(p: Profile) {
    setEditingProfile(p.name);
    setNewName(p.name);
    setNewBaseUrl(p.baseUrl);
    setNewApiKey('');
    setNewModel(p.model);
    setNewProtocol(p.protocol || 'anthropic');
    setNewOpus(p.opusModel || '');
    setNewSonnet(p.sonnetModel || '');
    setNewHaiku(p.haikuModel || '');
  }

  function cancelEdit() {
    setEditingProfile(null);
    setNewName(''); setNewBaseUrl(''); setNewApiKey(''); setNewModel('');
    setNewProtocol('anthropic');
    setNewOpus(''); setNewSonnet(''); setNewHaiku('');
  }

  async function handleAddProfile() {
    if (!newName || !newBaseUrl || !newModel) return;
    if (editingProfile) {
      // Update
      if (!newBaseUrl || !newModel) return;
      try {
        await updateProfile(editingProfile, {
          baseUrl: newBaseUrl,
          apiKey: newApiKey || undefined,
          model: newModel,
          protocol: newProtocol,
          opusModel: newOpus || undefined,
          sonnetModel: newSonnet || undefined,
          haikuModel: newHaiku || undefined,
        });
        cancelEdit();
        await loadAll();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update profile');
      }
    } else {
      // Add
      if (!newApiKey) return;
      try {
        await addProfile({
          name: newName,
          baseUrl: newBaseUrl,
          apiKey: newApiKey,
          model: newModel,
          protocol: newProtocol,
          opusModel: newOpus || undefined,
          sonnetModel: newSonnet || undefined,
          haikuModel: newHaiku || undefined,
        });
        setNewName(''); setNewBaseUrl(''); setNewApiKey(''); setNewModel('');
        setNewProtocol('anthropic');
        setNewOpus(''); setNewSonnet(''); setNewHaiku('');
        await loadAll();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add profile');
      }
    }
  }

  async function handleDelete(name: string) {
    try { await deleteProfile(name); await loadAll(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete'); }
  }

  async function handleSetDefault(name: string) {
    try { await setDefaultProfile(name); setCurrentProfile(name); await loadAll(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to set default'); }
  }

  async function handleToggleMcp(name: string, enabled: boolean, instance?: string) {
    try { await toggleMcp(name, enabled, instance); await loadAll(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to toggle MCP'); }
  }

  async function handleAddExternalMcp() {
    if (!extName || !extCommand || !extArgs) return;
    try {
      const server: ExternalMcpServer = {
        name: extName,
        displayName: extDisplayName || extName,
        description: extDescription,
        command: extCommand,
        args: extArgs.split(',').map((s) => s.trim()),
        envVars: extProviderRef
          ? { MINIMAX_API_KEY: `\${MCC_PROVIDER_KEY:${extProviderRef}}` }
          : {},
        enabledByDefault: extEnabledByDefault,
      };
      await addExternalMcpServer(server);
      setExtName(''); setExtDisplayName(''); setExtDescription('');
      setExtCommand('uvx'); setExtArgs('minimax-coding-plan-mcp,-y');
      setExtProviderRef('minimax'); setExtEnabledByDefault(false);
      setShowAddExternal(false);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add external MCP');
    }
  }

  async function handleRemoveExternalMcp(name: string) {
    try { await removeExternalMcpServer(name); await loadAll(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to remove external MCP'); }
  }

  // MCP config save — explicit save entry point
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

  function updateWsProvider(id: string, field: string, value: unknown) {
    setMcpConfig(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next.websearch.providers[id] as any)[field] = value;
      return next;
    });
    setMcpDirty(true);
  }

  function updateIaProvider(id: string, field: string, value: unknown) {
    setMcpConfig(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next.imageAnalysis.providers[id] as any)[field] = value;
      return next;
    });
    setMcpDirty(true);
  }

  function toggleWsEnabled(id: string) {
    setMcpConfig(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.websearch.providers[id].enabled = !next.websearch.providers[id].enabled;
      return next;
    });
    setMcpDirty(true);
  }

  function toggleIaEnabled(id: string) {
    setMcpConfig(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.imageAnalysis.providers[id].enabled = !next.imageAnalysis.providers[id].enabled;
      return next;
    });
    setMcpDirty(true);
  }

  function toggleMcpSection(section: 'websearch' | 'imageAnalysis') {
    setMcpConfig(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next[section].enabled = !next[section].enabled;
      return next;
    });
    setMcpDirty(true);
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">MCC Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {currentProfile ? `Current profile: ${currentProfile}` : 'No profile selected'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-green-600' : 'text-red-500'}`}>
              <span className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            <Button variant="outline" onClick={loadAll}>Refresh</Button>
          </div>
        </div>

        {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <Tabs defaultValue="profiles">
          <TabsList className="mb-4">
            <TabsTrigger value="profiles">Profiles</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>

          <TabsContent value="profiles">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Profiles</CardTitle>
                  <CardDescription>Your configured profiles</CardDescription>
                </CardHeader>
                <CardContent>
                  {profiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No profiles yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {profiles.map((p) => (
                        <div key={p.name} className="rounded-lg border p-4">
                          {/* Header: name + badges */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{p.name}</span>
                            {p.name === currentProfile && (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-500/20">
                                default
                              </span>
                            )}
                            <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {p.protocol || 'anthropic'}
                            </span>
                          </div>

                          {/* Base URL */}
                          <p className="text-xs text-muted-foreground/60 truncate mb-3 font-mono">{p.baseUrl}</p>

                          {/* Model details — label-value pairs with consistent alignment */}
                          <div className="space-y-0.5 mb-3 text-xs">
                            <div className="flex gap-3">
                              <span className="text-muted-foreground w-14 shrink-0 text-right">default</span>
                              <span className="font-mono text-foreground/80 truncate">{p.model}</span>
                            </div>
                            {p.opusModel && (
                              <div className="flex gap-3">
                                <span className="text-muted-foreground w-14 shrink-0 text-right">opus</span>
                                <span className="font-mono text-foreground/80 truncate">{p.opusModel}</span>
                              </div>
                            )}
                            {p.sonnetModel && (
                              <div className="flex gap-3">
                                <span className="text-muted-foreground w-14 shrink-0 text-right">sonnet</span>
                                <span className="font-mono text-foreground/80 truncate">{p.sonnetModel}</span>
                              </div>
                            )}
                            {p.haikuModel && (
                              <div className="flex gap-3">
                                <span className="text-muted-foreground w-14 shrink-0 text-right">haiku</span>
                                <span className="font-mono text-foreground/80 truncate">{p.haikuModel}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 pt-2 border-t border-border/50">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => startEditProfile(p)}>Edit</Button>
                            {p.name !== currentProfile && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleSetDefault(p.name)}>Set default</Button>
                            )}
                            <span className="flex-1" />
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(p.name)}>Delete</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{editingProfile ? 'Edit Profile' : 'Add Profile'}</CardTitle>
                  <CardDescription>{editingProfile ? `Editing: ${editingProfile}` : 'Configure a new profile'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="name">Profile Name</Label>
                    <Input id="name" placeholder="e.g. prod" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={!!editingProfile} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">Base URL</Label>
                    <Input id="baseUrl" placeholder="https://api.deepseek.com/anthropic" value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input id="apiKey" type="password" placeholder={editingProfile ? '(unchanged if empty)' : 'sk-...'} value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Default Model</Label>
                    <Input id="model" placeholder="e.g. deepseek-chat" value={newModel} onChange={(e) => setNewModel(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="protocol">Protocol</Label>
                    <select
                      id="protocol"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={newProtocol}
                      onChange={(e) => setNewProtocol(e.target.value as 'anthropic' | 'openai')}
                    >
                      <option value="anthropic">Anthropic (direct)</option>
                      <option value="openai">OpenAI-compatible (translation proxy)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="opus">Opus</Label>
                      <Input id="opus" placeholder="Opus model" value={newOpus} onChange={(e) => setNewOpus(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sonnet">Sonnet</Label>
                      <Input id="sonnet" placeholder="Sonnet model" value={newSonnet} onChange={(e) => setNewSonnet(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="haiku">Haiku</Label>
                      <Input id="haiku" placeholder="Haiku model" value={newHaiku} onChange={(e) => setNewHaiku(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleAddProfile}>{editingProfile ? 'Update Profile' : 'Add Profile'}</Button>
                    {editingProfile && <Button variant="outline" onClick={cancelEdit}>Cancel</Button>}
                  </div>
                </CardContent>
              </Card>
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
              {/* Save bar */}
              {(mcpDirty || mcpSaved) && (
                <div className={`rounded-lg border p-3 flex items-center justify-between ${
                  mcpSaved
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
                }`}>
                  <div>
                    {mcpSaved ? (
                      <>
                        <span className="text-sm text-green-700 dark:text-green-400 font-medium">Saved</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          Changes won't affect running MCC instances. Restart to apply.
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-amber-700 dark:text-amber-400">You have unsaved changes</span>
                    )}
                  </div>
                  {mcpDirty && (
                    <Button size="sm" onClick={handleSaveMcpConfig} disabled={mcpSaving}>
                      {mcpSaving ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                </div>
              )}

              {/* WebSearch Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>WebSearch</CardTitle>
                      <CardDescription>Web search providers for Claude Code</CardDescription>
                    </div>
                    <Switch
                      checked={mcpConfig?.websearch.enabled ?? true}
                      onCheckedChange={() => toggleMcpSection('websearch')}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {mcpConfig && presets && (
                    <div className="space-y-3">
                      {Object.entries(presets.websearch).map(([id, preset]) => {
                        const provider = mcpConfig.websearch.providers[id];
                        if (!provider) return null;
                        return (
                          <div key={id} className="rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{preset.name}</p>
                                <p className="text-xs text-muted-foreground">{preset.description}</p>
                              </div>
                              <Switch
                                checked={provider.enabled}
                                onCheckedChange={() => toggleWsEnabled(id)}
                                disabled={!mcpConfig.websearch.enabled}
                              />
                            </div>
                            {preset.needsApiKey && provider.enabled && (
                              <div className="mt-3">
                                <Label className="text-xs">API Key</Label>
                                <Input
                                  type="password"
                                  placeholder="Enter API key..."
                                  value={provider.apiKey || ''}
                                  onChange={(e) => updateWsProvider(id, 'apiKey', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ImageAnalysis Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Image Analysis</CardTitle>
                      <CardDescription>Vision providers for image/PDF understanding</CardDescription>
                    </div>
                    <Switch
                      checked={mcpConfig?.imageAnalysis.enabled ?? true}
                      onCheckedChange={() => toggleMcpSection('imageAnalysis')}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {mcpConfig && presets && (
                    <div className="space-y-4">
                      {Object.entries(presets.imageAnalysis).map(([id, preset]) => {
                        const provider = mcpConfig.imageAnalysis.providers[id];
                        if (!provider) return null;
                        const datalistId = `ia-model-${id}`;
                        return (
                          <div key={id} className="rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{preset.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Format: {preset.format}
                                </p>
                              </div>
                              <Switch
                                checked={provider.enabled}
                                onCheckedChange={() => toggleIaEnabled(id)}
                                disabled={!mcpConfig.imageAnalysis.enabled}
                              />
                            </div>
                            {provider.enabled && (
                              <div className="mt-3 space-y-3">
                                <div>
                                  <Label className="text-xs">Endpoint (Base URL)</Label>
                                  <Input
                                    placeholder={preset.baseUrl}
                                    value={provider.baseUrl}
                                    onChange={(e) => updateIaProvider(id, 'baseUrl', e.target.value)}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">API Key</Label>
                                  <Input
                                    type="password"
                                    placeholder="Enter API key..."
                                    value={provider.apiKey}
                                    onChange={(e) => updateIaProvider(id, 'apiKey', e.target.value)}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Model</Label>
                                  <Input
                                    list={datalistId}
                                    placeholder="Select or type model name..."
                                    value={provider.model}
                                    onChange={(e) => updateIaProvider(id, 'model', e.target.value)}
                                    className="mt-1"
                                  />
                                  <datalist id={datalistId}>
                                    {preset.models.map((m) => (
                                      <option key={m} value={m} />
                                    ))}
                                  </datalist>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* MCP Server Status */}
              <Card>
                <CardHeader>
                  <CardTitle>MCP Server Status</CardTitle>
                  <CardDescription>Running MCP servers for the current session</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mcpServers.map((server) => (
                      <div key={server.name} className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <p className="font-medium">{server.displayName}</p>
                          <p className="text-sm text-muted-foreground">{server.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{server.enabled ? 'Enabled' : 'Disabled'}</span>
                          <Switch checked={server.enabled} onCheckedChange={(checked) => handleToggleMcp(server.name, checked)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* External MCP Servers */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>External MCP Servers</CardTitle>
                      <CardDescription>User-added MCP servers (e.g. MiniMax Token Plan)</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowAddExternal(!showAddExternal)}>
                      {showAddExternal ? 'Cancel' : 'Add'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showAddExternal && (
                    <div className="mb-4 space-y-3 rounded-lg border p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Name (unique ID)</Label>
                          <Input placeholder="minimax-plan" value={extName} onChange={(e) => setExtName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Display Name</Label>
                          <Input placeholder="MiniMax Token Plan" value={extDisplayName} onChange={(e) => setExtDisplayName(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input placeholder="Web search and image understanding via MiniMax Token Plan" value={extDescription} onChange={(e) => setExtDescription(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Command</Label>
                          <Input placeholder="uvx" value={extCommand} onChange={(e) => setExtCommand(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Args (comma-separated)</Label>
                          <Input placeholder="minimax-coding-plan-mcp,-y" value={extArgs} onChange={(e) => setExtArgs(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Provider API Key Source</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={extProviderRef}
                            onChange={(e) => setExtProviderRef(e.target.value)}
                          >
                            <option value="minimax">MiniMax (Token Plan)</option>
                            <option value="ali">Ali (DashScope)</option>
                            <option value="kimi">Kimi</option>
                            <option value="deepseek">DeepSeek</option>
                            <option value="">None</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 pt-5">
                          <Switch checked={extEnabledByDefault} onCheckedChange={setExtEnabledByDefault} />
                          <span className="text-xs">Enabled by default</span>
                        </div>
                      </div>
                      <Button className="w-full" onClick={handleAddExternalMcp}>Add External MCP</Button>
                    </div>
                  )}
                  <div className="space-y-3">
                    {externalMcpServers.length === 0 && !showAddExternal && (
                      <p className="text-sm text-muted-foreground">No external MCP servers. Click Add to register one.</p>
                    )}
                    {externalMcpServers.map((server) => {
                      const serverState = allMcpServers.find((s) => s.name === server.name);
                      return (
                        <div key={server.name} className="flex items-center justify-between rounded-lg border p-4">
                          <div>
                            <p className="font-medium">{server.displayName}</p>
                            <p className="text-sm text-muted-foreground">{server.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {server.command} {server.args.join(' ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {serverState && (
                              <span className="text-xs text-muted-foreground">
                                {serverState.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            )}
                            <Switch
                              checked={serverState?.enabled ?? false}
                              onCheckedChange={(checked) => handleToggleMcp(server.name, checked, currentProfile)}
                            />
                            <Button size="sm" variant="destructive" onClick={() => handleRemoveExternalMcp(server.name)}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
