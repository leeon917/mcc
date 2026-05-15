# WebSearch 配置指南

最后更新：2026-04-11

CCS 为无法访问 Anthropic 原生 WebSearch API 的第三方 profiles 提供自动网络搜索。

## WebSearch 工作原理

### 原生 Claude 账户

原生 Claude 订阅账户仍直接使用 Anthropic 的服务端 WebSearch。

### 第三方 Profiles

第三方 profiles 无法执行 Anthropic 的服务端 WebSearch，因为该工具永远不会到达它们的后端。CCS 现在通过在托管运行时可用时配置一级本地 MCP 工具、抑制原生 `WebSearch` 用于这些启动、附加简短启动时引导提示以及直接运行真实本地搜索 providers 来处理。

## 架构

```
┌──────────────────────────────────────────────────────────────────┐
│                   Claude Code CLI                                │
│                                                                  │
│  Search Request                                                  │
│       │                                                          │
│       ├── Native Claude Account? → Anthropic WebSearch API       │
│       │                                                          │
│       └── Third-party Profile? → native WebSearch disabled       │
│                                   │                              │
│                                   ├── CCS MCP tool when ready    │
│                                   │   ccs-websearch.WebSearch    │
│                                   │             │                │
│                                   │             ├── 1. Exa       │
│                                   │             ├── 2. Tavily    │
│                                   │             ├── 3. Brave     │
│                                   │             ├── 4. SearXNG   │
│                                   │             ├── 5. DuckDuckGo│
│                                   │             └── 6. Legacy CLI│
│                                   │                    fallback  │
│                                   │                    (Gemini/  │
│                                   │                     OpenCode/│
│                                   │                     Grok)    │
│                                   └── Bash/network fallback      │
└──────────────────────────────────────────────────────────────────┘
```

## 为什么这改变了

之前的设计要求另一个模型 CLI 执行网络搜索并总结答案。后来的兼容性路径也依赖于被拒绝的原生工具 hook。两者都很脆弱：

- CLI 语法在上游更改
- 认证状态因工具而异
- 提示/工具行为在版本间漂移
- hook 形状的拒绝输出产生了尴尬的 host UX

新流程更接近 `goclaw` 模型：网络搜索被视为一级确定性能力，而不是 LLM 到 LLM 的变通方法或被拒绝的原生工具调用。

配置后，托管 MCP 工具公开为 `ccs-websearch.WebSearch`，而不是通用的 `search` 辅助工具。该命名是故意的：它为 Claude 提供了一个更直接匹配原生 `WebSearch` 概念的工具，这应该减少模型求助于临时 Bash 或 `curl` 获取的情况。

CCS 还附加了一个仅第三方的 `--append-system-prompt` 提示，告诉 Claude 对于网络查找和当前信息请求优选该托管 `WebSearch` 工具。这只是软引导：如果用户明确要求 shell 命令，或者工具不可用，Claude 仍可以回退到 Bash/网络工具。
该共享启动辅助适用于普通第三方 settings profiles、CLIProxy/Copilot 支持的 Claude 启动以及通过 settings profile 执行的 CCS 无头/delegation 运行。

`websearch.enabled: false` 禁用托管本地运行时，但 CCS 仍会在第三方 profiles 上抑制 Anthropic 的原生 `WebSearch`。该原生工具无法被 Exa、Tavily、Brave、DuckDuckGo 或其他非 Anthropic 后端满足，因此 CCS 避免发送损坏的原生工具请求，而是让 Claude 回退到正常 shell/网络工具。

## Providers

| Provider | 类型 | 设置 | 默认 | 备注 |
|----------|------|-------|---------|-------|
| Exa | HTTP API | `EXA_API_KEY` | 否 | 高质量 API 搜索与提取内容 |
| Tavily | HTTP API | `TAVILY_API_KEY` | 否 | 面向 agent 的搜索 API |
| Brave Search | HTTP API | `BRAVE_API_KEY` | 否 | 更干净的片段和元数据 |
| SearXNG | JSON API | `providers.searxng.url` | 否 | 通过 `/search?format=json` 的自托管/公共 SearXNG 后端 |
| DuckDuckGo | HTML 获取 | 无 | 是 | 内置零设置回退 |
| Gemini CLI | 旧版 CLI | `npm i -g @google/gemini-cli` | 否 | 可选兼容性回退 |
| OpenCode | 旧版 CLI | `curl -fsSL https://opencode.ai/install \| bash` | 否 | 可选兼容性回退 |
| Grok CLI | 旧版 CLI | `npm i -g @vibe-kit/grok-cli` + `GROK_API_KEY` | 否 | 可选兼容性回退 |

## 配置

### 通过 Dashboard

打开 `ccs config` → `Settings` → `WebSearch`。

- 在后端链中启用 Exa、Tavily、Brave、SearXNG 或 DuckDuckGo
- 启用 SearXNG 时配置 SearXNG 基础 URL（例如 `https://search.example.com`）
  不要包含 `/search`、嵌入式凭证、查询参数或 URL 片段。CCS 追加 `/search?format=json`。
- 直接在每个 provider 卡片内设置或轮换 Exa、Tavily 和 Brave API keys
- 保存的 keys 持久化在 `global_env` 中并在运行时注入，因此同一屏幕的就绪状态更新
- 检查配置中是否仍有任何旧版回退 CLI 启用

### 通过配置文件

编辑 `~/.ccs/config.yaml`：

