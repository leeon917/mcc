/**
 * useMcpConfig — owns everything in the "MCP domain":
 *   - WebSearch + ImageAnalysis provider config (with dirty/saving/saved flags)
 *   - built-in MCP server enable state
 *   - external MCP server registry
 *   - per-instance toggles
 *
 * The dirty/saved bookkeeping mirrors what App.tsx used to do inline —
 * pulled in here so SaveBar can be a dumb child reading hook state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getMcpServers,
  getAllMcpServers,
  getExternalMcpServers,
  toggleMcp,
  addExternalMcpServer as apiAddExternal,
  removeExternalMcpServer as apiRemoveExternal,
  getMcpConfig,
  updateMcpConfig,
  getProviderPresets,
  type McpServer,
  type AllMcpServer,
  type ExternalMcpServer,
  type McpConfig,
  type ProviderPresets,
} from '@/lib/api';
import type { McpSection } from '@/types/domain';
import { strings } from '@/lib/strings';

export interface UseMcpConfigResult {
  mcpConfig: McpConfig | null;
  presets: ProviderPresets | null;
  mcpServers: McpServer[];
  allMcpServers: AllMcpServer[];
  externalMcpServers: ExternalMcpServer[];
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  loading: boolean;
  error: string;
  clearError: () => void;
  reload: () => Promise<void>;
  save: () => Promise<void>;
  toggleSection: (section: McpSection) => void;
  toggleProvider: (section: McpSection, id: string) => void;
  updateField: (section: McpSection, id: string, field: string, value: unknown) => void;
  toggleServer: (name: string, enabled: boolean, instance?: string) => Promise<void>;
  addExternal: (server: ExternalMcpServer) => Promise<void>;
  removeExternal: (name: string) => Promise<void>;
}

export function useMcpConfig(): UseMcpConfigResult {
  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [presets, setPresets] = useState<ProviderPresets | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [allMcpServers, setAllMcpServers] = useState<AllMcpServer[]>([]);
  const [externalMcpServers, setExternalMcpServers] = useState<ExternalMcpServer[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const reload = useCallback(async () => {
    try {
      const [config, pres, mcps, allMcps, externalMcps] = await Promise.all([
        getMcpConfig(),
        getProviderPresets(),
        getMcpServers(),
        getAllMcpServers(),
        getExternalMcpServers(),
      ]);
      setMcpConfig(config);
      setPresets(pres);
      setMcpServers(mcps);
      setAllMcpServers(allMcps);
      setExternalMcpServers(externalMcps);
      setDirty(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errors.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(async () => {
    if (!mcpConfig || !dirty) return;
    setSaving(true);
    try {
      await updateMcpConfig(mcpConfig);
      setDirty(false);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errors.failedToSaveMcpConfig);
    } finally {
      setSaving(false);
    }
  }, [mcpConfig, dirty]);

  const toggleSection = useCallback((section: McpSection) => {
    setMcpConfig((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next[section].enabled = !next[section].enabled;
      return next;
    });
    setDirty(true);
  }, []);

  const toggleProvider = useCallback((section: McpSection, id: string) => {
    setMcpConfig((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next[section].providers[id].enabled = !next[section].providers[id].enabled;
      return next;
    });
    setDirty(true);
  }, []);

  const updateField = useCallback((section: McpSection, id: string, field: string, value: unknown) => {
    setMcpConfig((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      // The two provider shapes differ but both are loose Record<string, unknown>
      // at the field level — index access is the cleanest expression.
      (next[section].providers[id] as unknown as Record<string, unknown>)[field] = value;
      return next;
    });
    setDirty(true);
  }, []);

  const toggleServer = useCallback(async (name: string, enabled: boolean, instance?: string) => {
    try {
      await toggleMcp(name, enabled, instance);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errors.failedToToggleMcp);
    }
  }, [reload]);

  const addExternal = useCallback(async (server: ExternalMcpServer) => {
    try {
      await apiAddExternal(server);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errors.failedToAddExternal);
    }
  }, [reload]);

  const removeExternal = useCallback(async (name: string) => {
    try {
      await apiRemoveExternal(name);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errors.failedToRemoveExternal);
    }
  }, [reload]);

  return {
    mcpConfig,
    presets,
    mcpServers,
    allMcpServers,
    externalMcpServers,
    dirty,
    saving,
    saved,
    loading,
    error,
    clearError: () => setError(''),
    reload,
    save,
    toggleSection,
    toggleProvider,
    updateField,
    toggleServer,
    addExternal,
    removeExternal,
  };
}
