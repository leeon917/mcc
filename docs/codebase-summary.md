# CCS 代码库摘要

最后更新：2026-04-26

全面概述模块化后的 CCS 代码库结构，涵盖第 9 阶段模块化工作（Settings、Analytics、Auth Monitor 拆分 + 测试基础设施）、v7.1 远程 CLIProxy 功能、v7.2 Kiro + GitHub Copilot (ghcp) OAuth providers、v7.14 混合配额管理、v7.34 图片分析 Hook、账户上下文验证强化、官方 Claude Channels 运行时支持、原生 Codex 运行时目标支持、原生 Codex/Droid 使用收集器以及 models.dev 支持的模型定价元数据。

## 仓库结构

```
ccs/
├── src/                      # CLI TypeScript 源代码
├── dist/                     # 编译后的 JavaScript（npm 包）
├── lib/                      # 原生 shell 脚本（bash、PowerShell）
├── ui/                       # React dashboard 应用程序
│   ├── src/                  # UI 源代码
│   └── dist/                  # 构建后的 UI bundle
├── docker/                    # Docker 部署配置
│   ├── Dockerfile            # 多阶段构建（bun 1.2.21，node:20-bookworm-slim）
│   ├── docker-compose.yml    # Compose 设置，包含资源限制和 healthcheck
│   ├── entrypoint.sh         # 带权限降级的入口脚本，使用帮助
│   └── README.md             # Docker 部署指南
├── tests/                    # 测试套件
├── docs/                     # 文档
└── assets/                   # 静态资源（logo、截图）
```

---

## CLI 源代码 (`src/`)

主 CLI 按领域特定模块组织，包含 barrel exports。

### 目录结构

