const API_BASE = '/api';

export interface AccountInfo {
  name: string;
  provider: string;
  defaultModel?: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface ModelPreset {
  id: string;
  name: string;
  description: string;
  defaultModel: string;
  baseUrl: string;
}

export interface McpServer {
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
}

export async function getAccounts(): Promise<AccountInfo[]> {
  const res = await fetch(`${API_BASE}/accounts`);
  if (!res.ok) throw new Error('Failed to fetch accounts');
  return res.json();
}

export async function addAccount(name: string, provider: string, apiKey: string): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, provider, apiKey }),
  });
  if (!res.ok) throw new Error('Failed to add account');
}

export async function deleteAccount(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/${name}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete account');
}

export async function setDefaultAccount(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/${name}/default`, { method: 'PUT' });
  if (!res.ok) throw new Error('Failed to set default account');
}

export async function getModels(): Promise<ModelPreset[]> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function getMcpServers(): Promise<McpServer[]> {
  const res = await fetch(`${API_BASE}/mcp`);
  if (!res.ok) throw new Error('Failed to fetch MCP servers');
  return res.json();
}

export async function toggleMcp(name: string, enabled: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/mcp/${name}/${enabled ? 'enable' : 'disable'}`, {
    method: 'PUT',
  });
  if (!res.ok) throw new Error('Failed to toggle MCP server');
}

export async function getStatus(): Promise<{ currentAccount?: string; currentModel?: string }> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}
