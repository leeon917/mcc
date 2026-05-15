import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  getProfiles,
  addProfile,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // MCP config state
  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [presets, setPresets] = useState<ProviderPresets | null>(null);
  const [mcpSaving, setMcpSaving] = useState(false);

  // Form state
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newProtocol, setNewProtocol] = useState<'anthropic' | 'openai'>('anthropic');
  const [newOpus, setNewOpus] = useState('');
  const [newSonnet, setNewSonnet] = useState('');
  const [newHaiku, setNewHaiku] = useState('');

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
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleAddProfile() {
    if (!newName || !newBaseUrl || !newApiKey || !newModel) return;
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

  // MCP config save
  const saveMcpConfig = useCallback(async (config: McpConfig) => {
    setMcpSaving(true);
    try {
      await updateMcpConfig(config);
      setMcpConfig(config);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save MCP config');
    } finally {
      setMcpSaving(false);
    }
  }, []);

  function updateWsProvider(id: string, field: string, value: unknown) {
    if (!mcpConfig) return;
    const next = JSON.parse(JSON.stringify(mcpConfig)) as McpConfig;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (next.websearch.providers[id] as any)[field] = value;
    saveMcpConfig(next);
  }

  function updateIaProvider(id: string, field: string, value: unknown) {
    if (!mcpConfig) return;
    const next = JSON.parse(JSON.stringify(mcpConfig)) as McpConfig;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (next.imageAnalysis.providers[id] as any)[field] = value;
    saveMcpConfig(next);
  }

  function toggleWsEnabled(id: string) {
    if (!mcpConfig) return;
    const next = JSON.parse(JSON.stringify(mcpConfig)) as McpConfig;
    next.websearch.providers[id].enabled = !next.websearch.providers[id].enabled;
    saveMcpConfig(next);
  }

  function toggleIaEnabled(id: string) {
    if (!mcpConfig) return;
    const next = JSON.parse(JSON.stringify(mcpConfig)) as McpConfig;
    next.imageAnalysis.providers[id].enabled = !next.imageAnalysis.providers[id].enabled;
    saveMcpConfig(next);
  }

  function toggleMcpSection(section: 'websearch' | 'imageAnalysis') {
    if (!mcpConfig) return;
    const next = JSON.parse(JSON.stringify(mcpConfig)) as McpConfig;
    next[section].enabled = !next[section].enabled;
    saveMcpConfig(next);
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
          <Button variant="outline" onClick={loadAll}>Refresh</Button>
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
                        <div key={p.name} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.baseUrl}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {p.name === currentProfile && (
                                <span className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">active</span>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => handleSetDefault(p.name)}>Set default</Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDelete(p.name)}>Delete</Button>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Default: {p.model}</span>
                            <span>Protocol: {p.protocol || 'anthropic'}</span>
                            {p.opusModel && <span>Opus: {p.opusModel}</span>}
                            {p.sonnetModel && <span>Sonnet: {p.sonnetModel}</span>}
                            {p.haikuModel && <span>Haiku: {p.haikuModel}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Add Profile</CardTitle>
                  <CardDescription>Configure a new profile</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="name">Profile Name</Label>
                    <Input id="name" placeholder="e.g. prod" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">Base URL</Label>
                    <Input id="baseUrl" placeholder="https://api.deepseek.com/anthropic" value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input id="apiKey" type="password" placeholder="sk-..." value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} />
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
                  <Button className="w-full" onClick={handleAddProfile}>Add Profile</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="mcp">
            <div className="space-y-4">
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
                  {mcpSaving && <p className="mt-2 text-xs text-muted-foreground">Saving...</p>}
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
                        return (
                          <div key={id} className="rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{preset.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Format: {preset.format} | Endpoint: {provider.baseUrl}
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
                                  <select
                                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={provider.model}
                                    onChange={(e) => updateIaProvider(id, 'model', e.target.value)}
                                  >
                                    {preset.models.map((m) => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {mcpSaving && <p className="mt-2 text-xs text-muted-foreground">Saving...</p>}
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
