# CCS 系统架构

最后更新：2026-04-14

CCS (Claude Code Switch) 系统的高层架构概述。

---

## 系统概述

CCS 是一个多 provider profile 和运行时管理器，实现多个 Claude 账户、备用 AI providers 以及用于凭证传递的多个 CLI 目标（Claude Code、Factory Droid、Codex CLI）之间的无缝切换。

系统由两个主要组件组成：

1. **CLI 应用程序**（`src/`）- Node.js TypeScript CLI
2. **Dashboard UI**（`ui/`）- 由 Express 提供服务的 React web 应用程序

Dashboard 本地化（i18n）架构和贡献者工作流记录在 [Dashboard i18n Guide](../i18n-dashboard.md) 中。

CCS v7.34 添加了用于通过 CLIProxy 进行视觉模型代理的 Image Analysis Hook，并为所有 profile 类型自动注入。
CCS v7.67 添加了用于 CCS 自有运行时事件的原生结构化日志通道，由 `src/services/logging/` 支持，有界 JSONL 文件在 `~/.ccs/logs/` 下，以及专用 dashboard `/logs` 路由。
CCS PR 审查现在在 GitHub Actions 中使用 PR-Agent，审查在自托管的 `cliproxy` runner 上运行，现有 `AI_REVIEW_*` 工作流变量和 secrets 保持为运行时契约，repo 级指导存储在 `.pr_agent.toml` 中。

```
+===========================================================================+
|                              CCS System                                    |
+===========================================================================+
|                                                                           |
|   +------------------+      +-----------------+      +----------------+   |
|   |   User Terminal  | ---> |   CCS CLI       | ---> | Target CLI           |   |
|   |   (ccs command)  |      |   (src/ccs.ts)  |      | (claude/droid/codex) |   |
|   +------------------+      +-----------------+      +----------------+   |
|                                    |                        |             |
|                                    v                        v             |
|   +------------------+      +-----------------+      +----------------+   |
|   |   Dashboard UI   | <--> |   Express       | ---> | Provider APIs  |   |
|   |   (React SPA)    |      |   Web Server    |      | (Claude/GLM/  |   |
|   +------------------+      +-----------------+      |  Gemini/etc)   |   |
|                                    |                 +----------------+   |
|                                    v                                      |
|                        +---------------------+                            |
|                        |    CLIProxyAPI      |                            |
|                        |  (Local or Remote)  |                            |
|                        +---------------------+                            |
|                                                                           |
+===========================================================================+
```

---

## 组件架构

### 多目标 Adapter 系统

CCS v7.45 引入了 Target Adapter 模式，实现与不同 CLI 实现的的无缝集成。

**关键架构：**

```
Profile Resolution (CLIProxy, Settings/API, Account-based)
        |
        v
Target Resolution (--target flag > runtime entrypoint / argv[0] > config > default)
        |
        v
Get Target Adapter (Claude, Droid, or Codex)
        |
        +---> detectBinary()     (find CLI on system)
        |
        +---> prepareCredentials() (write config or set env)
        |
        +---> buildArgs()        (construct CLI arguments)
        |
        +---> buildEnv()         (prepare environment variables)
        |
        v
Spawn Target Process
```

**每个目标 adapter 实现不同的凭证传递：**

- **Claude Adapter**：Env var 传递（现有行为）
  - `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_MODEL`
  - 无需配置文件

- **Droid Adapter**：配置文件传递到 `~/.factory/settings.json`
  - 写入自定义模型条目：`custom:ccs-<profile>`
  - 生成：`droid -m custom:ccs-<profile> <args>`
  - 模型配置包含 baseUrl、apiKey、provider

- **Codex Adapter**：瞬态运行时覆盖加上用户层 dashboard 检查
  - 仅对 CCS 路由的启动使用 `codex -c key=value`
  - 保留原生 `~/.codex/config.toml` 所有权
  - Dashboard 页面仅读取/写入用户配置层，带明确的运行时 vs provider 警告

**运行时入口点（内置 bins）和 argv[0] 风格别名：**

```
ccs        → Target: claude (default)
ccs-droid  → Target: droid (explicit alias)
ccsd       → Target: droid (legacy shortcut)
ccs-codex  → Target: codex (explicit alias)
ccsx       → Target: codex (short alias)
ccsxp      → Target: codex (native cliproxy shortcut; prepends `--config model_provider="cliproxy"`)
```

有关 adapter 架构的详细信息，请参见 [Target Adapters](./target-adapters.md)。

### CLI 层