```
src/
├── ccs.ts                    # 主入口点和 profile 执行流程
├── bin/                      # 专用运行时入口点
│   ├── droid-runtime.ts      # 为 ccs-droid / ccsd 包 bins 强制 droid 目标
│   ├── codex-runtime.ts      # 为 ccs-codex / ccsx 包 bins 强制 codex 目标
│   └── ccsxp-runtime.ts      # 强制 codex 目标 + 原生 cliproxy 覆盖用于 ccsxp
├── types/                    # TypeScript 类型定义
│   ├── index.ts              # Barrel 导出（聚合所有类型）
│   ├── cli.ts                # CLI 类型（ParsedArgs、ExitCode）
│   ├── config.ts             # 配置类型（Settings、EnvVars）
│   ├── delegation.ts         # Delegation 类型（sessions、events）
│   ├── glmt.ts               # 旧版 transformer 类型（messages、transforms）
│   └── utils.ts              # 工具类型（ErrorCode、LogLevel）
│
├── commands/                 # CLI 命令处理器
│   ├── api-command/          # API profile 子命令（facade + 处理器拆分）
│   │   ├── index.ts          # API 命令 facade/路由器
│   │   ├── shared.ts         # 共享 API 参数解析辅助
│   │   └── [子命令文件...]
│   ├── cliproxy-command.ts   # CLIProxy 子命令处理
│   ├── config-command.ts     # 配置管理命令
│   ├── config-image-analysis-command.ts  # 一级 ImageAnalysis 配置（新增 v7.34）
│   ├── named-command-router.ts  # 可重用的命名命令调度器
│   ├── doctor-command.ts     # 健康诊断
│   ├── env-command.ts        # 为第三方工具导出 shell env 变量（v7.39）
│   ├── help-command.ts       # 帮助文本生成
│   ├── install-command.ts    # 安装/卸载逻辑
│   ├── root-command-router.ts  # 从 ccs.ts 提取的顶层命令调度
│   ├── shell-completion-command.ts
│   ├── sync-command.ts       # 符号链接同步
│   ├── update-command.ts     # 自我更新逻辑
│   └── version-command.ts    # 版本显示
│
├── targets/                  # 多目标 adapter 系统（新增）
│   ├── index.ts              # Barrel 导出
│   ├── target-adapter.ts     # TargetAdapter 接口契约
│   ├── target-registry.ts    # 运行时 adapter 查找注册表
│   ├── target-resolver.ts    # 解析逻辑（标志 > 运行时入口点 / argv[0] > 配置）
│   ├── target-metadata.ts    # 运行时 vs 持久化目标元数据和别名列表
│   ├── target-runtime-compatibility.ts # 目标/profile 组合的护栏
│   ├── claude-adapter.ts     # Claude Code CLI 实现
│   ├── droid-adapter.ts      # Factory Droid CLI 实现
│   ├── codex-adapter.ts      # 原生 Codex CLI 实现
│   ├── codex-detector.ts     # Codex 二进制检测和能力探测
│   ├── droid-detector.ts     # Droid 二进制检测和版本检查
│   └── droid-config-manager.ts  # ~/.factory/settings.json 管理
│
├── auth/                     # 认证模块
│   ├── index.ts              # Barrel 导出
│   ├── commands/             # Auth 特定 CLI 命令
│   │   └── index.ts
│   ├── account-switcher.ts   # 账户切换逻辑
│   └── profile-detector.ts   # Profile 检测（474 行）
│
├── config/                   # 配置管理
│   ├── index.ts              # Barrel 导出
│   ├── unified-config-loader.ts  # 中央配置加载器（546 行）
│   └── migration-manager.ts  # 配置迁移逻辑
│
├── proxy/                    # OpenAI 兼容代理运行时
│   ├── index.ts              # Barrel 导出
│   ├── proxy-daemon-entry.ts # Daemon 入口点
│   ├── proxy-daemon.ts       # 生命周期、health 和端口绑定
│   ├── proxy-port-resolver.ts # 自适应 per-profile 端口选择
│   ├── request-router.ts     # 请求时 profile/model 路由
│   ├── profile-router.ts     # Profile 解析辅助
│   ├── proxy-env.ts          # 本地运行时 env 构建
│   ├── routing-config.ts     # 代理路由配置解析
│   ├── upstream-url.ts       # 上游端点解析
│   ├── proxy-daemon-state.ts # 持久化运行状态元数据
│   ├── server/               # HTTP 服务器和路由
│   └── transformers/         # 请求和 SSE 转换
│
├── channels/                 # 官方 Claude channel 集成
│   ├── official-channels-runtime.ts  # 运行时门控、插件规格、设置指导
│   └── official-channels-store.ts    # Claude channel token/env 存储辅助
│
├── cliproxy/                 # CLIProxyAPI 集成（高度模块化）
│   ├── index.ts              # Barrel 导出（137 行，大量内容）
│   ├── auth/                 # OAuth 处理器、token 管理
│   │   └── index.ts
│   ├── binary/               # 二进制管理
│   │   └── index.ts
│   ├── services/             # 服务层
│   │   └── index.ts
│   ├── cliproxy-executor.ts  # 主执行器（666 行）
│   ├── config-generator.ts   # 配置文件生成（531 行）
│   ├── account-manager.ts    # 账户管理（509 行）
│   ├── quota-manager.ts      # 混合配额管理（新增 v7.14）
│   ├── quota-fetcher.ts      # Provider 配额 API 集成（新增 v7.14）
│   ├── platform-detector.ts  # OS/arch 检测
│   ├── binary-manager.ts     # 二进制下载/更新
│   ├── auth-handler.ts       # 认证处理
│   ├── model-catalog.ts      # Provider 模型定义
│   ├── model-config.ts       # 模型配置
│   ├── codex-plan-compatibility.ts  # Codex free/paid 模型回退护栏
│   ├── service-manager.ts    # 后台服务
│   ├── proxy-detector.ts     # 运行中的代理检测
│   ├── startup-lock.ts       # 竞态条件预防
│   ├── remote-proxy-client.ts    # 远程代理健康检查（v7.1）
│   ├── proxy-config-resolver.ts  # CLI/env/配置合并（v7.1）
│   ├── types.ts              # ResolvedProxyConfig 用于本地/远程模式
│   └── [更多文件...]
│
├── copilot/                  # GitHub Copilot 集成
│   ├── index.ts              # Barrel 导出
│   └── copilot-package-manager.ts  # 包管理（515 行）
│
├── glmt/                     # 为保持兼容性而保留的旧版 transformer 内部实现
│   ├── index.ts              # Barrel 导出
│   ├── pipeline/             # 处理管道
│   │   └── index.ts
│   ├── glmt-proxy.ts         # 为内部兼容性保留的旧版代理运行时
│   └── delta-accumulator.ts  # Delta 处理（484 行）
│
├── delegation/               # 任务 delegation 和无头执行
│   ├── index.ts              # Barrel 导出
│   ├── executor/             # 执行引擎
│   └── [delegation 文件...]
│
├── errors/                   # 集中式错误处理
│   ├── index.ts              # Barrel 导出
│   ├── error-handler.ts      # 主错误处理器
│   ├── exit-codes.ts         # 退出代码定义
│   └── cleanup.ts            # 清理逻辑
│
├── management/               # Doctor 诊断
│   ├── index.ts              # Barrel 导出
│   ├── checks/               # 诊断检查
│   │   ├── index.ts
│   │   └── image-analysis-check.ts  # ImageAnalysis 运行时验证（新增 v7.34）
│   └── repair/               # 自动修复逻辑
│       └── index.ts
│
├── api/                      # API 工具和服务
│   ├── index.ts              # Barrel 导出
│   └── services/             # API 服务
│       ├── index.ts
│       ├── profile-reader.ts
│       └── profile-writer.ts
│
├── utils/                    # 工具库（模块化到子目录）
│   ├── index.ts              # Barrel 导出
│   ├── ui/                   # 终端 UI 工具
│   │   ├── index.ts
│   │   ├── boxes.ts          # 框绘制
│   │   ├── colors.ts         # 终端颜色
│   │   └── spinners.ts       # 进度旋转器
│   ├── websearch/            # 搜索工具集成
│   │   └── index.ts
│   ├── hooks/                # Claude Code 兼容性 hooks（新增 v7.34）
│   │   ├── index.ts
│   │   ├── image-analyzer-hook-installer.ts
│   │   ├── image-analyzer-hook-configuration.ts
│   │   ├── image-analyzer-profile-hook-injector.ts
│   │   └── get-image-analysis-hook-env.ts
│   ├── image-analysis/       # ImageAnalysis MCP/运行时工具（新增 v7.34）
│   │   ├── index.ts
│   │   ├── hook-installer.ts
│   │   ├── mcp-installer.ts
│   │   └── claude-tool-args.ts
│   └── [工具文件...]
│
└── web-server/               # Express web 服务器（高度模块化）
    ├── index.ts              # 服务器入口和 barrel 导出
    ├── routes/               # 15+ 路由处理器
    │   ├── index.ts
    │   ├── accounts-route.ts
    │   ├── auth-route.ts
    │   ├── channels-routes.ts
    │   ├── cliproxy-route.ts
    │   ├── copilot-route.ts
    │   ├── doctor-route.ts
    │   ├── glmt-route.ts
    │   ├── health-route.ts
    │   ├── profiles-route.ts
    │   └── [更多路由...]
    ├── health/               # 健康检查系统
    │   └── index.ts
    ├── usage/                # 使用分析模块（默认 Claude、CCS 实例、原生 Codex/Droid、CLIProxy 快照）
    │   ├── index.ts
    │   ├── handlers.ts       # 请求处理器（633 行）
    │   ├── aggregator.ts     # 数据聚合（538 行）
    │   ├── codex-native-usage-collector.ts  # 原生 Codex rollout JSONL 收集器
    │   ├── droid-native-usage-collector.ts  # 原生 Droid SQLite 收集器
    │   └── data-aggregator.ts
    ├── models-dev/           # 缓存的 models.dev 元数据/定价注册表集成
    │   ├── registry-cache.ts
    │   ├── pricing-resolver.ts
    │   └── types.ts
    ├── services/             # 共享服务
    │   └── index.ts
    └── model-pricing.ts      # 静态定价回退 + models.dev 解析器
```

