const API_BASE = '/api';

export interface Profile {
  name: string;
  baseUrl: string;
  model: string;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
  protocol?: 'anthropic' | 'openai';
  createdAt: string;
  lastUsedAt?: string;
}

export interface McpServer {
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
}

export async function getProfiles(): Promise<Profile[]> {
  const res = await fetch(`${API_BASE}/profiles`);
  if (!res.ok) throw new Error('Failed to fetch profiles');
  return res.json();
}

export async function addProfile(profile: Omit<Profile, 'createdAt'> & { apiKey: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Failed to add profile');
}

export async function deleteProfile(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/profiles/${name}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete profile');
}

export async function setDefaultProfile(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/profiles/${name}/default`, { method: 'PUT' });
  if (!res.ok) throw new Error('Failed to set default profile');
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

export async function getStatus(): Promise<{ currentProfile?: string }> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}
