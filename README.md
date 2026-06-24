# MCC — My Cloud Code

多账号切换工具，在多个 Claude Code 账号（不同 API Provider）之间快速切换。支持直接 API 和 OpenAI 兼容模式（自动翻译 proxy）。

## 快速上手

```bash
npm install
npm run build        # tsc 编译
npm run dev -- help  # 不编译直接跑
npm run dashboard    # 启动 Web 管理界面（http://localhost:3000）
```

## 核心命令

```bash
mcc <profile> [args...]         # 用指定 profile 启动 Claude Code
mcc profile add <name>           # 添加 profile
mcc profile list                 # 查看所有 profile
mcc profile remove <name>       # 删除 profile
mcc profile default [name]      # 设默认 profile
mcc mcp list                     # 查看可用 MCP 工具
mcc mcp add --name <id> --command <cmd>  # 添加外部 MCP 工具
mcc mcp remove <name>           # 删除外部 MCP 工具
mcc mcp enable <name> <profile> # 启用外部 MCP（指定 profile）
mcc mcp disable <name> <profile> # 禁用外部 MCP
mcc dashboard                   # 打开 Web Dashboard
```

## 核心功能

- **多 profile 管理**：API key 存 `~/.mcc/profiles/<name>/.key`，元数据存 `~/.mcc/profiles.json`
- **实例隔离**：每个 profile 独立 `CLAUDE_CONFIG_DIR`，位于 `~/.mcc/instances/<name>/`
- **OpenAI 兼容模式**：`--protocol openai` 时自动启动本地翻译 proxy（端口 43456-43555），转发 OpenAI 格式请求到 upstream Anthropic 兼容端点
- **Tiered model**：profile 支持 `opusModel`/`sonnetModel`/`haikuModel` 三级模型切换
- **内置 MCP**：`mcc-websearch`（多源搜索）和 `mcc-image-analysis`（图片/PDF 分析）
- **外部 MCP**：通过 `mcc mcp add` 注册第三方 MCP server，支持 `${MCC_PROVIDER_KEY:<providerId>}` 引用 provider API key
- **Dashboard**：`npm run dashboard` 启动 Express 管理界面（http://localhost:3000）

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
├── mcc.ts                      # CLI 入口
├── accounts/
│   ├── store.ts                # Profile 元数据
│   ├── instance-manager.ts     # CLAUDE_CONFIG_DIR 隔离
│   └── shared-manager.ts       # 跨 instance 共享目录
├── core/model-router.ts        # Profile env 构建
├── mcp/
│   ├── registry.ts             # 内置 MCP 注册表
│   ├── installer.ts            # MCP 安装到 instance
│   ├── external-registry.ts   # 外部 MCP 注册表
│   └── mcp-config.ts           # provider 配置
├── proxy/                      # OpenAI→Anthropic 翻译 proxy
├── dashboard-server.ts         # Express Dashboard
└── shared/logger.ts            # 日志系统

lib/
├── mcp/                        # 内置 MCP server JS
├── mcp-hooks/                  # MCP runtime hooks
│   ├── logger.cjs
│   ├── image-analysis-runtime.cjs
│   ├── image-analyzer-transformer.cjs
│   └── websearch-transformer.cjs
└── shared/logger.cjs
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

## 开发

```bash
npm install
npm run build        # tsc
npm run dev -- help  # 直接跑 dist/
npm run build:ui     # 构建 React Dashboard
npm run dashboard    # 编译 + 启动 Dashboard
```
