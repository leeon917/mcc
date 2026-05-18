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
  websearch: {
    enabled: true,
    providers: {
      duckduckgo: { enabled: true },
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
        model: 'qwen-vl-plus',
        format: 'openai',
      },
      kimi: {
        enabled: false,
        baseUrl: 'https://api.moonshot.cn/v1',
        apiKey: '',
        model: 'moonshot-v1-128k-vision-preview',
        format: 'openai',
      },
      minimax: {
        enabled: false,
        baseUrl: 'https://api.minimaxi.com/anthropic',
        apiKey: '',
        model: 'MiniMax-VL-01',
        format: 'anthropic',
      },
      deepseek: {
        enabled: false,
        baseUrl: 'https://api.deepseek.com/anthropic',
        apiKey: '',
        model: 'deepseek-v4-pro[1m]',
        format: 'anthropic',
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
      duckduckgo: { name: 'DuckDuckGo', needsApiKey: false, description: 'Free, no API key needed' },
      exa: { name: 'Exa', needsApiKey: true, description: 'AI-powered search' },
      tavily: { name: 'Tavily', needsApiKey: true, description: 'Search API for AI' },
      brave: { name: 'Brave Search', needsApiKey: true, description: 'Privacy-focused search' },
    },
    imageAnalysis: {
      ali: {
        name: '阿里 DashScope',
        format: 'openai' as const,
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: ['qwen-vl-plus', 'qwen3-vl-flash', 'qwen-vl-max', 'qwen-vl-ocr', 'qvq-max', 'qvq-plus'],
      },
      kimi: {
        name: 'Kimi (Moonshot)',
        format: 'openai' as const,
        baseUrl: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-128k-vision-preview', 'moonshot-v1-32k-vision-preview'],
      },
      minimax: {
        name: 'MiniMax',
        format: 'anthropic' as const,
        baseUrl: 'https://api.minimaxi.com/anthropic',
        models: ['MiniMax-VL-01'],
      },
      deepseek: {
        name: 'DeepSeek',
        format: 'anthropic' as const,
        baseUrl: 'https://api.deepseek.com/anthropic',
        models: ['deepseek-v4-pro[1m]', 'deepseek-v4-pro'],
      },
    },
  };
}

/** Get the first enabled image analysis provider config, or null */
export function getActiveImageAnalysisProvider(config: McpConfig): (ImageAnalysisProvider & { id: string }) | null {
  for (const [id, provider] of Object.entries(config.imageAnalysis.providers)) {
    if (provider.enabled && provider.apiKey && provider.baseUrl) {
      return { id, ...provider };
    }
  }
  return null;
}

/** Get all enabled websearch provider IDs */
export function getEnabledWebSearchProviders(config: McpConfig): string[] {
  return Object.entries(config.websearch.providers)
    .filter(([, p]) => p.enabled)
    .map(([id]) => id);
}
