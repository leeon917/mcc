#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function loadRuntimeModule() {
  const candidates = [
    path.join(__dirname, 'image-analysis-runtime.cjs'),
    path.join(__dirname, '../mcp-hooks/image-analysis-runtime.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  throw new Error(
    `mcc-image-analysis runtime not found. Checked: ${candidates.map((candidate) => path.basename(candidate)).join(', ')}`
  );
}

const { analyzeFile, isAnalyzableFile } = loadRuntimeModule();

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'mcc-image-analysis';
const SERVER_VERSION = '1.0.0';
const TOOL_NAME = 'ImageAnalysis';
const TOOL_ALIASES = ['AnalyzeImage', 'ReadImage'];
const TEMPLATE_NAMES = ['default', 'screenshot', 'document'];
const TOOL_DESCRIPTION =
  'Analyze a local image or PDF file with MCC provider-backed vision. Prefer this tool over Read for image and PDF paths. Use Read for text, code, and other plain files.';

// Debug logging (set MCC_DEBUG_MCP=1 to enable)
const DEBUG = process.env.MCC_DEBUG_MCP === '1';
function debugLog(...args) {
  if (DEBUG) {
    const ts = new Date().toISOString();
    process.stderr.write(`[MCC-ImageAnalysis ${ts}] ${args.join(' ')}\n`);
  }
}

function isSupportedToolName(name) {
  return name === TOOL_NAME || TOOL_ALIASES.includes(name);
}

function shouldExposeTools() {
  return (
    process.env.MCC_IMAGE_ANALYSIS_ENABLED === '1' &&
    process.env.MCC_IMAGE_ANALYSIS_SKIP !== '1' &&
    Boolean(process.env.MCC_CURRENT_PROVIDER || process.env.MCC_IMAGE_ANALYSIS_MODEL)
  );
}

function getTools() {
  if (!shouldExposeTools()) {
    return [];
  }

  return [
    {
      name: TOOL_NAME,
      description: TOOL_DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
                filePath: {
                  type: 'string',
                  description:
                    'Workspace-relative path, or an absolute path inside the current workspace, to a local image or PDF file to analyze.',
                },
          focus: {
            type: 'string',
            description:
              'Optional question or area of focus, for example "explain the error dialog" or "transcribe the visible text".',
          },
          template: {
            type: 'string',
            enum: TEMPLATE_NAMES,
            description:
              'Optional prompt template override. Use screenshot for UI captures, document for PDFs/docs, or default for general images.',
          },
        },
        required: ['filePath'],
        additionalProperties: false,
      },
    },
  ];
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function writeResponse(id, result) {
  writeMessage({
    jsonrpc: '2.0',
    id,
    result,
  });
}

function writeError(id, code, message) {
  writeMessage({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  });
}

function formatResult(filePath, result, focus) {
  const lines = [
    '[Image Analysis via MCC]',
    '',
    `File: ${path.basename(filePath)} (${(result.fileSize / 1024).toFixed(1)} KB)`,
    `Model: ${result.model}`,
    `Template: ${result.template}`,
  ];

  if (focus && focus.trim()) {
    lines.push(`Focus: ${focus.trim()}`);
  }

  lines.push('', '---', '', result.description);
  return lines.join('\n');
}

function normalizeTemplate(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return TEMPLATE_NAMES.includes(normalized) ? normalized : undefined;
}

