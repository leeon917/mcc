# MCC — My Cloud Code

多账号切换工具，在多个 Claude Code 账号（不同 API Provider）之间快速切换。支持直接 API 和 OpenAI 兼容模式（自动翻译 proxy）。

## 快速上手

```bash
pnpm install           # 没装 pnpm？先 `npm i -g pnpm`
pnpm build             # 首次必跑：tsc 编译后端
pnpm mcc -h            # 验证 CLI（pnpm 直接透传 flag，无需 --）
pnpm dev               # 启动前后端 dev server，浏览器开 http://localhost:5173
```

## 核心命令

```bash
mcc <profile> [args...]         # 用指定 profile 启动 Claude Code
mcc profile add <name>           # 添加 profile
mcc profile list                 # 查看所有 profile
mcc profile remove <name>       # 删除 profile
mcc profile default [name]      # 设默认 profile
mcc profile test [name...]       # 体检 profile（验 key + 余额）
mcc profile test x --vision      # 额外探测主模型能否识图
mcc mcp list                     # 查看可用 MCP 工具
mcc mcp add --name <id> --command <cmd>  # 添加外部 MCP 工具
mcc mcp remove <name>           # 删除外部 MCP 工具
mcc mcp enable <name> <profile> # 启用外部 MCP（指定 profile）
mcc mcp disable <name> <profile> # 禁用外部 MCP
mcc config                       # 打开 Web 配置控制台
```

## 核心功能

- **多 profile 管理**：API key 存 `~/.mcc/profiles/<name>/.key`，元数据存 `~/.mcc/profiles.json`
- **实例隔离**：每个 profile 独立 `CLAUDE_CONFIG_DIR`，位于 `~/.mcc/instances/<name>/`
- **OpenAI 兼容模式**：`--protocol openai` 时自动启动本地翻译 proxy（端口 43456-43555），转发 OpenAI 格式请求到 upstream Anthropic 兼容端点
- **思考模式**：profile 支持 `reasoningEffort`，默认开启思考；强度以 Claude Code 自身的 `/effort`/Tab 为准并自动映射到各 provider，`reasoningEffort` 仅作兜底默认
- **Tiered model**：profile 支持 `opusModel`/`sonnetModel`/`haikuModel` 三级模型切换
- **内置 MCP**：`mcc-websearch`（多源搜索）和 `mcc-image-analysis`（图片/PDF 分析）
- **外部 MCP**：通过 `mcc mcp add` 注册第三方 MCP server，支持 `${MCC_PROVIDER_KEY:<providerId>}` 引用 provider API key
- **Dashboard**：`mcc config` 打开 Web 配置控制台（http://localhost:3000）

## 添加一个 profile

```bash
# Anthropic 直接 API 模式
mcc profile add prod --base-url https://api.deepseek.com/anthropic --api-key sk-xxxx --model deepseek-chat

# OpenAI 兼容模式（需要翻译 proxy）
mcc profile add minimax --base-url https://api.minimax.com --api-key sk-xxxx --model MiniMax-Text-01 --protocol openai

# 带 tiered model
mcc profile add big --base-url https://api.anthropic.com --api-key sk-xxxx --model claude-sonnet-4-6 --opus-model claude-opus-4-7 --sonnet-model claude-sonnet-4-6 --haiku-model claude-haiku-4-5
```

## 添加外部 MCP

```bash
mcc mcp add minimax-plan \
  --display-name "MiniMax Token Plan" \
  --command uvx \
  --args "minimax-coding-plan-mcp,-y" \
  --provider-ref minimax

# 在指定 profile 启用
mcc mcp enable minimax-plan minimax
```

## 目录结构

```
src/
├── mcc.ts                      # CLI 入口（参数解析 + dispatcher，~150 行）
├── commands/                   # 每个 mcc 子命令一个文件
│   ├── launch.ts               #   mcc <profile>
│   ├── profile.ts              #   mcc profile add|list|remove|default
│   └── mcp.ts                  #   mcc mcp list|add|remove|enable|disable
├── accounts/
│   ├── store.ts                # Profile 元数据
│   ├── instance-manager.ts     # CLAUDE_CONFIG_DIR 隔离
│   └── shared-manager.ts       # 跨 instance 共享目录
├── core/model-router.ts        # Profile env 构建
├── mcp/
│   ├── registry.ts             # 内置 MCP 注册表
│   ├── installer.ts            # MCP 安装到 instance
│   ├── external-registry.ts    # 外部 MCP 注册表
│   └── mcp-config.ts           # provider 配置
├── proxy/                      # OpenAI→Anthropic 翻译 proxy
├── dashboard/server.ts         # Express dashboard server（mcc config 启）
├── shared/
│   ├── logger.ts               # thin shell → lib/shared/logger.cjs
│   └── provider-preset-catalog.ts
└── update.ts                   # mcc update / mcc update-check

ui/src/                         # Dashboard 前端（React + Vite）
├── App.tsx                     # 编排骨架（~330 行）
├── types/domain.ts             # 领域类型（Protocol、ProfileFormPayload 等）
├── lib/
│   ├── api.ts                  # 后端 API client + 边界类型
│   ├── providers.ts            # 17 个 provider 单一真相源（id+name+品牌色）
│   └── strings.ts              # 所有 UI 中文文案集中
├── hooks/                      # 按域分离的状态 hook
│   ├── useProfiles.ts
│   ├── useMcpConfig.ts
│   └── useStatus.ts
├── design/
│   ├── tokens/                 # primitive → semantic → components 三层
│   └── icons/                  # Ui / ProviderIcon / ArcadeLogo
└── components/                 # 业务面板组件

lib/
├── mcp/                        # 内置 MCP server CJS（被复制到 ~/.mcc/mcp/）
│   ├── mcc-websearch-server.cjs
│   └── mcc-image-analysis-server.cjs
├── mcp-hooks/                  # MCP runtime hooks（复制到 ~/.mcc/mcp-hooks/）
│   ├── image-analysis-runtime.cjs
│   ├── image-analyzer-transformer.cjs
│   └── websearch-transformer.cjs
└── shared/logger.cjs           # logger 单一真相源（src/shared/logger.ts 是它的 TS shell）
```

