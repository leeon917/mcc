# Product

## 是什么

MCC（My Cloud Code）是一个轻量级 CLI 工具，用于在多个 Claude Code 账号（不同 API Provider）之间快速切换。不走 OAuth、不启动本地 proxy——直接设置 Anthropic-compatible 环境变量后 `spawn` Claude Code。

## 为谁做 / 解决什么问题

为需要频繁在多个 AI provider（deepseek、qwen、glm、kimi、minimax、anthropic 等）之间切换的开发者，省去每次手动改 config、改环境变量的机械劳动。

## 当前核心功能

- **多账号管理**：`mcc account add/list/remove/default`，账号元数据存 `~/.mcc/accounts.json`，API key 存 `~/.mcc/accounts/<name>/.key`
- **一键切换**：`mcc use <account>` 设置 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_MODEL` / `CLAUDE_CONFIG_DIR` 后直接启动 Claude Code
- **实例隔离**：每个账号对应独立的 `CLAUDE_CONFIG_DIR`（`~/.mcc/instances/<name>/`），session 历史、MCP 配置互不干扰
- **内置 MCP**：`mcc-websearch`（多源 web 搜索）和 `mcc-image-analysis`（图片/PDF 分析），自动安装到 instance 的 `.mcp/mcpServers.json`
- **Model preset 复用**：共享 catalog（`provider-preset-catalog.ts`）定义 provider 的 base URL、default model 等，CLI 和 dashboard 同一数据源
- **Web Dashboard**：Express + 静态文件，提供账号/模型/MCP 的管理界面（`npm run dashboard`）

## 明确不做什么

- 不做 OAuth 登录流程（账号靠 API key）
- 不做本地 HTTP proxy（直接设 env 启动 claude）
- 不做 Codex CLI / Factory Droid 等 runtime 桥接（只支持 Claude Code）
- 不做 quota 监控 / cost tracking