function normalizePathForComparison(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isPathWithinWorkspace(workspaceRoot, candidatePath) {
  const relativePath = path.relative(workspaceRoot, candidatePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

function resolveFilePath(toolArgs) {
  if (!toolArgs || typeof toolArgs !== 'object') {
    return '';
  }

  const candidates = [toolArgs.filePath, toolArgs.file_path, toolArgs.path];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return '';
}

function resolveWorkspaceFilePath(toolArgs) {
  const requestedPath = resolveFilePath(toolArgs);
  if (!requestedPath) {
    return { filePath: '', error: null };
  }

  const workspaceRoot = (() => {
    try {
      return fs.realpathSync(process.cwd());
    } catch {
      return path.resolve(process.cwd());
    }
  })();
  const absolutePath = path.resolve(process.cwd(), requestedPath);
  const comparisonPath = (() => {
    if (fs.existsSync(absolutePath)) {
      return fs.realpathSync(absolutePath);
    }

    const suffixSegments = [];
    let currentPath = absolutePath;
    while (!fs.existsSync(currentPath)) {
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        break;
      }
      suffixSegments.unshift(path.basename(currentPath));
      currentPath = parentPath;
    }

    const resolvedExistingPath = fs.existsSync(currentPath)
      ? fs.realpathSync(currentPath)
      : path.resolve(currentPath);
    return path.join(resolvedExistingPath, ...suffixSegments);
  })();

  if (
    !isPathWithinWorkspace(
      normalizePathForComparison(workspaceRoot),
      normalizePathForComparison(comparisonPath)
    )
  ) {
    return {
      filePath: '',
      error: 'ImageAnalysis only allows files inside the current workspace.',
    };
  }

  return {
    filePath: absolutePath,
    error: null,
  };
}

function resolveFocus(toolArgs) {
  return typeof toolArgs.focus === 'string' && toolArgs.focus.trim().length > 0
    ? toolArgs.focus.trim()
    : undefined;
}

function formatErrorDetail(filePath, error) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith('FILE_TOO_LARGE:')) {
    const fileSizeBytes = Number.parseInt(message.split(':')[1], 10);
    const sizeMb = Number.isFinite(fileSizeBytes) ? (fileSizeBytes / 1024 / 1024).toFixed(1) : '?';
    return `ImageAnalysis cannot process ${path.basename(filePath)} because it is too large (${sizeMb} MB). The limit is 10 MB.`;
  }

  if (message.startsWith('AUTH_ERROR:')) {
    return `ImageAnalysis failed because MCC vision auth for this provider is unavailable (${message.split(':')[1]}).`;
  }

  if (message.startsWith('RATE_LIMIT:')) {
    return `ImageAnalysis hit a provider rate limit while analyzing ${path.basename(filePath)}.`;
  }

  if (message.startsWith('API_ERROR:')) {
    return `ImageAnalysis failed at the MCC provider route while analyzing ${path.basename(filePath)}.`;
  }

  if (
    message === 'TIMEOUT' ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('ENETUNREACH') ||
    message.includes('EAI_AGAIN')
  ) {
    return `ImageAnalysis could not reach the configured MCC provider route for ${path.basename(filePath)}.`;
  }

  if (message.includes('EACCES') || message.includes('EPERM')) {
    return `ImageAnalysis could not read ${filePath} because access was denied.`;
  }

  return `ImageAnalysis failed for ${path.basename(filePath)}: ${message}`;
}

