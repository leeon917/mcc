# Provider 集成流程

最后更新：2026-05-07

详细的 provider 集成流程，包括 CLIProxyAPI、旧版 GLMT 兼容性转换、远程 CLIProxy、配额管理和认证。

---

## CLIProxyAPI 流程

### 概述

CLIProxyAPI 是一个本地 OAuth 代理二进制文件，实现与多个 AI providers 的无缝集成。CCS 自动管理二进制文件和配置。

### 本地后端选择

CCS 默认为原始 `router-for-me/CLIProxyAPI` 后端，因为它是稳定的 MIT 上游。`plus` 后端是一个明确的可选路径，下载社区维护的 `kaitranntt/CLIProxyAPIPlus` fork，用于仍需要 Plus 仅支持的 providers，如 Kiro、Cursor、GitLab、CodeBuddy、Kilo 和弃用的 GitHub Copilot 兼容性。CCS 不会将 `backend: plus` 静默降级到 `original`；用户在需要那些 providers 时有意选择该后端。

生成的本地 CLIProxy 配置还保持管理 dashboard 与选择的后端对齐。`backend: original` 使用上游 CPAMC（`router-for-me/Cli-Proxy-API-Management-Center`），而 `backend: plus` 使用 CCS 维护的 dashboard fork（`kaitranntt/Cli-Proxy-API-Management-Center`）。高级用户可以通过在 `~/.ccs/config.yaml` 中设置 `cliproxy.management_panel_repository` 来覆盖生成的 `remote-management.panel-github-repository` 值；当预期 dashboard 仓库更改时，CCS 将重新生成陈旧的本地 CLIProxy 配置。

```
+===========================================================================+
|                      CLIProxyAPI Integration                               |
+===========================================================================+

  Claude CLI
        |
        | ANTHROPIC_BASE_URL = localhost:XXXX
        v
  +------------------+
  |   CLIProxyAPI    |  Local proxy binary (Plus fork opt-in for plus-only providers)
  |   (binary)       |
  +------------------+
        |
        +---> OAuth Authentication
        |           |
        |           +---> Authorization Code Flow (port-based)
        |           |         - Gemini, Codex, Antigravity, Kiro (port 9876)
        |           |         - Opens browser for user auth
        |           |         - Callback to localhost:PORT
        |           |
        |           +---> Device Code Flow (no port needed)
        |                     - GitHub Copilot (ghcp, deprecated compatibility)
        |                     - User enters code at github.com/login/device
        |                     - Polls for token completion
        |           |
        |           +---> Browser URL Polling (no callback port)
        |                     - Cursor
        |                     - Opens provider login URL returned by CLIProxyAPIPlus
        |                     - Polls auth state until token is saved
        |           |
        |           v
        |     +------------------+
        |     |   OAuth Server   |  Browser-based auth
        |     +------------------+
        |
        +---> Request Transformation
        |           |
        |           v
        |     Anthropic Format --> Provider Format
        |
        +---> Image Analysis Hook (v7.34)
        |           |
        |           v
        |     Vision Model Proxying (gemini, codex, agy, clipproxy)
        |           - Auto-injected via claude-hooks
        |           - Skip for Claude Sub accounts (native vision)
        |           - Fallback with deprecated block-image-read
        |
        +---> Provider APIs
                    |
                    +---> Google (Gemini)
                    +---> GitHub (Codex)
                    +---> Antigravity (AGY)
                    +---> AWS Kiro (Claude-powered)
                    +---> GitHub Copilot (ghcp, deprecated compatibility)
                    +---> OpenAI-compatible endpoints
```

### 支持的内置 Providers

| Provider | ID | Auth Method | Port | Binary |
|----------|----|----|------|--------|
| Gemini | `gemini` | Authorization Code | 9876 | CLIProxyAPI |
| Codex | `codex` | Authorization Code | 9876 | CLIProxyAPI |
| Antigravity | `agy` | Authorization Code | 9876 | CLIProxyAPI |
| Kiro (AWS) | `kiro` | Method-aware (default: Device Code) | 9876 | CLIProxyAPIPlus fork |
| GitHub Copilot (deprecated) | `ghcp` | Device Code | none | CLIProxyAPIPlus fork |
| Cursor | `cursor` | Browser URL polling | none | CLIProxyAPIPlus fork |

