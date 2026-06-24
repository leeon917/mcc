const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp', '.tiff'];
const PDF_EXTENSIONS = ['.pdf'];
const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_SEC = 60;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_PROMPT_TEMPLATE_BYTES = 32 * 1024;
const SCREENSHOT_NAME_REGEX =
  /(screen[-_ ]?shot|screen[-_ ]?capture|screencap|snapshot|snip|clip|capture)/i;
const TEMPLATE_FILE_NAMES = {
  default: 'default.txt',
  screenshot: 'screenshot.txt',
  document: 'document.txt',
};
const FALLBACK_PROMPTS = {
  default: `Analyze this image/document thoroughly and provide a detailed description.

Include:
1. Overall content and purpose
2. Text content (if any) - transcribe important text verbatim
3. Visual elements (diagrams, charts, UI components, icons)
4. Layout and structure (sections, hierarchy, flow)
5. Colors, styling, notable design elements
6. Any actionable information (buttons, links, code snippets)

Be comprehensive - this description replaces direct visual access.
The AI assistant reading this cannot see the original image.`,
  screenshot: `Analyze this screenshot in detail for a developer who cannot see it.

Focus on:
1. Application/website type and state
2. UI elements visible (buttons, inputs, menus, modals)
3. All text content - transcribe exactly
4. Error messages or notifications (quote exactly)
5. Layout and component hierarchy
6. Interactive elements and their states
7. Console output or logs if visible
8. Any code snippets shown

Be precise - this enables the assistant to help debug or understand the UI.`,
  document: `Analyze this document/PDF thoroughly for a developer.

Extract and provide:
1. Document title, type, and structure
2. All text content - transcribe in reading order
3. Tables - format as markdown tables
4. Lists and bullet points - preserve structure
5. Code blocks or technical content
6. Diagrams or flowcharts - describe in detail
7. Headers and section organization
8. Any important metadata visible

Accuracy in text extraction is critical.`,
};

// Shared logger — set MCC_LOG_LEVEL=debug to enable
let sharedLogger;
try {
  sharedLogger = require('../shared/logger.cjs');
} catch {
  try { sharedLogger = require('./logger.cjs'); } catch {
    sharedLogger = { debug() {}, info() {}, warn() {}, error() {}, init() {}, initFromEnv() {}, getSessionId: () => '', getLogDir: () => '' };
  }
}
const log = sharedLogger;

function parseProviderModels(envValue) {
  if (!envValue) return {};
  return envValue.split(',').reduce((acc, pair) => {
    const [provider, ...modelParts] = pair.split(':');
    const model = modelParts.join(':').trim();
    if (provider && model) {
      acc[provider.trim()] = model;
    }
    return acc;
  }, {});
}

function normalizeTemplateName(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TEMPLATE_FILE_NAMES, normalized) ? normalized : null;
}

function selectPromptTemplate(filePath, requestedTemplate) {
  const explicitTemplate = normalizeTemplateName(requestedTemplate);
  if (explicitTemplate) {
    return explicitTemplate;
  }

  const extension = path.extname(filePath).toLowerCase();
  if (PDF_EXTENSIONS.includes(extension)) {
    return 'document';
  }

  return SCREENSHOT_NAME_REGEX.test(path.basename(filePath)) ? 'screenshot' : 'default';
}

function readPromptFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_PROMPT_TEMPLATE_BYTES) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content.length > 0 ? content : null;
  } catch {
    return null;
  }
}

function loadPromptTemplate(filePath, requestedTemplate, focus) {
  const template = selectPromptTemplate(filePath, requestedTemplate);
  const promptsDir = process.env.MCC_IMAGE_ANALYSIS_PROMPTS_DIR || '';
  const promptPath = promptsDir
    ? path.join(promptsDir, TEMPLATE_FILE_NAMES[template])
    : null;
  const promptText = (promptPath && readPromptFile(promptPath)) || FALLBACK_PROMPTS[template];

  if (!focus || !focus.trim()) {
    return {
      template,
      promptSource: promptPath ? 'installed-or-fallback' : 'bundled-fallback',
      prompt: promptText,
    };
  }

  return {
    template,
    promptSource: promptPath ? 'installed-or-fallback' : 'bundled-fallback',
    prompt: `${promptText}\n\nSpecific focus:\n${focus.trim()}`,
  };
}

