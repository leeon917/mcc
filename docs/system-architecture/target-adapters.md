# Target Adapters

最后更新：2026-03-28

target adapter 模式和实现的详细文档。

---

## 概述

target adapter 系统使 CCS 能够将凭证解析的 profiles 分派到不同的 CLI 实现，同时保持统一的配置和 profile 系统。

**关键洞察**：Profile 解析（检测 provider、加载认证、构建凭证）是目标无关的。只有最终的凭证传递和进程生成因目标而异。

---

## Target Adapter 接口

每个 CLI 目标实现 `TargetAdapter` 契约：

```typescript
export interface TargetAdapter {
  readonly type: TargetType;                               // 'claude' | 'droid' | 'codex'
  readonly displayName: string;                            // "Claude Code" | "Factory Droid" | "Codex CLI"

  /** Detect if the target CLI binary exists on system */
  detectBinary(): TargetBinaryInfo | null;

  /** Prepare credentials for delivery to target CLI */
  prepareCredentials(creds: TargetCredentials): Promise<void>;

  /** Build spawn arguments for the target CLI */
  buildArgs(
    profile: string,
    userArgs: string[],
    options?: {
      creds?: TargetCredentials;
      profileType?: ProfileType;
      binaryInfo?: TargetBinaryInfo;
    }
  ): string[];

  /** Build environment variables for the target CLI */
  buildEnv(creds: TargetCredentials, profileType: string): NodeJS.ProcessEnv;

  /** Spawn the target CLI process (replaces current process flow) */
  exec(args: string[], env: NodeJS.ProcessEnv, options?: { cwd?: string }): void;

  /** Check if a profile type is supported by this target */
  supportsProfileType(profileType: string): boolean;
}
```

### 类型定义

```typescript
export type TargetType = 'claude' | 'droid' | 'codex';

export interface TargetCredentials {
  baseUrl: string;                                         // API endpoint
  apiKey: string;                                          // Auth token
  model?: string;                                          // Model ID
  provider?: 'anthropic' | 'openai' | 'generic-chat-completion-api';
  envVars?: NodeJS.ProcessEnv;                             // Additional env vars
}

export interface TargetBinaryInfo {
  path: string;                                            // Full path to binary
  needsShell: boolean;                                     // Windows .cmd/.bat/.ps1?
  version?: string;                                        // Optional version string
  features?: readonly string[];                            // Capability probes
}
```

---

## Target 解析

CCS 通过优先级排序检查解析使用哪个 adapter：

### 解析优先级

```
1. --target flag (CLI argument) — highest priority
   └─ ccs --target droid glm
   └─ ccs --target codex

2. Explicit runtime entrypoint (`CCS_INTERNAL_ENTRY_TARGET`) — dedicated bin shims
   └─ ccs-droid / ccsd → droid
   └─ ccs-codex / ccsx → codex
   └─ ccsxp → codex, then prepends `--config model_provider="cliproxy"`

3. argv[0] detection (runtime alias pattern) — binary name mapping for same-binary/custom aliases
   └─ ccs-droid (explicit alias) → droid
   └─ ccsd (legacy shortcut) → droid
   └─ ccs-codex (explicit alias) → codex
   └─ ccsx (short alias) → codex
   └─ ccs (regular command) → default

4. Per-profile config (from ~/.ccs/config.yaml or settings.json)
   └─ persisted targets are currently only `claude` and `droid`
   └─ profiles:
        glm:
          target: droid

5. Fallback: 'claude' — lowest priority
```

### 实现

