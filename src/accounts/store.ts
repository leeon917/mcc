/**
 * Profile Store - File-based profile management
 *
 * Storage structure:
 *   ~/.mcc/
 *   ├── profiles.json          # Profile metadata + tiered model config
 *   └── profiles/
 *       └── <profile-name>/
 *           └── .key          # API key (plain text)
 */

import * as fs from 'fs';
import * as path from 'path';

function getMccHome(): string {
  return process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
}

function getProfilesDir(): string {
  return path.join(getMccHome(), 'profiles');
}

function getProfilesJsonPath(): string {
  return path.join(getMccHome(), 'profiles.json');
}

export interface Profile {
  name: string;
  baseUrl: string;
  model: string;           // Default model
  opusModel?: string;       // Tier 1 (Opus)
  sonnetModel?: string;     // Tier 2 (Sonnet)
  haikuModel?: string;      // Tier 3 (Haiku / small-fast)
  protocol?: 'anthropic' | 'openai';  // 'anthropic' = direct, 'openai' = needs translation proxy
  proxyChatCompletionsPath?: string;  // Override default /v1/chat/completions (e.g. '/chat/completions' for BigModel)
  createdAt: string;
  lastUsedAt?: string;
}

interface ProfilesJson {
  version: number;
  profiles: Record<string, Profile>;
  defaultProfile?: string;
}

function readProfilesJson(): ProfilesJson {
  const jsonPath = getProfilesJsonPath();
  if (!fs.existsSync(jsonPath)) {
    return { version: 1, profiles: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return { version: 1, profiles: {} };
  }
}

function writeProfilesJson(data: ProfilesJson): void {
  const jsonPath = getProfilesJsonPath();
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function listProfiles(): Profile[] {
  return Object.values(readProfilesJson().profiles);
}

export function getProfile(name: string): Profile | undefined {
  return readProfilesJson().profiles[name];
}

export function getDefaultProfile(): string | undefined {
  return readProfilesJson().defaultProfile;
}

export function saveProfile(profile: Profile, apiKey: string): void {
  const data = readProfilesJson();
  const profileDir = path.join(getProfilesDir(), profile.name);
  fs.mkdirSync(profileDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(profileDir, '.key'), apiKey, { encoding: 'utf8', mode: 0o600 });
  data.profiles[profile.name] = { ...profile, lastUsedAt: new Date().toISOString() };
  writeProfilesJson(data);
}

export function getProfileApiKey(name: string): string | undefined {
  const keyPath = path.join(getProfilesDir(), name, '.key');
  if (!fs.existsSync(keyPath)) return undefined;
  return fs.readFileSync(keyPath, 'utf8').trim();
}

export function deleteProfile(name: string): void {
  const data = readProfilesJson();
  if (!data.profiles[name]) return;
  delete data.profiles[name];
  if (data.defaultProfile === name) {
    data.defaultProfile = Object.keys(data.profiles)[0];
  }
  writeProfilesJson(data);
  const profileDir = path.join(getProfilesDir(), name);
  if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true });
}

export function setDefaultProfile(name: string): void {
  const data = readProfilesJson();
  if (!data.profiles[name]) throw new Error(`Profile not found: ${name}`);
  data.defaultProfile = name;
  writeProfilesJson(data);
}

export function hasProfile(name: string): boolean {
  return name in readProfilesJson().profiles;
}
