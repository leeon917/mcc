/**
 * MCP Server Registry
 */

import * as fs from 'fs';
import * as path from 'path';

export interface McpServerConfig {
  type: 'stdio' | 'http';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  builtin?: boolean;
}

export interface McpRegistryEntry {
  name: string;
  displayName: string;
  description: string;
  config: McpServerConfig;
  enabledByDefault: boolean;
}

function getMccHome(): string {
  return process.env.MCC_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.mcc');
}

export const BUILTIN_MCP_SERVERS: readonly McpRegistryEntry[] = [
  {
    name: 'mcc-websearch',
    displayName: 'WebSearch',
    description:
      'Multi-provider web search (Exa, Tavily, Brave Search, DuckDuckGo).',
    config: {
      type: 'stdio',
      command: 'node',
      args: [path.join(getMccHome(), 'mcp', 'mcc-websearch-server.cjs')],
      env: {},
      builtin: true,
    },
    enabledByDefault: true,
  },
  {
    name: 'mcc-image-analysis',
    displayName: 'Image Analysis',
    description: 'Image and PDF analysis via vision models.',
    config: {
      type: 'stdio',
      command: 'node',
      args: [path.join(getMccHome(), 'mcp', 'mcc-image-analysis-server.cjs')],
      env: {},
      builtin: true,
    },
    enabledByDefault: true,
  },
];

export function getBuiltinServerPath(serverName: string): string | null {
  const libDir = path.join(__dirname, '..', '..', 'lib', 'mcp');
  const fileName =
    serverName === 'mcc-websearch'
      ? 'mcc-websearch-server.cjs'
      : serverName === 'mcc-image-analysis'
        ? 'mcc-image-analysis-server.cjs'
        : null;
  if (!fileName) return null;
  const candidate = path.join(libDir, fileName);
  return fs.existsSync(candidate) ? candidate : null;
}

export function getServerByName(name: string): McpRegistryEntry | undefined {
  return BUILTIN_MCP_SERVERS.find((s) => s.name === name);
}