### 模块类别

| 类别 | 目录 | 用途 |
|----------|-------------|---------|
| 核心 | `commands/`、`errors/` | CLI 命令、错误处理 |
| 目标 | `bin/`、`targets/` | 多 CLI adapter 模式（Claude Code、Factory Droid、Codex CLI，可扩展） |
| 认证 | `auth/`、`cliproxy/auth/` | 跨 providers 认证 |
| 配置 | `config/`、`types/` | 配置和类型定义 |
| OpenAI 代理 | `proxy/` | 自适应本地 OpenAI 兼容代理运行时、profile 路由和 SSE 转换 |
| Providers | `cliproxy/`、`copilot/`、`glmt/` | Provider 集成及保留的旧版 transformer 内部实现 |
| 配额 | `cliproxy/quota-*.ts`、`account-manager.ts` | 混合配额管理（v7.14） |
| 远程代理 | `cliproxy/remote-*.ts`、`proxy-config-resolver.ts` | 远程 CLIProxy 支持（v7.1） |
| 图片分析 | `utils/image-analysis/`、`utils/hooks/` | 视觉模型代理（v7.34） |
| 服务 | `web-server/`、`api/` | HTTP 服务器、API 服务 |
| 工具 | `utils/`、`management/` | 辅助工具、诊断 |