## 存储结构

```
~/.mcc/
├── profiles.json
├── profiles/<name>/.key
├── instances/<name>/
│   ├── .claude.json           # Claude Code 读取的 MCP 配置
│   └── .mcp/mcpServers.json
├── mcp/
├── mcp-hooks/
├── external-mcp-servers.json  # 外部 MCP 定义
├── mcp-config.json            # WebSearch/ImageAnalysis 配置
└── proxy/                     # proxy PID/session
```

## MCP 工具配置

通过 `~/.mcc/mcp-config.json` 配置，或通过 Dashboard UI。

WebSearch provider：duckduckgo（默认免 key）、博查 Bocha、阿里通义 web_search、MiniMax Search、exa、tavily、brave

ImageAnalysis provider：ali（qwen3-vl）、xiaomi（mimo-v2-omni）、minimax、deepseek（V4 起原生 vision）、kimi

## 本地开发

所有 dev 命令都通过 `pnpm <script>` 调，**跟全局 `mcc <cmd>` 心智模型一致，但跑的是本地代码**。

### 一键全栈 dev（日常推荐）

```bash
pnpm dev
```

`concurrently` 同时启两个 server，输出按颜色前缀混合显示：
- `[be]` 后端 API on `:3000`（`tsx watch` — 改 `src/` 自动重启）
- `[fe]` 前端 vite on `:5173`（HMR — 改 `ui/src/` 浏览器立即热更新）

**浏览器开 http://localhost:5173**（vite 自动把 `/api/*` proxy 到 :3000）。Ctrl-C 一次两个进程一起退。

### 用本地版 mcc 测命令

```bash
pnpm mcc deepseek            # 启 deepseek profile（跟全局 mcc deepseek 等价）
pnpm mcc profile list        # 列 profile
pnpm mcc config              # 打开配置面板（dynamic import，无需先 build）
pnpm mcc mcp list            # 任意子命令都能透传
```

**带横线的 flag 直接传，无需 `--` 分隔**（这是 pnpm 比 npm 省心的地方）：

```bash
pnpm mcc -v                            # ✓ 看版本
pnpm mcc -h                            # ✓ 看帮助
pnpm mcc deepseek --print "hello"     # ✓ 透传 --print 给 Claude Code
```

### 单独启前/后端

```bash
pnpm dash       # 只起后端（tsx watch src/dashboard/server.ts），监听 :3000
pnpm ui         # 只起前端（cd ui && vite），监听 :5173
```

适合：只改一端时省一个进程；或者你已经在 tmux/iTerm 里 split pane 习惯了，不想要 concurrently 的混合输出。

### 模拟 prod（最终用户体验）

```bash
pnpm dashboard
```

完整 `build` 后端 + `build:ui` 前端，再启 `dist/dashboard/server.js`。**一个 server**（:3000）同时提供 API 和 serve 前端静态文件 —— 跟 `mcc config` 全局版本走同一条路径。改了代码要重跑这条命令才生效。

### Typecheck

```bash
pnpm typecheck                   # 后端 tsc --noEmit
pnpm -C ui exec tsc --noEmit     # 前端（`pnpm build:ui` 里也会跑）
```

### 让全局 `mcc` 指向本地代码

全局装的 `mcc` 来自 npm registry，不会跑你本地的修改。要让 `mcc config` 也指向本地代码：

```bash
pnpm link --global                                # 把本地版 link 到全局
mcc config                                        # 现在跑的是本地代码
mcc -v

# 用完恢复 npm registry 版本：
pnpm uninstall -g @hileeon/mcc && npm i -g @hileeon/mcc
```

### 所有 scripts 一览

| Script | 干啥 | 何时用 |
|---|---|---|
| `pnpm mcc <args>` | `tsx src/mcc.ts <args>` — 透传 | 测任何 CLI 命令 |
| `pnpm dev` | `concurrently` 起 dash + ui | 日常 dev |
| `pnpm dash` | `tsx watch src/dashboard/server.ts` | 只起后端 |
| `pnpm ui` | `pnpm -C ui dev` | 只起前端 |
| `pnpm dashboard` | 完整 build + 启 `dist/` | 模拟 prod |
| `pnpm build` | tsc 编译后端 → `dist/` | 发布前 / link 前必跑 |
| `pnpm build:ui` | vite build 前端 → `dist/ui/` | 同上 |
| `pnpm build:all` | build + build:ui | 同上 |
| `pnpm build:watch` | tsc --watch | 不用 tsx 时的旧 watch 方式 |
| `pnpm typecheck` | tsc --noEmit | CI / 提交前 |