### Codex 重复邮箱账户身份

Codex 可以在同一 email 用户同时拥有团队/业务登录和个人/免费登录时合法地产生多个 auth 文件。CCS 现在将那些视为独立账户，而不是按 email 合并。

- 内部账户 ID 保持对 Codex 仅知的重复感知：`email#variant`
- 变体 key 来自 auth 文件名，例如 `kaidu.kd@gmail.com#04a0f049-team` 和 `kaidu.kd@gmail.com#free`
- Dashboard 表面继续显示规范 email，带紧凑变体徽章如 `Team` 或 `Free`
- 配额获取为选定账户解析精确的注册表 `tokenFile`，而不是按 email 扫描并取第一个匹配
- 实时使用/账户监视器统计按键为 `provider + account identity`，因此重复的 Codex emails 不再合并到一个运行时桶中

这保留了用户可见的业务和个人 Codex 会话之间的区别，同时保持其他 providers 在其现有 email 支持的身份模型上。

### 内置 Provider 检测

CCS 通过 `profile-detector.ts` 检测内置 providers 并通过 `execClaudeWithCLIProxy()` 路由。

```typescript
// Profile name matching
const hardcodedProviders = ['gemini', 'codex', 'agy', 'kiro', 'ghcp'];

if (hardcodedProviders.includes(profileName)) {
  return execClaudeWithCLIProxy(claudeCli, profileName, args);
}
```

---

## 旧版 GLMT 兼容性流程

### 概述

GLMT 不再是 CCS 中营销的运行时表面。现有的 `glmt` profiles 作为兼容性路径保留，并在启动时规范化为直接 GLM 端点。`src/glmt/` 模块仍然保留，因为 Cursor 响应转换仍导入其 transformer 管道。

```
+===========================================================================+
|                Legacy GLMT Compatibility + Internal Transforms             |
+===========================================================================+

  Claude CLI
        |
        | legacy glmt settings detected
        v
  +------------------+
  | Compatibility    |  normalizeDeprecatedGlmtEnv()
  | Layer            |  (src/utils/glmt-deprecation.ts)
  +------------------+
        |
        v
  +------------------+
  | Direct GLM API   |  https://api.z.ai/api/anthropic
  +------------------+
        |
        v
  +------------------+
  | src/glmt/*       |  retained for Cursor translation
  +------------------+
```

### 支持的迁移目标

| Provider | Config Key | Endpoint | Auth |
|----------|------------|----------|------|
| Z.AI (GLM) | `glm` | https://api.z.ai/api/anthropic | API key |
| Kimi API | `km` | https://api.kimi.com/coding/ | API key |
| Legacy compatibility | `glmt` | normalized to direct GLM at runtime | existing profile only |

使用 `ccs glm` 用于 Z.AI profiles 和 `ccs km` 用于 reasoning-first Kimi API profiles。仅在迁移现有设置文件时保留 `glmt`。

### 运行时处理

CCS 检测弃用的 `glmt` profile 名称，并在通过正常 settings-profile 流程分派之前规范旧版仅代理设置：

```typescript
if (isDeprecatedGlmtProfileName(profileName)) {
  const normalized = normalizeDeprecatedGlmtEnv(settingsEnv);
  // warn user, validate against direct GLM endpoint, continue through settings flow
}
```

---

## 远程 CLIProxy 流程（v7.1）

### 概述

远程 CLIProxy 使 CCS 能够将认证委托给中央代理服务器，而不是生成本地二进制文件。