### 账户上下文元数据流

- 源字段：`~/.ccs/config.yaml` 中的 `accounts.<name>.context_mode`、`accounts.<name>.context_group`、`accounts.<name>.continuity_mode`。
- 运行时策略解析器：`src/auth/account-context.ts`。
- 元数据存储规范化：`src/auth/profile-registry.ts`。
- API 写入验证：`src/web-server/routes/config-routes.ts` 中的 `PUT /api/config`。
- 规则：
  - mode 是隔离优先的（`isolated` 默认，`shared` 可选）
  - shared 模式需要非空有效的 `context_group`
  - shared 模式连续性深度默认为 `standard`，可选 `deeper`
  - `context_group` 被规范化（trim + 小写 + 空白折叠为 `-`）
  - API 路由在 mode 不是 `shared` 时拒绝 `context_group`/`continuity_mode`
  - 注册表规范化删除格式错误的持久化 `context_group` 值

### 共享插件布局

- 共享 payload owner：`src/management/shared-manager.ts`。
- Profile 入口点：`src/management/instance-manager.ts`。
- `plugins/marketplaces/`、`plugins/cache/` 和 `installed_plugins.json` 通过 `~/.ccs/shared/` 拓扑保持共享。
- `known_marketplaces.json` 现在在 `~/.ccs/instances/<profile>/plugins/` 下是实例本地的，这样 Claude Code 可以针对活动的 `CLAUDE_CONFIG_DIR` 而不是最后写入者获胜的共享文件验证 `installLocation`。

### 官方 Claude Channels

- 运行时契约在 `src/channels/official-channels-runtime.ts` 中实现，从 `src/ccs.ts`、`src/commands/config-channels-command.ts` 和 `src/web-server/routes/channels-routes.ts` 消费。
- 规范配置在 `~/.ccs/config.yaml` 下的 `channels.*` 中；旧版 `discord_channels.*` 仅在规范字段缺失时保持读取兼容。

### 原生 Codex 运行时目标

- 专用运行时入口点：`ccs-codex` 和 `ccsx` 通过 `src/bin/codex-runtime.ts` 解析，而 `ccsxp` 通过 `src/bin/ccsxp-runtime.ts` 解析；所有三个都设置 `CCS_INTERNAL_ENTRY_TARGET=codex` 然后委托给 `src/targets/target-resolver.ts`。
- Provider 快捷方式行为：`ccsxp` 剥离用户提供的 `--target` 覆盖并添加 `--config model_provider="cliproxy"`，因此它的行为类似于原生 Codex 加上 CLIProxy provider 配方。更严格的 CCS 托管桥接仍可通过 `ccs codex --target codex` 明确使用。它将 `CODEX_HOME` 默认为原生 `~/.codex`，这样继承的启动器状态不会将历史/配置写入发送到非标准 Codex 根目录；`CCSXP_CODEX_HOME` 是明确的覆盖。
- `argv[0]` 别名映射仍然存在于 `src/targets/target-resolver.ts` 中用于同二进制/自定义别名场景，但上述内置 npm bins 在运行时不依赖该映射。
- 元数据边界：`src/targets/target-metadata.ts` 在 v1 中保持 Codex 运行时独有，因此持久化的默认目标仍是 `claude | droid`。
- 兼容性护栏：`src/targets/target-runtime-compatibility.ts` 集中了哪些 profile 类型可以在 Codex 上执行。
- Adapter 行为：`src/targets/codex-adapter.ts` 和 `src/targets/codex-detector.ts` 启动原生 Codex 而不重写 `~/.codex/config.toml`；CCS 支持的路由使用瞬态 `codex -c key=value` overrides 和 env-key 注入。
- Dashboard 控制中心：`src/web-server/services/codex-dashboard-service.ts`、`src/web-server/routes/codex-routes.ts`、`ui/src/pages/codex.tsx` 和 `ui/src/components/compatible-cli/codex-*.tsx` 暴露分屏 Codex dashboard，其中包含顶级设置、信任、profiles、providers、MCP servers 和功能标志的引导编辑器以及原始 TOML 回退。
- 结构化编辑边界：引导式 Codex 保存有意地重新序列化整个 TOML 文档，因此注释/格式被规范化，原始编辑器仍然是保真度保留的逃生通道。
- 后续行为：结构化保存立即刷新原始快照，刷新丢弃过时的原始草稿，结构化控制在原始 TOML 脏/无效/不可读时保持禁用，项目信任路径必须是绝对路径或 `~/...`，不支持的上游顶级形状被保留而不是删除，功能标志可以重置为默认值。
- v1 中支持的 Codex 流程：
  - `default`
  - CLIProxy provider `codex`
  - 仅当 API profiles 解析为 Codex CLIProxy 桥接时才支持 settings/API profiles
