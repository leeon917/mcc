/**
 * useProfiles — owns everything in the "profile domain":
 *   - the list of saved profiles
 *   - the current default profile
 *   - the preset catalog (used by the Templates gallery)
 *   - the profile currently being edited (form-state hand-off)
 *
 * Self-fetches on mount. Mutations refetch the affected slices.
 * Errors are surfaced via a single `error` field; the consumer decides
 * how to render it (banner, toast, etc).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getProfiles,
  getStatus,
  getProfilePresets,
  addProfile,
  updateProfile,
  deleteProfile as apiDeleteProfile,
  setDefaultProfile as apiSetDefaultProfile,
  type Profile,
  type ProfilePreset,
} from '@/lib/api';
import type { ProfileFormPayload, PresetInstallArgs } from '@/types/domain';
import { strings } from '@/lib/strings';

export interface UseProfilesResult {
  profiles: Profile[];
  currentProfile: string;
  profilePresets: ProfilePreset[];
  editing: Profile | null;
  loading: boolean;
  error: string;
  setEditing: (p: Profile | null) => void;
  clearError: () => void;
  reload: () => Promise<void>;
  submitProfile: (payload: ProfileFormPayload) => Promise<void>;
  installPreset: (args: PresetInstallArgs) => Promise<boolean>;
  removeProfile: (name: string) => Promise<void>;
  pickDefault: (name: string) => Promise<void>;
}

export function useProfiles(): UseProfilesResult {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState('');
  const [profilePresets, setProfilePresets] = useState<ProfilePreset[]>([]);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [profs, status, presets] = await Promise.all([
        getProfiles(),
        getStatus(),
        getProfilePresets(),
      ]);
      setProfiles(profs);
      setCurrentProfile(status.currentProfile || '');
      setProfilePresets(presets);
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

  const submitProfile = useCallback(async (payload: ProfileFormPayload) => {
    try {
      if (editing) {
        await updateProfile(editing.name, {
          displayName: payload.displayName,
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
          displayName: payload.displayName,
          baseUrl: payload.baseUrl,
          apiKey: payload.apiKey,
          model: payload.model,
          protocol: payload.protocol,
          opusModel: payload.opusModel,
          sonnetModel: payload.sonnetModel,
          haikuModel: payload.haikuModel,
        });
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errors.failedToSaveProfile);
    }
  }, [editing, reload]);

  const installPreset = useCallback(async (args: PresetInstallArgs): Promise<boolean> => {
    try {
      await addProfile(args);
      await reload();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errors.failedToInstallPreset);
      return false;
    }
  }, [reload]);

  const removeProfile = useCallback(async (name: string) => {
    try {
      await apiDeleteProfile(name);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errors.failedToDelete);
    }
  }, [reload]);

  const pickDefault = useCallback(async (name: string) => {
    try {
      await apiSetDefaultProfile(name);
      setCurrentProfile(name);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errors.failedToSetDefault);
    }
  }, [reload]);

  return {
    profiles,
    currentProfile,
    profilePresets,
    editing,
    loading,
    error,
    setEditing,
    clearError: () => setError(''),
    reload,
    submitProfile,
    installPreset,
    removeProfile,
    pickDefault,
  };
}
