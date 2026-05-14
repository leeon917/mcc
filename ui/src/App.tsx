import { useState, useEffect } from 'react';
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
  toggleMcp,
  getStatus,
  type Profile,
  type McpServer,
} from '@/lib/api';

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [currentProfile, setCurrentProfile] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newOpus, setNewOpus] = useState('');
  const [newSonnet, setNewSonnet] = useState('');
  const [newHaiku, setNewHaiku] = useState('');

  async function loadAll() {
    try {
      const [profs, mcps, status] = await Promise.all([
        getProfiles(),
        getMcpServers(),
        getStatus(),
      ]);
      setProfiles(profs);
      setMcpServers(mcps);
      setCurrentProfile(status.currentProfile || '');
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
        opusModel: newOpus || undefined,
        sonnetModel: newSonnet || undefined,
        haikuModel: newHaiku || undefined,
      });
      setNewName(''); setNewBaseUrl(''); setNewApiKey(''); setNewModel('');
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

  async function handleToggleMcp(name: string, enabled: boolean) {
    try { await toggleMcp(name, enabled); await loadAll(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to toggle MCP'); }
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
            <Card>
              <CardHeader>
                <CardTitle>MCP Servers</CardTitle>
                <CardDescription>Manage MCP tool servers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