- Telegram 和 Discord bot tokens 被有意写入 Claude 管理的机器状态下的 `~/.claude/channels/<channel>/.env`，除非官方 `*_STATE_DIR` 环境覆盖将 channel 定向到其他位置。
- iMessage 是无 token 的，仅限 macOS，仍然依赖于 Claude 端插件安装加上 OS 权限。
- 自动启用需要 Bun 可用、验证的 Claude Code v2.1.80+、验证的 `claude.ai` 认证、原生 Claude `default/account` 会话以及每个 channel 的设置就绪。
- Dashboard channels 部分从 `/api/channels` 公开 Bun/版本/认证/状态范围状态，在保存/刷新后续失败时保留 token 草稿，并保持不支持的已选 iMessage 可见以便可以关闭。

### 结构化日志域

- CCS 自有的运行时日志现在位于 `src/services/logging/`。
- 共享域拥有路径解析、重定向、轮换/修剪、缓冲的最新条目读取以及 CLI/服务器/运行时代码使用的 logger factory。
- Dashboard 暴露位于 `src/web-server/routes/logs-routes.ts`、`src/web-server/services/logs-dashboard-service.ts` 和 `src/web-server/middleware/request-logging-middleware.ts`。
- 原生 dashboard 查看器位于 `ui/src/pages/logs.tsx`，支持组件在 `ui/src/components/logs/` 下，hooks 在 `ui/src/hooks/use-logs.ts`。
- 旧版 CLIProxy 错误文件仍然存在于 `~/.ccs/cliproxy/logs` 下，作为标记的旧版来源而不是主要的 CCS 日志模型。

### Target Adapter 模块

targets 模块提供一个可扩展的接口，用于将 profiles 分派到不同的 CLI 实现。

**关键组件：**

1. **TargetAdapter 接口** - 每个 CLI 实现必须满足的契约：
   - 二进制检测
   - 凭证准备
   - 目标特定 args/env 构建
   - 进程执行
   - profile 兼容性检查

2. **目标解析** - 优先级顺序：
   - `--target <cli>` 标志（CLI 参数）
   - 通过 `CCS_INTERNAL_ENTRY_TARGET` 的明确运行时入口点（由 `src/bin/droid-runtime.ts`、`src/bin/codex-runtime.ts` 和 `src/bin/ccsxp-runtime.ts` 使用）
   - `argv[0]` 检测用于自定义/同二进制运行时别名
   - Per-profile `target` 字段（来自 config.yaml）
   - 默认：`claude`

3. **实现：**
   - **ClaudeAdapter** - 包装现有行为；通过环境变量传递凭证
   - **DroidAdapter** - 新实现；写入 ~/.factory/settings.json 并使用 `-m custom:ccs-<profile>` 标志生成

4. **注册表** - 运行时基于 Map 的 O(1) 查找