```
+===========================================================================+
|                    Remote CLIProxy Architecture (v7.1)                    |
+===========================================================================+

  Config Resolution (proxy-config-resolver.ts)
        |
        +---> Priority: CLI flags > ENV vars > config.yaml > defaults
        |
        v
  +------------------+
  | ResolvedProxyConfig |
  | mode: local|remote |
  +------------------+
        |
        +---> [mode = local] ---> Spawn local CLIProxyAPI binary
        |                              |
        |                              v
        |                        localhost:8317
        |
        +---> [mode = remote] ---> Connect to remote server
                                       |
                                       v
                                 +------------------+
                                 | Health Check     |  remote-proxy-client.ts
                                 | /v1/models       |  2s timeout
                                 +------------------+
                                       |
                                       +---> [reachable] ---> Use remote
                                       |                           |
                                       |                           v
                                       |                      protocol://host:port
                                       |
                                       +---> [unreachable] ---> Fallback decision
                                                                     |
                                       +-----------------------------+
                                       |
                                       +---> [fallbackEnabled] ---> Start local
                                       |
                                       +---> [remoteOnly] ---> Fail with error

  CLI Flags:
    --proxy-host <host>         Remote hostname/IP
    --proxy-port <port>         Port (default: 8317 HTTP, 443 HTTPS)
    --proxy-protocol <proto>    http or https
    --proxy-auth-token <token>  Bearer authentication
    --local-proxy               Force local mode
    --remote-only               Fail if remote unreachable

  Environment Variables:
    CCS_PROXY_HOST              Remote hostname
    CCS_PROXY_PORT              Remote port
    CCS_PROXY_PROTOCOL          Protocol (http/https)
    CCS_PROXY_AUTH_TOKEN        Auth token
    CCS_PROXY_FALLBACK_ENABLED  Enable fallback (true/false)
```

### 配置解析

```typescript
// proxy-config-resolver.ts: Priority order
const resolved = {
  ...DEFAULT_CONFIG,                    // 4. Defaults (lowest)
  ...yamlConfig,                        // 3. config.yaml
  ...envConfig,                         // 2. Environment variables
  ...cliFlags,                          // 1. CLI flags (highest)
};
```

### 健康检查