function getCurrentProvider() {
  return process.env.MCC_CURRENT_PROVIDER || '';
}

function getConfiguredModel() {
  const explicitModel = process.env.MCC_IMAGE_ANALYSIS_MODEL;
  if (explicitModel && explicitModel.trim()) {
    return explicitModel.trim();
  }

  const providerModels = parseProviderModels(process.env.MCC_IMAGE_ANALYSIS_PROVIDER_MODELS);
  return providerModels[getCurrentProvider()] || DEFAULT_MODEL;
}

function getModelsToTry() {
  const models = [];
  const seen = new Set();

  const explicitModel = process.env.MCC_IMAGE_ANALYSIS_MODEL;
  if (explicitModel && explicitModel.trim()) {
    models.push(explicitModel.trim());
    seen.add(explicitModel.trim());
  }

  const providerModels = parseProviderModels(process.env.MCC_IMAGE_ANALYSIS_PROVIDER_MODELS);
  const providerModel = providerModels[getCurrentProvider()];
  if (providerModel && !seen.has(providerModel)) {
    models.push(providerModel);
    seen.add(providerModel);
  }

  if (models.length === 0) {
    models.push(DEFAULT_MODEL);
  }

  return models;
}

function getRuntimeBaseUrl() {
  const runtimePath = (process.env.MCC_IMAGE_ANALYSIS_RUNTIME_PATH || '')
    .trim()
    .replace(/\/+$/, '');
  const explicitBaseUrl = process.env.MCC_IMAGE_ANALYSIS_RUNTIME_BASE_URL;
  if (explicitBaseUrl && explicitBaseUrl.trim()) {
    const normalizedBaseUrl = explicitBaseUrl.trim().replace(/\/+$/, '');
    if (!runtimePath) {
      return normalizedBaseUrl;
    }

    try {
      const parsed = new URL(normalizedBaseUrl);
      const normalizedPath = parsed.pathname.replace(/\/+$/, '');
      if (normalizedPath === runtimePath) {
        return normalizedBaseUrl;
      }

      parsed.pathname = runtimePath;
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return `${normalizedBaseUrl}${runtimePath}`;
    }
  }

  const port = Number.parseInt(process.env.MCC_CLIPROXY_PORT || '8317', 10);
  return `http://127.0.0.1:${port}${runtimePath}`;
}

function getRuntimeEndpoint() {
  const format = getFormat();
  if (format === 'openai') {
    return `${getRuntimeBaseUrl()}/chat/completions`;
  }
  return `${getRuntimeBaseUrl()}/v1/messages`;
}

function getApiKey() {
  if (Object.prototype.hasOwnProperty.call(process.env, 'MCC_IMAGE_ANALYSIS_RUNTIME_API_KEY')) {
    const explicitApiKey = (process.env.MCC_IMAGE_ANALYSIS_RUNTIME_API_KEY || '').trim();
    return explicitApiKey || 'mcc-internal-managed';
  }

  return process.env.MCC_CLIPROXY_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || 'mcc-internal-managed';
}

function shouldAllowSelfSigned() {
  const value = `${process.env.MCC_IMAGE_ANALYSIS_RUNTIME_ALLOW_SELF_SIGNED || ''}`.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function getTimeoutMs(timeoutMs) {
  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    return timeoutMs;
  }

  const timeoutSec = Number.parseInt(
    process.env.MCC_IMAGE_ANALYSIS_TIMEOUT || `${DEFAULT_TIMEOUT_SEC}`,
    10
  );
  return Math.max(1, Math.min(600, timeoutSec)) * 1000;
}

function isAnalyzableFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext) || PDF_EXTENSIONS.includes(ext);
}

function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.pdf': 'application/pdf',
    }[ext] || 'application/octet-stream'
  );
}