**使用流程：**
```
Profile 解析（现有）
  ↓
目标解析（通过 resolver.ts）
  ↓
从注册表获取 adapter
  ↓
准备凭证（adapter.prepareCredentials）
  ↓
构建 args 和 env（adapter.buildArgs、buildEnv）
  ↓
生成目标 CLI（adapter.exec）
```

---

## UI 源代码 (`ui/src/`)

按领域组织的 React dashboard，每层都有 barrel exports。

### 目录结构

```
ui/src/
├── components/
│   ├── index.ts              # 主 barrel（聚合所有领域）
│   │
│   ├── account/              # 账户管理
│   │   ├── index.ts          # Barrel 导出
│   │   ├── accounts-table.tsx
│   │   ├── add-account-dialog.tsx
│   │   └── flow-viz/         # 流可视化（从 1,144 行文件拆分）
│   │       ├── index.tsx     # 主组件（200 行）
│   │       ├── account-card.tsx
│   │       ├── account-card-stats.tsx
│   │       ├── connection-timeline.tsx
│   │       ├── flow-paths.tsx
│   │       ├── flow-viz-header.tsx
│   │       ├── provider-card.tsx
│   │       ├── hooks.ts
│   │       ├── types.ts
│   │       ├── utils.ts
│   │       ├── path-utils.ts
│   │       └── zone-utils.ts
│   │
│   ├── analytics/            # 使用图表、统计卡片
│   │   ├── index.ts
│   │   ├── cliproxy-stats-card.tsx
│   │   └── usage-trend-chart.tsx
│   │
│   ├── cliproxy/             # CLIProxy 配置
│   │   ├── index.ts          # Barrel 导出（30 行）
│   │   ├── provider-editor/  # 从 921 行文件拆分
│   │   │   ├── index.tsx     # 主编辑器（250 行）
│   │   │   └── [13 个专注模块]
│   │   ├── config/           # YAML 编辑器、文件树
│   │   │   ├── config-split-view.tsx
│   │   │   ├── diff-dialog.tsx
│   │   │   ├── file-tree.tsx
│   │   │   └── yaml-editor.tsx
│   │   ├── overview/         # 健康列表、偏好设置
│   │   │   ├── credential-health-list.tsx
│   │   │   ├── model-preferences-grid.tsx
│   │   │   └── quick-stats-row.tsx
│   │   └── [7 个顶级组件文件]
│   │
│   ├── copilot/              # Copilot 设置
│   │   ├── index.ts
│   │   └── config-form/      # 从 846 行文件拆分
│   │       └── [13 个专注模块]
│   │
│   ├── health/               # 系统健康仪表
│   │   └── index.ts
│   │
│   ├── layout/               # 应用结构
│   │   ├── index.ts
│   │   ├── sidebar.tsx
│   │   └── footer.tsx
│   │
│   ├── monitoring/           # 错误日志、认证监视器
│   │   ├── index.ts
│   │   ├── proxy-status-widget.tsx
│   │   ├── auth-monitor/     # 从 465 行文件拆分（8 个文件）
│   │   │   ├── index.tsx     # 主组件
│   │   │   ├── types.ts
│   │   │   ├── hooks.ts
│   │   │   ├── utils.ts
│   │   │   └── components/
│   │   │       ├── live-pulse.tsx
│   │   │       ├── inline-stats-badge.tsx
│   │   │       ├── provider-card.tsx
│   │   │       └── summary-card.tsx
│   │   └── error-logs/       # 从 617 行文件拆分
│   │       └── [6 个专注模块]
│   │
│   ├── profiles/             # Profile 管理
│   │   ├── index.ts
│   │   ├── profile-dialog.tsx
│   │   ├── profile-create-dialog.tsx
│   │   └── editor/           # 从 531 行文件拆分
│   │       └── [10 个专注模块]
│   │
│   ├── setup/                # 快速设置向导
│   │   ├── index.ts
│   │   └── wizard/           # 基于步骤的向导
│   │       ├── index.tsx
│   │       └── steps/
│   │
│   ├── shared/               # 可重用组件（19 个组件）
│   │   ├── index.ts
│   │   ├── ccs-logo.tsx
│   │   ├── code-editor.tsx
│   │   ├── confirm-dialog.tsx
│   │   ├── provider-icon.tsx
│   │   ├── settings-dialog.tsx
│   │   ├── stat-card.tsx
│   │   └── [13 个更多共享组件]
│   │
│   └── ui/                   # shadcn/ui 原语
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── searchable-select.tsx  # 用于模型选择器的共享可搜索组合框
│       ├── sidebar.tsx       # 自定义侧边栏（674 行）
│       └── [UI 原语...]
│
├── contexts/                 # React Contexts
│   ├── privacy-context.tsx
│   ├── theme-context.tsx
│   └── websocket-context.tsx
│
├── hooks/                    # 自定义 hooks（领域前缀）
│   ├── use-accounts.ts
│   ├── use-cliproxy.ts
│   ├── use-health.ts
│   ├── use-profiles.ts
│   ├── use-websocket.ts
│   └── [更多 hooks...]
│
├── lib/                      # 工具库
│   ├── api.ts                # API 客户端
│   ├── model-catalogs.ts     # 模型定义
│   └── utils.ts              # 辅助函数
│
├── pages/                    # 页面组件（懒加载）
│   ├── analytics/            # 从 420 行文件拆分（8 个文件）
│   │   ├── index.tsx         # 主布局
│   │   ├── types.ts          # 分析类型
│   │   ├── hooks.ts          # 数据获取 hooks
│   │   ├── utils.ts          # 工具函数
│   │   └── components/
│   │       ├── analytics-header.tsx
│   │       ├── analytics-skeleton.tsx
│   │       ├── charts-grid.tsx
│   │       └── cost-by-model-card.tsx
│   ├── settings/             # 从 1,781 行文件拆分（20 个文件）
│   │   ├── index.tsx         # 带懒加载的主布局
│   │   ├── context.tsx       # 设置 provider 包装器
│   │   ├── settings-context.ts
│   │   ├── types.ts
│   │   ├── hooks.ts          # 旧版 re-exports
│   │   ├── hooks/
│   │   │   ├── index.ts
│   │   │   ├── context-hooks.ts
│   │   │   ├── use-official-channels-config.ts
│   │   │   ├── use-settings-tab.ts
│   │   │   ├── use-proxy-config.ts
│   │   │   ├── use-websearch-config.ts
│   │   │   ├── use-globalenv-config.ts
│   │   │   └── use-raw-config.ts
│   │   ├── components/
│   │   │   ├── section-skeleton.tsx
│   │   │   └── tab-navigation.tsx
│   │   └── sections/
│   │       ├── channels.tsx
│   │       ├── globalenv-section.tsx
│   │       ├── websearch/
│   │       │   ├── index.tsx
│   │       │   └── provider-card.tsx
│   │       └── proxy/
│   │           ├── index.tsx
│   │           ├── local-proxy-card.tsx
│   │           └── remote-proxy-card.tsx
│   ├── api.tsx               # API profiles 页面（350 行）
│   ├── cliproxy.tsx          # CLIProxy 页面（405 行）
│   ├── copilot.tsx           # Copilot 页面（295 行）
│   └── health.tsx            # 健康页面（256 行）
│
└── providers/                # Context providers
    └── websocket-provider.tsx
```

