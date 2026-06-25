/**
 * MCP Config - Provider configuration for WebSearch and ImageAnalysis
 *
 * Storage: ~/.mcc/mcp-config.json
 */

import * as fs from 'fs';
import * as path from 'path';

function getMccHome(): string {
  return process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
}

export function getMcpConfigPath(): string {
  return path.join(getMccHome(), 'mcp-config.json');
}

export interface WebSearchProvider {
  enabled: boolean;
  apiKey?: string;
}

export interface ImageAnalysisProvider {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  format: 'anthropic' | 'openai';
}

export interface McpConfig {
  /**
   * Auto-mirror the user's global ~/.claude.json MCP servers into every profile
   * on each launch (added globally → appears everywhere next launch; removed →
   * disappears). Default true. Set false to opt out and manage MCP per-profile.
   */
  globalMcpSync: boolean;
  websearch: {
    enabled: boolean;
    providers: Record<string, WebSearchProvider>;
  };
  imageAnalysis: {
    enabled: boolean;
    providers: Record<string, ImageAnalysisProvider>;
  };
}

const DEFAULT_CONFIG: McpConfig = {
  globalMcpSync: true,
  websearch: {
    enabled: true,
    providers: {
      duckduckgo: { enabled: true },
      bocha: { enabled: false, apiKey: '' },
      minimax: { enabled: false, apiKey: '' },
      exa: { enabled: false, apiKey: '' },
      tavily: { enabled: false, apiKey: '' },
      brave: { enabled: false, apiKey: '' },
    },
  },
  imageAnalysis: {
    enabled: true,
    providers: {
      ali: {
        enabled: false,
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: '',
        model: 'qwen3-vl-plus',
        format: 'openai',
      },
      xiaomi: {
        enabled: false,
        baseUrl: 'https://api.xiaomimimo.com/v1',
        apiKey: '',
        model: 'mimo-v2-omni',
        format: 'openai',
      },
      minimax: {
        enabled: false,
        baseUrl: 'https://api.minimaxi.com/anthropic',
        apiKey: '',
        model: 'MiniMax-VL-01',
        format: 'anthropic',
      },
      kimi: {
        enabled: false,
        baseUrl: 'https://api.moonshot.cn/v1',
        apiKey: '',
        model: 'moonshot-v1-128k-vision-preview',
        format: 'openai',
      },
      glm: {
        enabled: false,
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: '',
        model: 'glm-4.6v',
        format: 'openai',
      },
      siliconflow: {
        enabled: false,
        baseUrl: 'https://api.siliconflow.cn/v1',
        apiKey: '',
        model: 'Qwen/Qwen3-VL-30B-A3B-Instruct',
        format: 'openai',
      },
    },
  },
};

export function readMcpConfig(): McpConfig {
  const configPath = getMcpConfigPath();
  if (!fs.existsSync(configPath)) {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // Merge with defaults to ensure all fields exist
    return {
      globalMcpSync: raw.globalMcpSync ?? DEFAULT_CONFIG.globalMcpSync,
      websearch: {
        enabled: raw.websearch?.enabled ?? DEFAULT_CONFIG.websearch.enabled,
        providers: { ...DEFAULT_CONFIG.websearch.providers, ...raw.websearch?.providers },
      },
      imageAnalysis: {
        enabled: raw.imageAnalysis?.enabled ?? DEFAULT_CONFIG.imageAnalysis.enabled,
        providers: { ...DEFAULT_CONFIG.imageAnalysis.providers, ...raw.imageAnalysis?.providers },
      },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

export function writeMcpConfig(config: McpConfig): void {
  const configPath = getMcpConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
}

export function getProviderPresets() {
  return {
    websearch: {
      duckduckgo: { name: 'DuckDuckGo', needsApiKey: false, description: '免费，无需 API Key' },
      bocha: {
        name: '博查 Bocha',
        needsApiKey: true,
        description: '国内中文搜索 API，open.bochaai.com',
      },
      minimax: {
        name: 'MiniMax Search',
        needsApiKey: true,
        description: 'MiniMax Token/Coding Plan 联网检索（/v1/coding_plan/search）',
      },
      exa: { name: 'Exa', needsApiKey: true, description: '海外 AI 搜索' },
      tavily: { name: 'Tavily', needsApiKey: true, description: '海外 AI 搜索 API' },
      brave: { name: 'Brave Search', needsApiKey: true, description: '海外，注重隐私' },
    },
    imageAnalysis: {
      ali: {
        name: '阿里通义 (DashScope)',
        format: 'openai' as const,
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: [
          'qwen3-vl-plus',
          'qwen3-vl-flash',
          'qwen-vl-max-latest',
          'qwen-vl-plus',
          'qwen-vl-ocr',
          'qvq-max',
          'qvq-plus',
        ],
      },
      xiaomi: {
        name: '小米 MiMo',
        format: 'openai' as const,
        baseUrl: 'https://api.xiaomimimo.com/v1',
        models: ['mimo-v2-omni', 'mimo-v2-pro'],
      },
      minimax: {
        name: 'MiniMax',
        format: 'anthropic' as const,
        baseUrl: 'https://api.minimaxi.com/anthropic',
        models: ['MiniMax-VL-01'],
      },
      kimi: {
        name: 'Kimi (Moonshot)',
        format: 'openai' as const,
        baseUrl: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-128k-vision-preview', 'moonshot-v1-32k-vision-preview'],
      },
      glm: {
        name: 'GLM (智谱 BigModel)',
        format: 'openai' as const,
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4.6v', 'glm-4.5v', 'glm-4v-plus'],
      },
      siliconflow: {
        name: 'SiliconFlow',
        format: 'openai' as const,
        baseUrl: 'https://api.siliconflow.cn/v1',
        models: ['Qwen/Qwen3-VL-30B-A3B-Instruct', 'Qwen/Qwen3-VL-32B-Instruct'],
      },
    },
  };
}

/**
 * Get every enabled image analysis provider, in config order. The runtime
 * tries them in sequence (fallback chain): if the first 402s / errors, it
 * moves on to the next. Only providers with both a key and a baseUrl qualify.
 */
export function getEnabledImageAnalysisProviders(
  config: McpConfig,
): Array<ImageAnalysisProvider & { id: string }> {
  return Object.entries(config.imageAnalysis.providers)
    .filter(([, p]) => p.enabled && p.apiKey && p.baseUrl)
    .map(([id, p]) => ({ id, ...p }));
}

/** Get the first enabled image analysis provider config, or null */
export function getActiveImageAnalysisProvider(config: McpConfig): (ImageAnalysisProvider & { id: string }) | null {
  return getEnabledImageAnalysisProviders(config)[0] ?? null;
}

/** Get all enabled websearch provider IDs */
export function getEnabledWebSearchProviders(config: McpConfig): string[] {
  return Object.entries(config.websearch.providers)
    .filter(([, p]) => p.enabled)
    .map(([id]) => id);
}