async function handleToolCall(message) {
  const id = message.id;
  const params = message.params || {};
  const toolArgs = params.arguments || {};
  const toolName = params.name || '<missing>';

  debugLog('=== Tool Call ===');
  debugLog('Tool:', toolName);
  debugLog('Args:', JSON.stringify(toolArgs, null, 2));
  debugLog('Env: MCC_IMAGE_ANALYSIS_MODEL=', process.env.MCC_IMAGE_ANALYSIS_MODEL || '(not set)');
  debugLog('Env: MCC_IMAGE_ANALYSIS_FORMAT=', process.env.MCC_IMAGE_ANALYSIS_FORMAT || '(not set)');
  debugLog('Env: MCC_IMAGE_ANALYSIS_RUNTIME_BASE_URL=', process.env.MCC_IMAGE_ANALYSIS_RUNTIME_BASE_URL || '(not set)');

  if (!isSupportedToolName(toolName)) {
    writeError(id, -32602, `Unknown tool: ${toolName}`);
    return;
  }

  if (!shouldExposeTools()) {
    writeResponse(id, {
      content: [
        {
          type: 'text',
          text: 'MCC ImageAnalysis is unavailable for this profile or no provider-backed vision route is ready.',
        },
      ],
      isError: true,
    });
    return;
  }

  const { filePath, error: filePathError } = resolveWorkspaceFilePath(toolArgs);
  if (!filePath) {
    writeError(
      id,
      -32602,
      filePathError || `Tool "${TOOL_NAME}" requires a non-empty filePath.`
    );
    return;
  }

  if (!fs.existsSync(filePath)) {
    writeResponse(id, {
      content: [{ type: 'text', text: `ImageAnalysis could not find file: ${filePath}` }],
      isError: true,
    });
    return;
  }

  if (!isAnalyzableFile(filePath)) {
    writeResponse(id, {
      content: [
        {
          type: 'text',
          text: `ImageAnalysis only supports image and PDF files. Use Read for ${path.basename(filePath)} instead.`,
        },
      ],
      isError: true,
    });
    return;
  }

  const focus = resolveFocus(toolArgs);
  const template = normalizeTemplate(toolArgs.template);

  debugLog('Resolved filePath:', filePath);
  debugLog('Resolved focus:', focus || '(none)');
  debugLog('Resolved template:', template || '(auto)');
  debugLog('Calling analyzeFile...');

  try {
    const result = await analyzeFile(filePath, { focus, template });
    debugLog('analyzeFile success, model:', result.model, 'desc length:', result.description?.length);
    writeResponse(id, {
      content: [{ type: 'text', text: formatResult(filePath, result, focus) }],
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    debugLog('analyzeFile FAILED:', errMsg);
    writeResponse(id, {
      content: [{ type: 'text', text: formatErrorDetail(filePath, error) }],
      isError: true,
    });
  }
}

async function handleMessage(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return;
  }

  switch (message.method) {
    case 'initialize':
      writeResponse(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
        },
      });
      return;
    case 'notifications/initialized':
      return;
    case 'ping':
      writeResponse(message.id, {});
      return;
    case 'tools/list':
      writeResponse(message.id, { tools: getTools() });
      return;
    case 'tools/call':
      await handleToolCall(message);
      return;
    default:
      if (message.id !== undefined) {
        writeError(message.id, -32601, `Method not found: ${message.method}`);
      }
  }
}

let inputBuffer = Buffer.alloc(0);

function processIncomingBuffer() {
  while (true) {
    let body;
    const startsWithLegacyHeaders = inputBuffer
      .slice(0, Math.min(inputBuffer.length, 32))
      .toString('utf8')
      .toLowerCase()
      .startsWith('content-length:');

    if (startsWithLegacyHeaders) {
      const headerEnd = inputBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }

      const headerText = inputBuffer.slice(0, headerEnd).toString('utf8');
      const contentLengthMatch = headerText.match(/content-length:\s*(\d+)/i);
      if (!contentLengthMatch) {
        inputBuffer = Buffer.alloc(0);
        return;
      }

      const contentLength = Number.parseInt(contentLengthMatch[1], 10);
      const messageEnd = headerEnd + 4 + contentLength;
      if (inputBuffer.length < messageEnd) {
        return;
      }

      body = inputBuffer.slice(headerEnd + 4, messageEnd).toString('utf8');
      inputBuffer = inputBuffer.slice(messageEnd);
    } else {
      const newlineIndex = inputBuffer.indexOf('\n');
      if (newlineIndex === -1) {
        return;
      }

      body = inputBuffer.slice(0, newlineIndex).toString('utf8').replace(/\r$/, '').trim();
      inputBuffer = inputBuffer.slice(newlineIndex + 1);
      if (!body) {
        continue;
      }
    }

    try {
      const message = JSON.parse(body);
      Promise.resolve(handleMessage(message)).catch((error) => {
        if (message && message.id !== undefined) {
          writeError(message.id, -32603, (error && error.message) || 'Internal error');
        } else if (process.env.MCC_DEBUG) {
          console.error(`[mcc-image-analysis] ${error instanceof Error ? error.stack : error}`);
        }
      });
    } catch (error) {
      if (process.env.MCC_DEBUG) {
        console.error(
          `[mcc-image-analysis] Failed to parse JSON-RPC message: ${
            error instanceof Error ? error.message : error
          }`
        );
      }
    }
  }
}

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  processIncomingBuffer();
});

process.stdin.on('end', () => {
  process.exit(0);
});