```typescript
// src/targets/target-resolver.ts

export function resolveTargetType(
  args: string[],
  profileConfig?: { target?: TargetType }
): TargetType {
  // 1. Parse --target flags (supports --target value and --target=value)
  // Repeated flags: last one wins.
  const parsed = parseTargetFlags(args);
  if (parsed.targetOverride) {
    return parsed.targetOverride;
  }

  // 2. Check explicit runtime entrypoint shim
  const entrypointTarget = resolveEntrypointTarget();
  if (entrypointTarget) {
    return entrypointTarget;
  }

  // 3. Check argv[0] (binary name / custom alias map)
  const binName = path.basename(process.argv[1] || process.argv0 || '').replace(/\.(cmd|bat|ps1|exe)$/i, '');
  if (ARGV0_TARGET_MAP[binName]) {
    return ARGV0_TARGET_MAP[binName];
  }

  // 4. Check profile config
  if (profileConfig?.target) {
    // Persisted targets intentionally exclude runtime-only codex.
    return profileConfig.target;
  }

  // 5. Default to claude
  return 'claude';
}
```

---

## Claude Adapter

### 实现

```typescript
// src/targets/claude-adapter.ts

export class ClaudeAdapter implements TargetAdapter {
  readonly type: TargetType = 'claude';
  readonly displayName = 'Claude Code';

  detectBinary(): TargetBinaryInfo | null {
    const info = getClaudeCliInfo();
    if (!info) return null;
    return { path: info.path, needsShell: info.needsShell };
  }

  async prepareCredentials(_creds: TargetCredentials): Promise<void> {
    // No-op: Claude receives credentials via environment variables
  }

  buildArgs(_profile: string, userArgs: string[]): string[] {
    return userArgs;  // Pass through user arguments unchanged
  }

  buildEnv(creds: TargetCredentials, profileType: string): NodeJS.ProcessEnv {
    const webSearchEnv = getWebSearchHookEnv();

    // For native profiles, strip stale proxy env to prevent interference
    const baseEnv =
      profileType === 'account' || profileType === 'default'
        ? stripAnthropicEnv(process.env)
        : process.env;

    const env: NodeJS.ProcessEnv = { ...baseEnv, ...webSearchEnv };

    if (creds.envVars) {
      Object.assign(env, creds.envVars);
    }

    // Deliver credentials via environment variables
    if (creds.baseUrl) env['ANTHROPIC_BASE_URL'] = creds.baseUrl;
    if (creds.apiKey) env['ANTHROPIC_AUTH_TOKEN'] = creds.apiKey;
    if (creds.model) env['ANTHROPIC_MODEL'] = creds.model;

    return env;
  }

  exec(args: string[], env: NodeJS.ProcessEnv, _options?: { cwd?: string }): void {
    const claudeCli = detectClaudeCli();
    if (!claudeCli) {
      void ErrorManager.showClaudeNotFound();
      process.exit(1);
      return;
    }

    // Handle Windows shell requirements
    const isWindows = process.platform === 'win32';
    const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(claudeCli);

    let child: ChildProcess;
    if (needsShell) {
      const cmdString = [claudeCli, ...args].map(escapeShellArg).join(' ');
      child = spawn(cmdString, { shell: true, stdio: 'inherit', env });
    } else {
      child = spawn(claudeCli, args, { stdio: 'inherit', env });
    }

    // Handle process termination
    const onSigInt = () => child.kill('SIGINT');
    const onSigTerm = () => child.kill('SIGTERM');
    process.once('SIGINT', onSigInt);
    process.once('SIGTERM', onSigTerm);
    child.on('exit', () => {
      process.removeListener('SIGINT', onSigInt);
      process.removeListener('SIGTERM', onSigTerm);
    });
  }

  supportsProfileType(profileType: string): boolean {
    // Claude supports all profile types
    return true;
  }
}
```

原生 Claude 启动保持用户参数会话范围。启动层在生成 Claude 前验证和规范化 `--effort low|medium|high|xhigh|max`，然后不加更改地传递它。CLIProxy 支持的 Claude 启动仍将 `--effort` 视为 CCS thinking 别名，由 CLIProxy 处理。

### 凭证传递

**方法**：环境变量

```bash
export ANTHROPIC_BASE_URL=https://api.anthropic.com
export ANTHROPIC_AUTH_TOKEN=sk-ant-...
export ANTHROPIC_MODEL=claude-opus-4-6
export WEBSEARCH_HOOK_ENV=...  # Image analysis, websearch
```