```
+===========================================================================+
|                           CLI Architecture                                |
+===========================================================================+

  User Input (ccs [--target <cli>] <profile> [args])
        |
        v
  +-------------+
  |   ccs.ts    |  Entry point, command routing
  +-------------+
        |
        +---> [Version/Help/Doctor/etc.] ---> Exit
        |
        v
  +------------------+
  | Target Resolution | Determine which CLI to use
  +------------------+
        |
        v
  +-------------+
  |  Profile    |  Determines execution path
  |  Detection  |
  +-------------+
        |
        +---> [Native Claude Account] ---> execClaude()
        |                                       |
        +---> [CLIProxy Provider] ---> execClaudeWithCLIProxy()
        |                                       |
        +---> [Settings/API Profile] ---> normalize legacy glmt if needed
        |
        v
  +------------------+
  | Target Adapter   |  Get appropriate adapter
  +------------------+
        |
        v
  +------------------+
  | Prepare Creds    |  Deliver credentials
  +------------------+
        |
        v
  +------------------+
  | Target CLI       |  Claude Code or Droid
  +------------------+
```

---

## 数据流架构

### CLI 执行流程

```
+===========================================================================+
|                        CLI Execution Flow                                  |
+===========================================================================+

  1. Parse Arguments
        |
        v
  2. Resolve Target Type
        |
        v
  3. Detect Profile Type
        |
        +---> Native Claude ---> 3a. Load Account Settings
        |                              |
        |                              v
        |                        4a. Set CLAUDE_CONFIG_DIR
        |                              |
        |                              v
        |                        5a. Get Claude Target Adapter
        |
        +---> CLIProxy -------> 3b. Ensure Binary Installed
        |                              |
        |                              v
        |                        4b. Generate Config
        |                              |
        |                              v
        |                        5b. Resolve Target Adapter
        |                              |
        |                              v
        |                        6b. Prepare Credentials
        |                              |
        |                              v
        |                        7b. Spawn via Adapter
        |
        +---> Settings/API ---> 3c. Load settings env
                                      |
                                      v
                                4c. Normalize legacy glmt if needed
                                      |
                                      v
                                5c. Resolve Target Adapter
                                      |
                                      v
                                6c. Spawn via Adapter
```

---

## Provider 集成架构

有关详细 provider 流程（CLIProxyAPI、旧版 GLMT 兼容性、配额管理），请参见 [Provider Flows](./provider-flows.md)。

---

## 配置架构

### CCS 日志架构

- 共享日志契约位于 `src/services/logging/`，用于 CCS 自有运行时诊断、请求跟踪和有界最新条目读取。
- 配置位于 `~/.ccs/config.yaml` 的顶级 `logging.*`；`cliproxy.logging.*` 仅控制上游 CLIProxy 运行时文件。
- CCS 自有运行时日志写入 `~/.ccs/logs/current.jsonl` 并根据策略轮换进入 `~/.ccs/logs/archive/`。
- Dashboard 暴露使用原生 `/api/logs/config`、`/api/logs/sources` 和 `/api/logs/entries` 端点加上 `System -> Logs` React 页面。
- 请求日志记录明确跳过 `/api/logs` 读取，以便日志查看器不会递归记录自己。

### 配置文件层次结构

```
+===========================================================================+
|                     Configuration Hierarchy                                |
+===========================================================================

  ~/.ccs/
    |
    +---> config.yaml              # Main CCS config (unified)
    |
    +---> profiles.json            # Claude account registry
    |
    +---> <profile>.settings.json  # Per-profile settings
    |
    +---> cliproxy/
    |       |
    |       +---> config.yaml      # CLIProxy configuration
    |       +---> auth/            # OAuth tokens
    |       +---> bin/             # CLIProxy binary
    |
    +---> shared/                  # Symlinked resources
            |
            +---> commands/        # Claude Code commands
            +---> skills/          # Custom skills
            +---> agents/          # Agent configurations
            +---> plugins/
                    |
                    +---> cache/               # Shared plugin payload/cache data
                    +---> marketplaces/        # Shared marketplace payload directories
                    +---> installed_plugins.json

  ~/.ccs/instances/<profile>/
    |
    +---> plugins/
            |
            +---> known_marketplaces.json      # Instance-local registry for active CLAUDE_CONFIG_DIR validation

  ~/.factory/ (Droid CLI)
    |
    +---> settings.json            # Droid config (custom models)
```

插件所有权说明：
- `commands/`、`skills/`、`agents/` 和 `settings.json` 通过现有符号链接/复制流程保持共享。
- 市场 payload 目录保持共享，但 `known_marketplaces.json` 是按实例协调的，以便 Claude Code 可以针对该实例的 `CLAUDE_CONFIG_DIR/plugins/marketplaces` 验证 `installLocation`。

### 配置加载顺序

```
  1. Environment Variables (highest priority)
        |
        v
  2. CLI Arguments (including --target)
        |
        v
  3. Profile-specific settings (~/.ccs/<profile>.settings.json)
        |
        v
  4. Main config (~/.ccs/config.yaml)
        |
        v
  5. Default values (lowest priority)
```

