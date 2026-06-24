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
import { readMcpConfig, getActiveImageAnalysisProvider, getEnabledWebSearchProviders } from '../mcp/mcp-config';

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
  [key: string]: string; // Allow MCP env vars
}

/**
 * Build env vars for launching Claude Code with a profile.
 * Falls back to profile.model for any missing tier.
 */
export function buildProfileEnv(profile: Profile, apiKey: string, claudeConfigDir: string): ProfileEnv {
  const model = profile.model;

  // Read MCP config for provider settings
  const mcpConfig = readMcpConfig();
  const wsProviders = getEnabledWebSearchProviders(mcpConfig);
  const iaProvider = getActiveImageAnalysisProvider(mcpConfig);

  const env: Record<string, string> = {
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

  // MCP: WebSearch
  env.MCC_WEBSEARCH_ENABLED = mcpConfig.websearch.enabled ? '1' : '0';
  for (const p of wsProviders) {
    // Normalize provider id to a valid env-var suffix (no dashes).
    const envKey = p.replace(/-/g, '_').toUpperCase();
    env[`MCC_WEBSEARCH_${envKey}`] = '1';
    const providerConfig = mcpConfig.websearch.providers[p];
    if (providerConfig?.apiKey) {
      const keyEnvMap: Record<string, string> = {
        exa: 'MCC_WEBSEARCH_EXA_API_KEY',
        tavily: 'MCC_WEBSEARCH_TAVILY_API_KEY',
        brave: 'MCC_WEBSEARCH_BRAVE_API_KEY',
        bocha: 'MCC_WEBSEARCH_BOCHA_API_KEY',
        minimax: 'MCC_WEBSEARCH_MINIMAX_API_KEY',
      };
      if (keyEnvMap[p]) {
        env[keyEnvMap[p]] = providerConfig.apiKey;
      }
    }
  }

  // MCP: Image Analysis
  if (mcpConfig.imageAnalysis.enabled && iaProvider) {
    env.MCC_IMAGE_ANALYSIS_ENABLED = '1';
    env.MCC_IMAGE_ANALYSIS_RUNTIME_BASE_URL = iaProvider.baseUrl;
    env.MCC_IMAGE_ANALYSIS_RUNTIME_API_KEY = iaProvider.apiKey;
    env.MCC_IMAGE_ANALYSIS_MODEL = iaProvider.model;
    env.MCC_IMAGE_ANALYSIS_FORMAT = iaProvider.format;
  }

  return env as unknown as ProfileEnv;
}