### 执行

```bash
# Direct invocation
ccs codex
→ claude "args..."
  with ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN set

# With --target override
ccs --target claude glm
→ claude "args..."
  with ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN set
```

---

## Droid Adapter

### 实现

```typescript
// src/targets/droid-adapter.ts

export class DroidAdapter implements TargetAdapter {
  readonly type: TargetType = 'droid';
  readonly displayName = 'Factory Droid';

  detectBinary(): TargetBinaryInfo | null {
    const info = getDroidBinaryInfo();
    if (!info) return null;

    // Non-blocking version compatibility check
    checkDroidVersion(info.path);
    return info;
  }

  async prepareCredentials(creds: TargetCredentials): Promise<void> {
    // Write custom model entry to ~/.factory/settings.json
    await upsertCcsModel(creds.profile, {
      model: creds.model || 'claude-opus-4-6',
      displayName: `CCS ${creds.profile}`,
      baseUrl: creds.baseUrl,
      apiKey: creds.apiKey,
      provider: creds.provider || 'anthropic',
    });
  }

  buildArgs(profile: string, userArgs: string[]): string[] {
    // Droid uses -m <model> syntax for model selection
    return ['-m', `custom:ccs-${profile}`, ...userArgs];
  }

  buildEnv(_creds: TargetCredentials, _profileType: string): NodeJS.ProcessEnv {
    // Droid reads from config file — minimal env needed
    return { ...process.env };
  }

  exec(args: string[], env: NodeJS.ProcessEnv, _options?: { cwd?: string }): void {
    const droidPath = detectDroidCli();
    if (!droidPath) {
      console.error('[X] Droid CLI not found. Install: npm i -g @factory/cli');
      process.exit(1);
      return;
    }

    // Handle Windows shell requirements
    const isWindows = process.platform === 'win32';
    const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(droidPath);

    let child: ChildProcess;
    if (needsShell) {
      const cmdString = [droidPath, ...args].map(escapeShellArg).join(' ');
      child = spawn(cmdString, { shell: true, stdio: 'inherit', env });
    } else {
      child = spawn(droidPath, args, { stdio: 'inherit', env });
    }

    // Handle process termination
    const onSigInt = () => child.kill('SIGINT');
    const onSigTerm = () => child.kill('SIGTERM');
    process.once('SIGINT', onSigInt);
    process.once('SIGTERM', onSigTerm);
    child.on('exit', () => {
      process.removeListener('SIGINT', onSigInt);
      process.removeListener('SIGTERM', onSigTerm);
    });
  }

  supportsProfileType(profileType: string): boolean {
    // Droid currently supports direct settings/default paths only
    return profileType === 'settings' || profileType === 'default';
  }
}
```

### 凭证传递

**方法**：配置文件（`~/.factory/settings.json`）

```json
{
  "customModels": [
    {
      "model": "claude-opus-4-6",
      "displayName": "CCS gemini",
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai/",
      "apiKey": "AIza...",
      "provider": "openai"
    },
    {
      "model": "glm-4",
      "displayName": "CCS glm",
      "baseUrl": "https://open.bigmodel.cn/api/paas/v4/",
      "apiKey": "your-glm-key",
      "provider": "openai"
    }
  ]
}
```

### 执行

```bash
# Direct invocation
ccs codex
→ droid -m custom:ccs-codex "args..."
  (credentials loaded from ~/.factory/settings.json)

# With --target override
ccs --target droid glm
→ droid -m custom:ccs-glm "args..."
  (credentials loaded from ~/.factory/settings.json)
```

### 运行时别名模式

```bash
# Built-in package bin aliases
ccs-droid glm
→ Target: droid (forced by runtime alias)
→ droid -m custom:ccs-glm "args..."

# Legacy shortcut still works
ccsd glm
→ Target: droid (forced by runtime alias)
→ droid -m custom:ccs-glm "args..."
```