```typescript
// remote-proxy-client.ts
async function checkRemoteProxyHealth(config: ResolvedProxyConfig): Promise<boolean> {
  try {
    const url = `${config.protocol}://${config.host}:${config.port}/v1/models`;
    const response = await fetch(url, {
      headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {},
      timeout: 2000,
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

---

## 配额管理流程（v7.14）

### 概述

混合配额管理实现耗尽账户的自动检测和故障转移到下一个可用账户。当 CCS 检测到耗尽且存在健康的回退时，它暂时暂停耗尽账户的 CLIProxy 轮换，并在配置的冷却到期后自动恢复该暂停。这种持久性自暂停使用与 dashboard/手动暂停相同的账户注册表和 token 移动路径，因此 dashboard 将账户显示为暂停，CLIProxy 无法从活动的 `auth/` 文件夹重新发现其 token。

```
+===========================================================================+
|                      Quota Management Architecture (v7.14)                |
+===========================================================================+

  Pre-Flight Check (before session start)
        |
        v
  +------------------+
  | quota-manager.ts |  Hybrid quota management
  +------------------+
        |
        +---> Get all active accounts for provider
        |
        +---> For each account:
        |           |
        |           v
        |     +------------------+
        |     | quota-fetcher.ts |  Provider-specific API calls
        |     +------------------+
        |           |
        |           +---> Check isPaused flag --> Skip if paused
        |           |
        |           +---> Fetch quota from provider API
        |           |       - Antigravity: fetchAvailableModels
        |           |       - Claude: policy limits endpoint
        |           |       - Codex: ChatGPT usage windows
        |           |       - Gemini CLI: Code Assist quota buckets
        |           |       - GitHub Copilot: copilot_internal/user snapshots (deprecated compatibility)
        |           |
        |           +---> Detect tier (free/paid/unknown)
        |           |
        |           +---> Check exhaustion status
        |
        +---> Select best account (not paused, not exhausted)
        |
        +---> Auto-failover to next account if current exhausted
        |
        +---> Temporarily pause exhausted account when fallback exists
        |       - move token out of live auth discovery
        |       - persist cooldown expiry across launches
        |       - auto-resume only CCS-created quota pauses

  CLI Commands:
    ccs cliproxy pause <account>   --> Set isPaused=true in account-manager
    ccs cliproxy resume <account>  --> Set isPaused=false
    ccs cliproxy status [account]  --> Display quota + tier info

  Dashboard UI:
    - Pause/Resume toggle per account
    - Tier badge (free/paid/unknown)
    - Quota usage display
```

### 账户选择算法

```typescript
// quota-manager.ts: Best account selection
function selectBestAccount(accounts: AccountInfo[]): AccountInfo | null {
  // Priority:
  // 1. Not paused
  // 2. Not exhausted
  // 3. Paid tier over free tier
  // 4. Highest remaining quota

  return accounts
    .filter(acc => !acc.isPaused && !acc.isExhausted)
    .sort((a, b) => {
      if (a.tier !== b.tier) return (a.tier === 'paid' ? -1 : 1);
      return (b.remainingQuota || 0) - (a.remainingQuota || 0);
    })[0] || null;
}
```

---

## 认证流程

### OAuth Providers - Authorization Code Flow

**Providers**：Gemini、Codex、Antigravity、Kiro（aws 方法）

```
+===========================================================================+
|              OAuth - Authorization Code Flow (Port-based)                 |
+===========================================================================+

  1. User runs: ccs codex
        |
        v
  2. Check token cache (~/.ccs/cliproxy/auth/)
        |
        +---> [Valid token] ---> Use cached token
        |
        +---> [No/Expired token]
                    |
                    v
  3. Start local OAuth server (localhost:9876)
        |
        v
  4. Open browser with OAuth request
        |     https://oauth-provider/authorize?redirect_uri=http://localhost:9876/callback
        v
  5. User authorizes in browser
        |
        v
  6. OAuth provider redirects to localhost:9876/callback?code=XXXX
        |
        v
  7. Exchange auth code for access token
        |
        v
  8. Cache token locally (~/.ccs/cliproxy/auth/gemini.json)
        |
        v
  9. Proceed with Claude CLI
```

### OAuth Providers - Device Code Flow

**Providers**：GitHub Copilot（ghcp，弃用的兼容性）

Provider 身份说明：
- 不暴露可靠 email 的 providers 在首次认证时不再需要手动昵称。
- CCS 从 token/cache 上下文派生稳定的内部账户标识符，并仍允许用户稍后重命名账户。

```
+===========================================================================+
|               OAuth - Device Code Flow (No Port Needed)                   |
+===========================================================================+

  1. User runs: ccs ghcp
        |
        v
  2. Check token cache (~/.ccs/cliproxy/auth/)
        |
        +---> [Valid token] ---> Use cached token
        |
        +---> [No/Expired token]
                    |
                    v
  3. Request device code from GitHub
        |
        v
  4. Display user code + verification URL
        |     "Enter code XXXX-XXXX at github.com/login/device"
        v
  5. User opens URL in browser and enters code
        |
        v
  6. Poll GitHub for token completion
        |
        v
  7. Receive and cache token locally
        |
        v
  8. Proceed with Claude CLI
```

### Kiro OAuth - Method-Aware Flow

**支持的方法**：
- `aws`：Device Code（默认，AWS org 友好）
- `aws-authcode`：Authorization Code 通过 CLI 流程
- `google`：Social OAuth 通过管理 API
- `github`：Social OAuth 通过管理 API（Dashboard 流程）

```
+===========================================================================+
|                    Kiro OAuth - Method-Aware Flow                         |
+===========================================================================+

  Configuration:
    ccs_profile:
      target: claude
      cliproxy:
        provider: kiro
        kiro_method: aws  # or aws-authcode, google, github

  Flow:
    Device Code (aws)
      → /start endpoint (no callback port)
      → Opens browser
      → User enters code
      → Poll /status

    Authorization Code (aws-authcode, google, github)
      → /start-url endpoint
      → Returns auth_url
      → User visits URL
      → Callback handled
      → Poll /status for completion

  Key behavior:
    - Device Code method uses /start route (no callback port)
    - Callback/social methods use /start-url + status polling
    - Some management flows return state first, auth_url later
    - Manual nicknames are optional when the upstream provider does not return an email
    - Account storage uses a stable internal identifier so reauth/update flows do not depend on dashboard list order
```

### API Key Profiles (GLM, Kimi)

```
+===========================================================================+
|                     API Key Profile (Non-OAuth)                          |
+===========================================================================+

  1. User configures API key in settings
        |
        v
  2. Key stored in ~/.ccs/<profile>.settings.json
        |
        v
  3. Profile detection: APIKeyProfile
        |
        v
  4. Key passed via ANTHROPIC_AUTH_TOKEN env var
        |
        v
  5. Target adapter (Claude/Droid) handles delivery
        |
        └─ Claude: env var
        └─ Droid: config file (~/.factory/settings.json)
```

### Anthropic Direct API Key

```
+===========================================================================+
|                  Anthropic Direct API Key (Native Auth)                   |
+===========================================================================+

  1. User creates profile: ccs api create --preset anthropic
        |
        v
  2. Key stored in ~/.ccs/<profile>.settings.json
        |  env: { ANTHROPIC_API_KEY: "sk-ant-..." }
        |  (NO ANTHROPIC_BASE_URL, NO ANTHROPIC_AUTH_TOKEN)
        v
  3. Profile detection: settings-based
        |
        v
  4. Key passed via ANTHROPIC_API_KEY env var
        |  Claude CLI uses native endpoint (api.anthropic.com)
        v
  5. Claude CLI authenticates with x-api-key header

  Detection logic (profile-writer.ts):
    - apiKey.startsWith('sk-ant-') -> native mode
    - baseUrl.includes('api.anthropic.com') -> native mode
    - Otherwise -> proxy mode (existing behavior)
```

---

## 图片分析 Hook 流程（v7.34）

### 概述

图片分析 Hook 实现通过 CLIProxy 的视觉模型代理，为所有 profile 类型自动注入。

```
+===========================================================================+
|                    Image Analysis Hook Flow (v7.34)                       |
+===========================================================================+

  Claude CLI with image input
        |
        v
  Hook Installer (ensureProfileHooks)
        |
        +---> Check ~/.claude/hooks/openai-vision-hook.cjs exists
        |
        +---> If missing: auto-install via image-analyzer-hook-installer
        |
        v
  Hook Configuration
        |
        +---> Set ANTHROPIC_IMAGE_HOOK_URL
        |           (proxy endpoint URL)
        |
        v
  Claude CLI processes image request
        |
        v
  Claude prefers ImageAnalysis MCP tool
        |
        v
  CCS provider-backed image analysis
        |
        +---> Provider route resolved before launch
        |
        +---> Direct request to /api/provider/<backend>/v1/messages
        |
        +---> Native Read fallback if runtime/auth/proxy is unavailable
        |
        v
  Text description returned to Claude CLI
```

### 运行时环境

```typescript
// getImageAnalysisHookEnv()
{
  CCS_IMAGE_ANALYSIS_RUNTIME_BASE_URL: 'http://127.0.0.1:8317',
  CCS_IMAGE_ANALYSIS_RUNTIME_PATH: '/api/provider/agy',
  CCS_IMAGE_ANALYSIS_RUNTIME_API_KEY: 'ccs-internal-managed',
}
```

### Provider 支持

| Provider | Vision Support | Notes |
|----------|---|---|
| Gemini | ✓ | Via CCS ImageAnalysis provider route |
| Codex | ✓ | Via CCS ImageAnalysis provider route |
| Antigravity | ✓ | Via CCS ImageAnalysis provider route |
| Kiro | ✓ | Via mapped CCS provider route when configured |
| Copilot | ✓ | Deprecated compatibility route via mapped ghcp provider |
| GLM/Kimi | ✓ | Via explicit or fallback backend mapping |

---

## 会话跟踪

所有执行路径记录包括使用的目标 CLI 的会话元数据：

```typescript
{
  profileName: 'gemini',
  profileType: 'clipproxy',
  provider: 'google-gemini',
  targetCli: 'claude',        // NEW: which target was used
  timestamp: '2026-02-16T10:40:00Z',
  duration: 12345,
  exitCode: 0,
  model: 'claude-opus-4-6',
}
```

这支持对目标 CLI 使用和采用的分析。

---

## 相关文档

- [System Architecture Index](./index.md) — Overall system design
- [Target Adapters](./target-adapters.md) — Multi-CLI adapter pattern
- [Codebase Summary](../codebase-summary.md) — Module structure
- [Code Standards](../code-standards.md) — Implementation guidelines