### 组件统计

| 领域 | 组件数 | 子目录数 | 拆分文件数 |
|--------|------------|---------|-------------|
| account | 3 | flow-viz (12 files) | 1 个巨型拆分 |
| analytics | 3 | - | - |
| cliproxy | 10 | provider-editor, config, overview | 1 个巨型拆分 |
| copilot | 2 | config-form (13 files) | 1 个巨型拆分 |
| health | 2 | - | - |
| layout | 3 | - | - |
| monitoring | 3 | auth-monitor (8 files), error-logs (6 files) | 2 个巨型拆分 |
| profiles | 4 | editor (10 files) | 1 个巨型拆分 |
| setup | 2 | wizard/steps | - |
| shared | 19 | - | - |
| **总计** | **51+** | **10 个子目录** | **7 个拆分** |

### 页面统计

| 页面 | 结构 | 文件数 | 备注 |
|------|-----------|-------|-------|
| analytics | 目录 | 8 | 2025-12-21 拆分 |
| settings | 目录 | 20 | 2025-12-21 拆分，懒加载部分 |
| api | 单文件 | 1 | 350 行 |
| cliproxy | 单文件 | 1 | 405 行 |
| copilot | 单文件 | 1 | 295 行 |
| health | 单文件 | 1 | 256 行 |