在 Windows 上，`ccs-droid.cmd`、`ccsd.cmd`、`ccsd.bat`、`ccsd.ps1` 和 `ccsd.exe` 包装器也被识别。

可以在运行时配置附加别名名称，在您创建匹配的符号链接或保留调用基础名称的另一个启动器后。使用 `CCS_TARGET_ALIASES`（首选，`target=alias1,alias2;...`）或旧版 `CCS_DROID_ALIASES`（逗号分隔）。
示例：

```bash
ln -s /path/to/ccs /path/to/mydroid
CCS_TARGET_ALIASES=droid=mydroid
```

---

## Codex Adapter

### 实现

Codex adapter 保持 CCS 支持的 Codex 启动是瞬态的。它不重写 `~/.codex/config.toml`。相反它：

- 按原样传递原生默认 Codex 会话
- 探测安装的 Codex 二进制是否支持 `--config <key=value>`
- 通过临时 `-c` overrides 注入 CCS 支持的 provider 凭证
- 仅通过 `CCS_CODEX_API_KEY` 在进程 env 中存储路由的 API key

```typescript
// src/targets/codex-adapter.ts

export class CodexAdapter implements TargetAdapter {
  readonly type: TargetType = 'codex';
  readonly displayName = 'Codex CLI';

  detectBinary(): TargetBinaryInfo | null {
    return getCodexBinaryInfo();
  }

  async prepareCredentials(_creds: TargetCredentials): Promise<void> {
    // No file writes. Codex uses transient -c overrides plus env_key injection.
  }

  buildArgs(profile: string, userArgs: string[], options?: BuildOptions): string[] {
    if ((options?.profileType || 'default') === 'default') {
      return userArgs;
    }

    if (!codexBinarySupportsConfigOverrides(options?.binaryInfo)) {
      throw new Error('Upgrade Codex before using CCS-backed Codex profiles.');
    }

    return [
      '-c',
      'model_provider="ccs_runtime"',
      '-c',
      'model_providers.ccs_runtime.base_url="http://127.0.0.1:8317/api/provider/codex"',
      '-c',
      'model_providers.ccs_runtime.env_key="CCS_CODEX_API_KEY"',
      '-c',
      'model_providers.ccs_runtime.wire_api="responses"',
      ...userArgs,
    ];
  }

  buildEnv(creds: TargetCredentials, profileType: string): NodeJS.ProcessEnv {
    const env = { ...stripAnthropicEnv(process.env) };
    if (profileType !== 'default') {
      env['CCS_CODEX_API_KEY'] = creds.apiKey;
    }
    return env;
  }
}
```

### 支持矩阵

Codex 是一个真实的运行时目标，但在 v1 中故意比 Claude 或 Droid 窄：

| Profile Type | Codex Target | Notes |
|--------------|--------------|-------|
| `default` | Yes | Uses existing native Codex auth/config |
| `cliproxy` provider=`codex` | Yes | Routed through CLIProxy Codex Responses bridge |
| `cliproxy` composite | No | Not proven native-Codex-safe |
| `settings` with Codex bridge metadata | Yes | Only when the API profile resolves to a Codex CLIProxy bridge |
| `settings` generic API profile | No | Claude/Droid only |
| `account` | No | Claude-only account isolation concept |
| `copilot` | No | Not a native Codex provider path |

### Codex Dashboard 表面

CCS 还在 `ccs config` -> `Compatible` -> `Codex CLI` 暴露专用 dashboard 路由。该页面故意在整体范围内比 Droid dashboard 窄，但不再仅是只读的：

- 仅读取和写入用户配置层：`~/.codex/config.toml` 或 `$CODEX_HOME/config.toml`
- 为顶级设置、项目信任、profiles、模型 providers、MCP servers 和支持的 feature flags 提供引导控件
- 保持原始 `config.toml` 编辑器作为不支持或保真度敏感编辑的逃生通道
- 显示二进制检测、用户层配置摘要、支持矩阵指导和上游文档
- 在结构化保存时规范化 TOML 格式并删除注释
- 在原始 TOML 脏或无效时保持结构化控件禁用，验证项目信任路径为绝对路径或 `~/...`，并允许 feature flags 重置回 Codex 默认值
- 警告瞬态 CCS 运行时覆盖如 `codex -c key=value` 和 `CCS_CODEX_API_KEY` 可能改变有效运行时而不持久化到文件编辑器

