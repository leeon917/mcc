/**
 * `mcc <profile> [args...]` — launch Claude Code with the given profile.
 *
 * Owns the full launch lifecycle: validate profile → ensure instance →
 * sync MCP servers → init session logging → (optionally) start the
 * OpenAI translation proxy → spawn `claude` with the assembled env.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import pc from 'picocolors';
import { getProfile, getProfileApiKey, listProfiles } from '../accounts/store';
import { MCCInstanceManager } from '../accounts/instance-manager';
import { buildProfileEnv } from '../core/model-router';
import { syncInstanceMcpServers } from '../mcp/installer';
import { BUILTIN_MCP_SERVERS } from '../mcp/registry';
import {
  readMcpConfig,
  getEnabledWebSearchProviders,
  getActiveImageAnalysisProvider,
} from '../mcp/mcp-config';
import { startProxy } from '../proxy/proxy-daemon';
import { log, init, makeSessionId, isDebugEnabled } from '../shared/logger';

const instanceMgr = new MCCInstanceManager();

export async function cmdLaunch(args: string[]): Promise<void> {
  const profileName = args[0];
  if (!profileName) {
    console.error('[!] Usage: mcc <profile> [args...]');
    process.exit(1);
  }

  const profile = getProfile(profileName);
  if (!profile) {
    console.error(`[!] Profile not found: ${profileName}`);
    console.error('[i] Available profiles:');
    for (const p of listProfiles()) {
      console.error(`  - ${p.name} (baseUrl: ${p.baseUrl})`);
    }
    process.exit(1);
  }

  const proto = profile.protocol || 'anthropic';
  console.log(`  ${pc.cyan(pc.bold('●'))} ${pc.bold(profileName)}  ${pc.dim('·')}  ${pc.cyan(profile.model)}  ${pc.dim('·')}  ${pc.dim(proto)}`);

  const apiKey = getProfileApiKey(profileName);
  if (!apiKey) {
    console.error(`[!] No API key found for profile: ${profileName}`);
    process.exit(1);
  }

  // Read MCP config early so we can display provider info
  const mcpConfig = readMcpConfig();
  const wsProviders = getEnabledWebSearchProviders(mcpConfig);
  const iaProvider = getActiveImageAnalysisProvider(mcpConfig);

  const instancePath = await instanceMgr.ensureInstance(profileName);
  console.log(`  ${pc.dim('instance')}  ${pc.dim(instancePath)}`);

  syncInstanceMcpServers(instancePath, BUILTIN_MCP_SERVERS.map((s) => s.name), profileName);

  // Initialize logging session
  const sessionId = makeSessionId();
  const mccHome = process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
  const logDir = path.join(mccHome, 'logs', profileName, sessionId);
  init(sessionId, logDir);
  log.info('MCC', `Session starting: ${profileName} | log: ${logDir}`);
  console.log(`  ${pc.dim('session')}   ${pc.dim(sessionId)}`);

  // MCP provider summary
  if (wsProviders.length > 0) {
    console.log(`  ${pc.dim('websearch')}      ${pc.dim(wsProviders.join(', '))}`);
  } else if (mcpConfig.websearch.enabled) {
    console.log(`  ${pc.dim('websearch')}      ${pc.dim('none enabled')}`);
  }
  if (mcpConfig.imageAnalysis.enabled) {
    if (iaProvider) {
      console.log(`  ${pc.dim('image')}   ${pc.dim(iaProvider.id)} ${pc.dim('·')} ${pc.cyan(iaProvider.model)}`);
    } else {
      console.log(`  ${pc.dim('image')}   ${pc.dim('no active provider')}`);
    }
  }

  const env = buildProfileEnv(profile, apiKey, instancePath);
  env.MCC_CURRENT_PROFILE = profileName;
  env.MCC_LOG_SESSION_ID = sessionId;
  env.MCC_LOG_DIR = logDir;

  // Debug: key env vars (no secrets)
  if (isDebugEnabled()) {
    const debugEnvs: [string, string][] = [
      ['ANTHROPIC_BASE_URL', env.ANTHROPIC_BASE_URL],
      ['ANTHROPIC_MODEL', env.ANTHROPIC_MODEL],
      ['CLAUDE_CONFIG_DIR', env.CLAUDE_CONFIG_DIR],
      ['MCC_WEBSEARCH_ENABLED', env.MCC_WEBSEARCH_ENABLED || '0'],
      ['MCC_IMAGE_ANALYSIS_ENABLED', env.MCC_IMAGE_ANALYSIS_ENABLED || '0'],
    ];
    if (env.ANTHROPIC_DEFAULT_OPUS_MODEL !== env.ANTHROPIC_MODEL)
      debugEnvs.push(['ANTHROPIC_DEFAULT_OPUS_MODEL', env.ANTHROPIC_DEFAULT_OPUS_MODEL]);
    if (env.ANTHROPIC_DEFAULT_SONNET_MODEL !== env.ANTHROPIC_MODEL)
      debugEnvs.push(['ANTHROPIC_DEFAULT_SONNET_MODEL', env.ANTHROPIC_DEFAULT_SONNET_MODEL]);
    if (env.ANTHROPIC_DEFAULT_HAIKU_MODEL !== env.ANTHROPIC_MODEL)
      debugEnvs.push(['ANTHROPIC_DEFAULT_HAIKU_MODEL', env.ANTHROPIC_DEFAULT_HAIKU_MODEL]);

    console.log(`  ${pc.dim('---')}`);
    for (const [k, v] of debugEnvs) {
      console.log(`  ${pc.dim('env')}       ${pc.dim(k)}=${pc.dim(v)}`);
    }
  }

  // Start translation proxy for OpenAI-compatible profiles
  if (profile.protocol === 'openai') {
    try {
      const proxyInfo = await startProxy(profileName, profile.baseUrl, apiKey, profile.model, profile.proxyChatCompletionsPath);
      env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${proxyInfo.port}`;
      env.ANTHROPIC_AUTH_TOKEN = proxyInfo.authToken;
      // MCP image analysis also needs to go through the proxy
      env.MCC_IMAGE_ANALYSIS_RUNTIME_BASE_URL = `http://127.0.0.1:${proxyInfo.port}`;
      env.MCC_IMAGE_ANALYSIS_RUNTIME_API_KEY = proxyInfo.authToken;
      console.log(`  ${pc.dim('proxy')}     ${pc.cyan(`:${proxyInfo.port}`)}`);
    } catch (e) {
      console.error(`[!] Failed to start translation proxy: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  console.log(`\n  ${pc.green('✓')} ${pc.bold('launching Claude Code')}`);
  const remainingArgs = args.slice(1);
  const child = spawn('claude', remainingArgs, {
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}
