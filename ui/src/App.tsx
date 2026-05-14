import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  getAccounts,
  addAccount,
  deleteAccount,
  setDefaultAccount,
  getModels,
  getMcpServers,
  toggleMcp,
  getStatus,
  type AccountInfo,
  type ModelPreset,
  type McpServer,
} from '@/lib/api';

export default function App() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [models, setModels] = useState<ModelPreset[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [currentAccount, setCurrentAccount] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add account form state
  const [newName, setNewName] = useState('');
  const [newProvider, setNewProvider] = useState('');
  const [newApiKey, setNewApiKey] = useState('');

  async function loadAll() {
    try {
      const [accs, mods, mcps, status] = await Promise.all([
        getAccounts(),
        getModels(),
        getMcpServers(),
        getStatus(),
      ]);
      setAccounts(accs);
      setModels(mods);
      setMcpServers(mcps);
      setCurrentAccount(status.currentAccount || '');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAddAccount() {
    if (!newName || !newProvider || !newApiKey) return;
    try {
      await addAccount(newName, newProvider, newApiKey);
      setNewName('');
      setNewApiKey('');
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add account');
    }
  }

  async function handleDelete(name: string) {
    try {
      await deleteAccount(name);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  async function handleSetDefault(name: string) {
    try {
      await setDefaultAccount(name);
      setCurrentAccount(name);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set default');
    }
  }

  async function handleToggleMcp(name: string, enabled: boolean) {
    try {
      await toggleMcp(name, enabled);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle MCP');
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">MCC Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {currentAccount ? `Current account: ${currentAccount}` : 'No account selected'}
            </p>
          </div>
          <Button variant="outline" onClick={loadAll}>
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="accounts">
          <TabsList className="mb-4">
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>

          {/* Accounts Tab */}
          <TabsContent value="accounts">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Account List */}
              <Card>
                <CardHeader>
                  <CardTitle>Accounts</CardTitle>
                  <CardDescription>Your configured accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  {accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No accounts yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {accounts.map((acc) => (
                        <div
                          key={acc.name}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div>
                            <p className="font-medium">{acc.name}</p>
                            <p className="text-xs text-muted-foreground">{acc.provider}</p>
                          </div>
                          <div className="flex gap-2">
                            {acc.name === currentAccount && (
                              <span className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                                active
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSetDefault(acc.name)}
                            >
                              Set default
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(acc.name)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Account Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Add Account</CardTitle>
                  <CardDescription>Add a new account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="acc-name">Account Name</Label>
                    <Input
                      id="acc-name"
                      placeholder="e.g. prod"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acc-provider">Provider</Label>
                    <Select value={newProvider} onValueChange={setNewProvider}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acc-apikey">API Key</Label>
                    <Input
                      id="acc-apikey"
                      type="password"
                      placeholder="sk-..."
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={handleAddAccount}>
                    Add Account
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models">
            <Card>
              <CardHeader>
                <CardTitle>Available Models</CardTitle>
                <CardDescription>Models available through MCC providers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {models.map((m) => (
                    <div key={m.id} className="rounded-lg border p-4">
                      <div className="mb-1 font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.description}</div>
                      <div className="mt-2 text-xs">
                        <span className="font-medium">Default:</span> {m.defaultModel}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Base URL:</span>{' '}
                        {m.baseUrl || '(Anthropic direct)'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MCP Tab */}
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
                        <span className="text-xs text-muted-foreground">
                          {server.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <Switch
                          checked={server.enabled}
                          onCheckedChange={(checked) => handleToggleMcp(server.name, checked)}
                        />
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