这保持 dashboard 诚实关于 Codex 的合并配置模型，同时仍给用户一个安全检查和 管理用户拥有层的地方。

### 运行时入口点和 argv[0] 回退

```bash
# Built-in package bin entrypoints
ccs-codex
→ dist/bin/codex-runtime.js
→ CCS_INTERNAL_ENTRY_TARGET=codex

ccsx
→ dist/bin/codex-runtime.js
→ CCS_INTERNAL_ENTRY_TARGET=codex

ccsxp
→ dist/bin/ccsxp-runtime.js
→ CCS_INTERNAL_ENTRY_TARGET=codex
→ injects native `model_provider="cliproxy"` override
→ pins CODEX_HOME to native `~/.codex` unless `CCSXP_CODEX_HOME` is set
```

如果用户通过自定义 shim 而不是内置包 bins 启动 CCS，目标解析回退到 `argv[0]` 别名从 `CCS_TARGET_ALIASES` 或旧版 `CCS_CODEX_ALIASES`：

```bash
ln -s /path/to/ccs /path/to/mycodex
CCS_TARGET_ALIASES='codex=mycodex'
# Legacy fallback:
CCS_CODEX_ALIASES='mycodex'
```

---

## 注册表和查找

目标注册表是一个简单的基于 Map 的 adapters 存储：

```typescript
// src/targets/target-registry.ts

const adapters = new Map<TargetType, TargetAdapter>();

export function registerTarget(adapter: TargetAdapter): void {
  adapters.set(adapter.type, adapter);
}

export function getTarget(type: TargetType): TargetAdapter {
  const adapter = adapters.get(type);
  if (!adapter) {
    throw new Error(`Unknown target "${type}"`);
  }
  return adapter;
}

export function getDefaultTarget(): TargetAdapter {
  return getTarget('claude');
}
```

### Adapter 注册

在启动时，adapters 自行注册：

```typescript
// src/ccs.ts (initialization)

registerTarget(new ClaudeAdapter());
registerTarget(new DroidAdapter());
registerTarget(new CodexAdapter());
```

---

## 执行流程

### 逐步说明

```
1. Parse command-line arguments
   └─ args: ['--target', 'droid', 'glm']

2. Resolve target type
   └─ resolveTargetType(args) → 'droid'
   └─ stripTargetFlag(args) → ['glm']

3. Detect and resolve profile
   └─ detectProfile(['glm']) → { profile: 'glm', ... }
   └─ Load credentials from config/CLIProxy/env

4. Build credentials object
   └─ TargetCredentials {
        baseUrl: '...',
        apiKey: '...',
        model: 'claude-opus-4-6',
        envVars: { CCS_PROFILE_NAME: 'glm', ... }
      }

5. Get target adapter
   └─ getTarget('droid') → DroidAdapter instance

6. Prepare credentials
   └─ adapter.prepareCredentials(creds)
   └─ DroidAdapter: writes to ~/.factory/settings.json

7. Build spawn arguments
   └─ adapter.buildArgs('glm', []) → ['-m', 'custom:ccs-glm']

8. Build environment
   └─ adapter.buildEnv(creds, profileType) → process.env

9. Spawn target CLI
   └─ adapter.exec(spawnArgs, env)
   └─ exec spawn('droid', ['-m', 'custom:ccs-glm', ...])

10. Replace current process
    └─ Child process inherits stdio
    └─ Signal handlers propagate to child
```

---

## 添加新目标

支持新 CLI（例如 MyAI CLI）时，遵循此模式：

### 1. 创建 Adapter 类

