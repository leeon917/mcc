# Product

## 是什么

MCC（My Cloud Code）是一个轻量级 CLI 工具，用于在多个 Claude Code 账号（不同 API Provider）之间快速切换。不走 OAuth——直接设置环境变量后 `spawn` Claude Code。

支持两种协议模式：
- **Anthropic 直接模式**：profile 的 `baseUrl` 直接对接 Anthropic 兼容 API
- **OpenAI 兼容模式**（`protocol: 'openai'`）：自动启动本地翻译 proxy，把 Claude Code 的 Anthropic 请求转换为 OpenAI chat/completions 格式，转发给 upstream provider

## 为谁做 / 解决什么问题

为需要频繁在多个 AI provider（deepseek、qwen、glm、kimi、minimax、anthropic 等）之间切换的开发者，省去每次手动改 config、改环境变量的机械劳动。

## 当前核心功能

- **多 profile 管理**：`mcc profile add/list/remove/default`，元数据存 `~/.mcc/profiles.json`，API key 存 `~/.mcc/profiles/<name>/.key`
- **一键切换**：`mcc <profile>` 设置 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_MODEL` / `CLAUDE_CONFIG_DIR` 后直接启动 Claude Code
- **实例隔离**：每个 profile 对应独立的 `CLAUDE_CONFIG_DIR`（`~/.mcc/instances/<name>/`），session 历史、MCP 配置互不干扰
- **OpenAI 兼容 + 翻译 proxy**：`protocol: 'openai'` 时自动在 `127.0.0.1:43456-43555` 范围内启动 proxy，支持所有 OpenAI-compatible provider（MiniMax 等）
- **Tiered model**：profile 支持 `opusModel`/`sonnetModel`/`haikuModel`，Claude Code 运行时根据任务级别自动选用
- **内置 MCP**：`mcc-websearch`（多源 web 搜索）和 `mcc-image-analysis`（图片/PDF 分析），自动安装到 instance 的 `.claude.json`
- **外部 MCP registry**：通过 `mcc mcp add` 注册第三方 MCP server，API key 通过 `${MCC_PROVIDER_KEY:<providerId>}` 引用 `~/.mcc/mcp-config.json` 中的配置
- **MCP provider 配置系统**：`~/.mcc/mcp-config.json` 统一管理 WebSearch（duckduckgo/exa/tavily/brave）和 ImageAnalysis（ali/kimi/minimax/deepseek）的 provider 开关和 API key
- **跨 instance 共享**：skills、commands、agents、plugins、settings.json 通过 symlink 在所有 instance 间共享（`~/.claude/` → `~/.mcc/instances/<name>/<item>`）
- **Session 日志**：每次启动生成独立 session 日志（`~/.mcc/logs/<profile>/<sessionId>/mcc.log`），自动 logrotate
- **Web Dashboard**：Express + 静态文件，提供 profile/MCP/模型配置的管理界面（`npm run dashboard`，端口 3000）

## 明确不做什么

- 不做 OAuth 登录流程（账号靠 API key）
- 不做 Codex CLI / Factory Droid 等 runtime 桥接（只支持 Claude Code）
- 不做 quota 监控 / cost tracking

## 待规划

- 多个 Claude Code 官方账号切换