```yaml
websearch:
  enabled: true
  providers:
    exa:
      enabled: false
      max_results: 5
    tavily:
      enabled: false
      max_results: 5
    brave:
      enabled: false
      max_results: 5
    searxng:
      enabled: false
      url: ""
      max_results: 5
    duckduckgo:
      enabled: true
      max_results: 5
    gemini:
      enabled: false
      model: gemini-2.5-flash
      timeout: 55
    opencode:
      enabled: false
      model: opencode/grok-code
      timeout: 90
    grok:
      enabled: false
      timeout: 55
```

注意：`enabled: false` 停止配置托管本地 `ccs-websearch.WebSearch` 运行时。它不会为第三方后端重新启用 Anthropic 的原生 `WebSearch`。

## 环境变量

| 变量 | 描述 |
|----------|-------------|
| `EXA_API_KEY` | 当 `providers.exa.enabled: true` 时启用 Exa |
| `TAVILY_API_KEY` | 当 `providers.tavily.enabled: true` 时启用 Tavily |
| `BRAVE_API_KEY` | 当 `providers.brave.enabled: true` 时启用 Brave Search |
| `CCS_WEBSEARCH_SEARXNG_URL` | 当 `providers.searxng.enabled: true` 时使用的运行时 URL |
| `CCS_WEBSEARCH_SEARXNG_MAX_RESULTS` | SearXNG 结果数的可选运行时覆盖（限制 1..10） |
| `GROK_API_KEY` | 仅旧版 Grok CLI 回退需要 |
| `CCS_WEBSEARCH_SKIP` | 禁用当前进程的 CCS 本地 WebSearch 运行时；第三方启动仍保持原生 Anthropic `WebSearch` 禁用 |
| `CCS_DEBUG` | 详细 WebSearch 运行时日志 |
| `CCS_WEBSEARCH_TRACE` | 将可选 JSONL 跟踪记录写入 `~/.ccs/logs/websearch-trace.jsonl` |
| `CCS_WEBSEARCH_TRACE_FILE` | 覆盖跟踪文件路径（必须保持在 `~/.ccs/`、系统 temp 目录或 `/var/log` 内） |

## 托管运行时文件

- `~/.claude.json` → CCS 管理 `mcpServers.ccs-websearch`
- `~/.ccs/mcp/ccs-websearch-server.cjs` → 本地 MCP 服务器二进制
- `~/.ccs/hooks/websearch-transformer.cjs` → 共享 provider 运行时加旧版兼容性回退

## 故障排除

### WebSearch 显示 "Ready (DuckDuckGo)"

这是预期的。DuckDuckGo 是默认的零设置后端。

### Exa、Tavily 或 Brave 已启用但未就绪

在 WebSearch dashboard 卡片中设置匹配的 API key，或在启动 CCS 的环境中导出，然后刷新状态：

```bash
export EXA_API_KEY="your-api-key"
# or: export TAVILY_API_KEY="your-api-key"
# or: export BRAVE_API_KEY="your-api-key"
ccs config
```

如果 dashboard 说 key 已存储但仍未就绪，检查 `Settings -> Global Env` 是否被禁用。WebSearch 重用该注入路径用于 dashboard 管理的 keys。

### SearXNG 已启用但未就绪

1. 确认配置的基础 URL 有效（例如 `https://search.example.com`）
2. 确认实例暴露 `GET /search?q=<query>&format=json`
3. 如果 hook 报告 `SearXNG returned 403: format=json is disabled on this instance`，在该 SearXNG 部署上启用 JSON 格式或切换到另一个后端

### 我仍想要 Gemini/OpenCode/Grok 回退

这些 providers 仍然支持，但它们不再是主要路径。如需将它们作为最后手段回退，请在 `config.yaml` 中明确启用它们。

### 我需要查看 CCS 是否公开了 WebSearch 或模型是否绕过了它

使用 `CCS_WEBSEARCH_TRACE=1`（或 `CCS_DEBUG=1`）运行。CCS 将 JSONL 跟踪写入 `~/.ccs/logs/websearch-trace.jsonl`，包含：

1. 来自 CCS 的源侧启动记录（`ccs_websearch_launch`）
2. MCP 暴露和调用记录（`mcp_initialize`、`mcp_tools_list`、`mcp_tool_call_*`）
3. provider 尝试和获胜者记录（`websearch_provider_attempt`、`websearch_provider_success`）
4. 会话摘要（`mcp_session_summary`，以及适用时的 headless `headless_websearch_summary`）

查询默认用指纹（`queryHash`、`queryLength`）而不是原始日志记录。对于无头/delegation 运行，`headless_websearch_summary.likelyBypassed=true` 表示 MCP 工具已暴露，但没有发生 WebSearch 调用，Claude 回退到 `Bash` 或 `WebFetch`。

### WebSearch 返回无结果

1. 检查 `websearch.enabled: true`
2. 除非您有强烈理由禁用它，否则保持 DuckDuckGo 启用
3. 如果使用 Exa、Tavily 或 Brave，验证匹配的 API key
4. 使用 `CCS_DEBUG=1` 运行以获取运行时日志，或 `CCS_WEBSEARCH_TRACE=1` 获取相关的启动/MCP/provider 跟踪
5. 如果 DuckDuckGo 返回非结果 HTML 错误，稍后重试或启用另一个 provider。CCS 现在将 provider 失败视为 provider 失败而不是假阳性空结果。

## 安全注意事项

- 从 dashboard 输入的 API keys 存储在 `~/.ccs/config.yaml` 的 `global_env` 下，并在运行时作为环境变量注入
- Shell 导出的 keys 仍然有效，并被检测为外部环境输入
- 永远不要将 API keys 提交到版本控制
- 仅在可信机器上使用 dashboard，并使用正常的用户级文件系统权限保护 `~/.ccs/config.yaml`