```typescript
// src/targets/myai-adapter.ts

export class MyAiAdapter implements TargetAdapter {
  readonly type: TargetType = 'myai';
  readonly displayName = 'MyAI CLI';

  detectBinary(): TargetBinaryInfo | null {
    const path = which.sync('myai', { nothrow: true });
    if (!path) return null;
    return { path, needsShell: process.platform === 'win32' };
  }

  async prepareCredentials(creds: TargetCredentials): Promise<void> {
    // Write to ~/.myai/config or similar
  }

  buildArgs(profile: string, userArgs: string[]): string[] {
    return ['-p', profile, ...userArgs];
  }

  buildEnv(creds: TargetCredentials, _profileType: string): NodeJS.ProcessEnv {
    return {
      ...process.env,
      MYAI_API_KEY: creds.apiKey,
      MYAI_API_URL: creds.baseUrl,
    };
  }

  exec(args: string[], env: NodeJS.ProcessEnv): void {
    const myaiPath = this.detectBinary()?.path;
    if (!myaiPath) {
      console.error('[X] MyAI CLI not found');
      process.exit(1);
    }
    spawn(myaiPath, args, { stdio: 'inherit', env });
  }

  supportsProfileType(profileType: string): boolean {
    return true; // or implement specific logic
  }
}
```

### 2. 更新类型定义

```typescript
// src/targets/target-adapter.ts

export type TargetType = 'claude' | 'droid' | 'codex' | 'myai';
```

### 3. 在 ccs.ts 中注册

```typescript
registerTarget(new MyAiAdapter());
```

### 4. 更新文档

- 添加到 [Codebase Summary](../codebase-summary.md)
- 更新 Code Standards adapter 示例
- 记录 CLI 特定行为

---

## 跨平台注意事项

### Windows Shell 检测

两个 adapters 都检查需要 shell 的二进制：

```typescript
const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(binaryPath);

if (needsShell) {
  const cmdString = [binaryPath, ...args].map(escapeShellArg).join(' ');
  spawn(cmdString, { shell: true, stdio: 'inherit' });
} else {
  spawn(binaryPath, args, { stdio: 'inherit' });
}
```

### 环境变量转义

传递给 shell 的参数被转义以防止注入：

```typescript
export function escapeShellArg(arg: string): string {
  // Wrap in quotes and escape internal quotes
  return `"${arg.replace(/"/g, '\\"')}"`;
}
```

### 信号处理

两个 adapters 将信号从父进程传播到子进程：

```typescript
const onSigInt = () => child.kill('SIGINT');
const onSigTerm = () => child.kill('SIGTERM');
process.once('SIGINT', onSigInt);
process.once('SIGTERM', onSigTerm);

child.on('exit', () => {
  process.removeListener('SIGINT', onSigInt);
  process.removeListener('SIGTERM', onSigTerm);
});
```

这确保 CTRL+C 和优雅关闭正常工作。

---

## 测试 Target Adapters

### 单元测试

```typescript
describe('ClaudeAdapter', () => {
  it('detects Claude CLI', () => {
    const adapter = new ClaudeAdapter();
    const binary = adapter.detectBinary();
    expect(binary).not.toBeNull();
  });

  it('builds env with credentials', () => {
    const adapter = new ClaudeAdapter();
    const env = adapter.buildEnv({
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant-...',
      model: 'claude-opus-4-6',
    }, 'cliproxy');

    expect(env['ANTHROPIC_AUTH_TOKEN']).toBe('sk-ant-...');
  });
});
```

### 集成测试

```bash
# Test Claude adapter
ccs --target claude help

# Test Droid adapter (if installed)
ccs --target droid help

# Test Codex adapter (if installed)
ccs --target codex
ccs-codex
ccsxp

# Test argv[0] detection
ccs-droid help
ccsx
```

---

## 相关文档

- [Codebase Summary](../codebase-summary.md) — Module structure
- [Code Standards](../code-standards.md) — Adapter pattern guidelines
- [System Architecture Index](./index.md) — Overall system design