---

## WebSocket 架构

### 实时通信

```
+===========================================================================+
|                     WebSocket Communication                                |
+===========================================================================+

  Dashboard (React)                     Server (Express)
        |                                      |
        |<------ Connection Established ------>|
        |                                      |
        |<------ health:update ----------------|  Health status
        |                                      |
        |<------ auth:status ------------------|  Auth changes
        |                                      |
        |<------ usage:update -----------------|  Usage stats
        |                                      |
        |------- action:refresh -------------->|  User requests
        |                                      |
```

---

## 安全架构

### 认证流程

请参见 [Provider Flows](./provider-flows.md) → Authentication Flow 部分。

### 安全边界

```
  +------------------+
  | User Terminal    |
  +------------------+
        |
        | Local only (no network exposure)
        v
  +------------------+
  | CCS CLI          |
  +------------------+
        |
        | Localhost only (127.0.0.1)
        v
  +------------------+
  | CLIProxy/Legacy  |  Binds to localhost only
  +------------------+
        |
        | TLS encrypted
        v
  +------------------+
  | Target CLI       |  Spawned locally (claude/droid)
  +------------------+
        |
        | TLS encrypted
        v
  +------------------+
  | Provider APIs    |  External endpoints
  +------------------+
```

---

## 构建和分发

### 构建管道

```
+===========================================================================+
|                        Build Pipeline                                      |
+===========================================================================+

  src/ (TypeScript)                    ui/src/ (React TSX)
        |                                      |
        v                                      v
  TypeScript Compiler                  Vite Build
        |                                      |
        v                                      v
  dist/ (JavaScript)                   dist/ui/ (Static assets)
        |                                      |
        +---------------+---------------------+
                        |
                        v
               npm package (@kaitranntt/ccs)
                        |
                        v
               npm registry / GitHub releases
```

### 包内容

```
  @kaitranntt/ccs
        |
        +---> dist/           # Compiled CLI
        +---> dist/ui/        # Built dashboard
        +---> lib/            # Native scripts
        |       +---> ccs     # Bash bootstrap
        |       +---> ccs.ps1 # PowerShell bootstrap
        +---> package.json
```

---

## 部署架构

### 本地安装

```
  npm install -g @kaitranntt/ccs
        |
        v
  Global node_modules
        |
        +---> Creates symlink: ccs --> dist/ccs.js
        |
        +---> Runtime aliases: ccs-droid / ccsd → ccs (auto-select droid target)
        |
        +---> First run creates: ~/.ccs/
```

### PR 审查通道

自动拉取请求审查保留在 `.github/workflows/ai-review.yml` 中，但工作流现在运行 PR-Agent 而不是旧的 Claude action。审查在现有自托管 `cliproxy` runner 上运行，而工作流保留现有 `AI_REVIEW_BASE_URL`、`AI_REVIEW_MODEL` 和 `AI_REVIEW_API_KEY` 契约，方法是将这些值映射到 PR-Agent env keys 如 `OPENAI.*`、`config.*` 和 `github_action_config.*`。Repo 特定的审查者指导位于 `.pr_agent.toml` 中。

```
GitHub Actions `ai-review.yml`
      |
      v
Self-hosted `cliproxy` runner
      |
      v
PR-Agent action
      |
      v
CLIProxy
      |
      v
Configured model from `.pr_agent.toml`
```

- `ai-review.yml` 拥有自动化接线，如 runner 选择、PR-Agent action 使用和运行时值从 `AI_REVIEW_*` 映射到 `OPENAI.*`、`config.*` 和 `github_action_config.*`。
- repo 根目录中的 `.pr_agent.toml` 拥有此仓库的审查指导。
- 贡献者应将 PR-Agent 评论和受信任的 `/review` 重新运行视为针对 CCS 的 PR 的主要 AI 审查通道。

### 运行时依赖

```
  +------------------+     +------------------+
  |   Node.js 14+    |     |   Claude CLI     |
  |   (required)     |     |   (required)     |
  +------------------+     +------------------+

  +------------------+     +------------------+
  |   CLIProxyAPI    |     |   Droid CLI      |
  |   (auto-managed) |     |   (optional)     |
  +------------------+     +------------------+
```

---

## 相关文档

- [Codebase Summary](../codebase-summary.md) - 详细目录结构
- [Code Standards](../code-standards.md) - 编码约定和模式
- [Target Adapters](./target-adapters.md) - 多 CLI adapter 架构
- [Provider Flows](./provider-flows.md) - CLIProxy、旧版 GLMT 兼容性、认证流程
- [Project Roadmap](../project-roadmap.md) - 开发阶段