function encodeFileToBase64(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

function buildContentBlock(base64Data, mediaType) {
  const source = {
    type: 'base64',
    media_type: mediaType,
    data: base64Data,
  };

  if (mediaType === 'application/pdf') {
    return {
      type: 'document',
      source,
    };
  }

  return {
    type: 'image',
    source,
  };
}

function buildContentBlockOpenAI(base64Data, mediaType) {
  return {
    type: 'image_url',
    image_url: {
      url: `data:${mediaType};base64,${base64Data}`,
    },
  };
}

function extractTextContent(response) {
  if (!response || !Array.isArray(response.content)) {
    return null;
  }

  const textBlocks = response.content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .filter((text) => text.trim());

  return textBlocks.length > 0 ? textBlocks.join('\n\n') : null;
}

function extractTextContentOpenAI(response) {
  if (!response || !response.choices || !Array.isArray(response.choices)) {
    return null;
  }

  const choice = response.choices[0];
  if (!choice || !choice.message) {
    return null;
  }

  const content = choice.message.content;
  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  // Some models return content as array of blocks
  if (Array.isArray(content)) {
    const textBlocks = content
      .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .filter((text) => text.trim());
    return textBlocks.length > 0 ? textBlocks.join('\n\n') : null;
  }

  return null;
}

function parseCliProxyResponse(data, format) {
  const response = JSON.parse(data);
  const text = format === 'openai'
    ? extractTextContentOpenAI(response)
    : extractTextContent(response);
  if (!text) {
    throw new Error('No text content in response');
  }
  return text;
}

function getFormat() {
  return (process.env.MCC_IMAGE_ANALYSIS_FORMAT || 'anthropic').trim().toLowerCase();
}

function analyzeViaCliProxy(provider, base64Data, mediaType, model, prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(provider.endpoint);
    const transport = endpoint.protocol === 'https:' ? https : http;
    const apiKey = provider.apiKey || 'mcc-internal-managed';
    const format = (provider.format || 'anthropic').toLowerCase();

    log.debug('ImageRuntime', `API call endpoint=${endpoint.toString()} model=${model} format=${format} prompt=${prompt.substring(0, 100)} imageSize=${Math.round(base64Data.length * 3 / 4 / 1024)}KB`);

    const imageBlock = format === 'openai'
      ? buildContentBlockOpenAI(base64Data, mediaType)
      : buildContentBlock(base64Data, mediaType);

    const requestBody = JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            imageBlock,
          ],
        },
      ],
    });

    const req = transport.request(
      {
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port,
        path: `${endpoint.pathname}${endpoint.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'x-api-key': apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: timeoutMs,
        ...(endpoint.protocol === 'https:' && shouldAllowSelfSigned()
          ? { rejectUnauthorized: false }
          : {}),
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          log.debug('ImageRuntime', `Response status=${res.statusCode} bodyLength=${data.length}`);
          if (res.statusCode >= 400) {
            log.debug('ImageRuntime', `Error response: ${data.substring(0, 300)}`);
          }

          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error(`AUTH_ERROR:${res.statusCode}`));
            return;
          }

          if (res.statusCode === 429) {
            reject(new Error(`RATE_LIMIT:${res.headers['retry-after'] || ''}`));
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`API_ERROR:${res.statusCode}:${data}`));
            return;
          }

          try {
            resolve(parseCliProxyResponse(data, format));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on('error', (error) => reject(error));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TIMEOUT'));
    });
    req.write(requestBody);
    req.end();
  });
}

/**
 * Parse the provider fallback chain emitted by model-router
 * (MCC_IMAGE_ANALYSIS_PROVIDERS = JSON array). Each entry is self-contained
 * — its own baseUrl / apiKey / model / format — so the runtime can try a
 * different provider entirely when one 402s or errors. Returns null when the
 * env var is absent, so the legacy single-endpoint path is preserved.
 */
function getProvidersToTry() {
  const raw = process.env.MCC_IMAGE_ANALYSIS_PROVIDERS;
  if (!raw || !raw.trim()) return null;
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const providers = arr
    .filter((p) => p && p.baseUrl && p.apiKey && p.model)
    .map((p) => {
      const format = (p.format || 'anthropic').toLowerCase();
      const base = String(p.baseUrl).trim().replace(/\/+$/, '');
      const endpoint = format === 'openai' ? `${base}/chat/completions` : `${base}/v1/messages`;
      return { id: p.id || base, endpoint, apiKey: p.apiKey, format, model: p.model };
    });
  return providers.length > 0 ? providers : null;
}

async function analyzeWithRetry(base64Data, mediaType, prompt, timeoutMs) {
  // Preferred path: explicit provider chain → try each provider in order,
  // falling through on ANY error (402 / auth / rate-limit / network).
  const providers = getProvidersToTry();
  if (providers) {
    let lastError = null;
    for (const [index, p] of providers.entries()) {
      try {
        log.debug('ImageRuntime', `Trying provider ${index + 1}/${providers.length} id=${p.id} model=${p.model} endpoint=${p.endpoint}`);
        const description = await analyzeViaCliProxy(
          { endpoint: p.endpoint, apiKey: p.apiKey, format: p.format },
          base64Data, mediaType, p.model, prompt, timeoutMs,
        );
        return { description, model: p.model, provider: p.id };
      } catch (error) {
        lastError = error;
        const more = index < providers.length - 1;
        log.debug('ImageRuntime', `Provider ${p.id} failed: ${error.message}${more ? ' — falling back to next' : ' — no more providers'}`);
      }
    }
    throw lastError || new Error('No image analysis providers succeeded');
  }

  // Legacy path: single endpoint from env, retry across model candidates.
  const envProvider = { endpoint: getRuntimeEndpoint(), apiKey: getApiKey(), format: getFormat() };
  const models = getModelsToTry();
  let lastError = null;

  for (const [index, model] of models.entries()) {
    try {
      log.debug('ImageRuntime', `Trying model ${index + 1}/${models.length} model=${model}`);
      const description = await analyzeViaCliProxy(envProvider, base64Data, mediaType, model, prompt, timeoutMs);
      return { description, model };
    } catch (error) {
      lastError = error;
      const message = error.message || '';
      if (
        index === models.length - 1 ||
        ['AUTH_ERROR', 'RATE_LIMIT', 'TIMEOUT', 'EACCES', 'EPERM', 'ECONNREFUSED'].some((token) =>
          message.includes(token)
        )
      ) {
        throw error;
      }
    }
  }

  throw lastError || new Error('No models configured for image analysis');
}

async function analyzeFile(filePath, options = {}) {
  const stats = fs.statSync(filePath);
  if (stats.size >= MAX_FILE_SIZE_BYTES) {
    throw new Error(`FILE_TOO_LARGE:${stats.size}`);
  }

  const timeoutMs = getTimeoutMs(options.timeoutMs);
  const { template, prompt, promptSource } = loadPromptTemplate(
    filePath,
    options.template,
    options.focus
  );
  const model = getConfiguredModel();

  log.debug('ImageRuntime', `Starting image analysis file=${path.basename(filePath)} size=${(stats.size / 1024).toFixed(1)}KB provider=${getCurrentProvider() || 'unknown'} model=${model} models=${getModelsToTry().join('->')} timeout=${timeoutMs / 1000}s endpoint=${getRuntimeEndpoint()} template=${template} promptSource=${promptSource}`);

  const base64Data = encodeFileToBase64(filePath);
  const mediaType = getMediaType(filePath);
  log.debug('ImageRuntime', `File encoded mediaType=${mediaType} base64Length=${(base64Data.length / 1024).toFixed(1)}KB`);

  const result = await analyzeWithRetry(base64Data, mediaType, prompt, timeoutMs);
  log.debug('ImageRuntime', `Analysis complete responseLength=${result.description.length}chars model=${result.model} template=${template}`);

  return {
    description: result.description,
    model: result.model,
    provider: result.provider,
    fileSize: stats.size,
    mediaType,
    template,
  };
}

module.exports = {
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_SEC,
  MAX_FILE_SIZE_BYTES,
  analyzeFile,
  getRuntimeEndpoint,
  isAnalyzableFile,
  parseProviderModels,
  selectPromptTemplate,
};
