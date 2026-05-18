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

export interface ExternalMcpServer {
  name: string;
  displayName: string;
  description: string;
  command: string;
  args: string[];
  envVars: Record<string, string>;
  enabledByDefault: boolean;
}

export interface AllMcpServer {
  name: string;
  displayName: string;
  description: string;
  builtin: boolean;
  enabledByDefault?: boolean;
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

export async function updateProfile(name: string, data: Partial<Profile> & { apiKey?: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/profiles/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update profile');
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

export async function toggleMcp(name: string, enabled: boolean, instance?: string): Promise<void> {
  const url = instance
    ? `${API_BASE}/mcp/${name}/${enabled ? 'enable' : 'disable'}?instance=${encodeURIComponent(instance)}`
    : `${API_BASE}/mcp/${name}/${enabled ? 'enable' : 'disable'}`;
  const res = await fetch(url, { method: 'PUT' });
  if (!res.ok) throw new Error('Failed to toggle MCP server');
}

export async function getAllMcpServers(instance?: string): Promise<AllMcpServer[]> {
  const url = instance
    ? `${API_BASE}/mcp/all?instance=${encodeURIComponent(instance)}`
    : `${API_BASE}/mcp/all`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch all MCP servers');
  return res.json();
}

export async function getExternalMcpServers(): Promise<ExternalMcpServer[]> {
  const res = await fetch(`${API_BASE}/mcp/external`);
  if (!res.ok) throw new Error('Failed to fetch external MCP servers');
  return res.json();
}

export async function addExternalMcpServer(server: ExternalMcpServer): Promise<void> {
  const res = await fetch(`${API_BASE}/mcp/external`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(server),
  });
  if (!res.ok) throw new Error('Failed to add external MCP server');
}

export async function removeExternalMcpServer(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/mcp/external/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove external MCP server');
}

export async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/ping`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getStatus(): Promise<{ currentProfile?: string }> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

// MCP Config types and API

export interface WebSearchProviderConfig {
  enabled: boolean;
  apiKey?: string;
}

export interface ImageAnalysisProviderConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  format: 'anthropic' | 'openai';
}

export interface McpConfig {
  websearch: {
    enabled: boolean;
    providers: Record<string, WebSearchProviderConfig>;
  };
  imageAnalysis: {
    enabled: boolean;
    providers: Record<string, ImageAnalysisProviderConfig>;
  };
}

export interface ProviderPresets {
  websearch: Record<string, { name: string; needsApiKey: boolean; description: string }>;
  imageAnalysis: Record<string, { name: string; format: string; baseUrl: string; models: string[] }>;
}

export async function getMcpConfig(): Promise<McpConfig> {
  const res = await fetch(`${API_BASE}/mcp-config`);
  if (!res.ok) throw new Error('Failed to fetch MCP config');
  return res.json();
}

export async function updateMcpConfig(config: McpConfig): Promise<void> {
  const res = await fetch(`${API_BASE}/mcp-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update MCP config');
}

export async function getProviderPresets(): Promise<ProviderPresets> {
  const res = await fetch(`${API_BASE}/mcp-config/presets`);
  if (!res.ok) throw new Error('Failed to fetch provider presets');
  return res.json();
}
