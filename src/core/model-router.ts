/**
 * Model Router - Builds Claude Code env vars from a Profile
 *
 * Mirrors CCS's tiered model mapping:
 *   ANTHROPIC_MODEL                  = Default model
 *   ANTHROPIC_DEFAULT_OPUS_MODEL    = Opus tier
 *   ANTHROPIC_DEFAULT_SONNET_MODEL  = Sonnet tier
 *   ANTHROPIC_DEFAULT_HAIKU_MODEL   = Haiku tier
 *   ANTHROPIC_SMALL_FAST_MODEL      = Alias for Haiku tier
 */

import type { Profile } from '../accounts/store';

export interface ProfileEnv {
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_AUTH_TOKEN: string;
  ANTHROPIC_MODEL: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
  ANTHROPIC_SMALL_FAST_MODEL: string;
  DISABLE_TELEMETRY: '1';
  DISABLE_COST_WARNINGS: '1';
  CLAUDE_CONFIG_DIR: string;
}

/**
 * Build env vars for launching Claude Code with a profile.
 * Falls back to profile.model for any missing tier.
 */
export function buildProfileEnv(profile: Profile, apiKey: string, claudeConfigDir: string): ProfileEnv {
  const model = profile.model;
  return {
    ANTHROPIC_BASE_URL: profile.baseUrl,
    ANTHROPIC_AUTH_TOKEN: apiKey,
    ANTHROPIC_MODEL: model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: profile.opusModel ?? model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: profile.sonnetModel ?? model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: profile.haikuModel ?? model,
    ANTHROPIC_SMALL_FAST_MODEL: profile.haikuModel ?? model,
    DISABLE_TELEMETRY: '1',
    DISABLE_COST_WARNINGS: '1',
    CLAUDE_CONFIG_DIR: claudeConfigDir,
  };
}