---

## 关键文件指标

### 最大文件（可接受的例外）

**CLI (`src/`)：**

| 文件 | 行数 | 状态 |
|------|-------|--------|
| model-pricing.ts | 920 | 静态定价回退和解析器入口点 |
| glmt-proxy.ts | 675 | 旧版内部兼容性路径 - 目前可接受 |
| cliproxy-executor.ts | 666 | 核心逻辑 - 可接受 |
| cliproxy-command.ts | 634 | 如需要可以拆分 |
| usage/handlers.ts | 633 | 如需要可以拆分 |
| ccs.ts | 596 | 入口点 - 可接受 |
| unified-config-loader.ts | 546 | 复杂 - 可接受 |

**UI (`ui/src/`)：**

| 文件 | 行数 | 状态 |
|------|-------|--------|
| components/ui/sidebar.tsx | 674 | shadcn - 可接受 |
| pages/cliproxy.tsx | 405 | 可接受 |
| pages/api.tsx | 350 | 可接受 |
| pages/copilot.tsx | 295 | 可接受 |
| pages/health.tsx | 256 | 可接受 |

**已拆分文件（已完成）：**

| 原始文件 | 行数 | 新位置 | 文件数 |
|----------|-------|--------------|-------|
| pages/settings.tsx | 1,781 | pages/settings/ | 20 |
| pages/analytics.tsx | 420 | pages/analytics/ | 8 |
| monitoring/auth-monitor.tsx | 465 | monitoring/auth-monitor/ | 8 |

---

## 导入模式

### 标准导入路径

```typescript
// 从 src/ 中的任何文件
import { Config, Settings } from '../types';
import { execClaudeWithCLIProxy } from '../cliproxy';
import { handleError } from '../errors';

// 从 ui/src/ 中的任何文件
import { AccountsTable, ProviderIcon, StatCard } from '@/components';
import { useAccounts, useProfiles } from '@/hooks';
```

### Barrel Export 模式

每个领域目录都有一个 `index.ts` 聚合导出：

```typescript
// ui/src/components/cliproxy/index.ts
export { CategorizedModelSelector } from './categorized-model-selector';
export { CliproxyDialog } from './cliproxy-dialog';
// ...

// 从子目录
export { ProviderEditor } from './provider-editor';
export type { ProviderEditorProps } from './provider-editor';
```

---

## 测试结构

```
tests/
├── unit/                     # 单元测试（7 个核心测试文件）
│   ├── data-aggregator.test.ts
│   ├── cliproxy/
│   │   └── remote-proxy-client.test.ts
│   ├── commands/
│   │   └── env-command.test.ts
│   ├── jsonl-parser.test.ts
│   ├── model-pricing.test.ts
│   ├── unified-config.test.ts
│   └── mcp-manager.test.ts
├── integration/              # 集成测试
├── native/                   # 原生安装测试
│   ├── linux/
│   ├── macos/
│   └── windows/
├── npm/                      # npm 包测试
├── shared/                   # 共享测试工具
└── README.md
```

### 测试指标

| 指标 | 值 |
|--------|---------|
| 总测试数 | 1440 |
| 通过 | 1440 |
| 跳过 | 6 |
| 失败 | 0 |
| 覆盖率阈值 | 90% |
| 测试文件 | 41 |

---

## 构建输出

| 输出 | 源 | 用途 |
|--------|--------|---------|
| `dist/` | `src/` | npm 包（CLI） |
| `dist/ui/` | `ui/src/` | 构建的 React 应用（由 Express 提供服务） |
| `lib/` | N/A | 原生 shell 脚本 |

---

## 相关文档

- [Code Standards](./code-standards.md) - 模块化模式、文件大小规则
- [System Architecture](./system-architecture/index.md) - 高层架构图
- [Project Roadmap](./project-roadmap.md) - 模块化阶段和未来工作
- [WebSearch](./websearch.md) - WebSearch 功能文档
- [Image Analysis](./image-analysis.md) - 一级 ImageAnalysis 运行时文档
- [CLAUDE.md](../CLAUDE.md) - AI 面向的开发指导
