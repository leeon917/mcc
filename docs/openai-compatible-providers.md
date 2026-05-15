# OpenAI 兼容 Provider 路由

当您的 API profile 指向 OpenAI 兼容的聊天补全端点时，CCS 可以通过本地 Anthropic 兼容代理路由 Claude Code 流量。

这适用于以下 providers：

- Hugging Face Inference Providers
- OpenRouter
- Ollama
- llama.cpp 服务器
- OpenAI 兼容的自托管网关

## 相关项目：claude-code-router

[claude-code-router](https://github.com/musistudio/claude-code-router) 是告知此 CCS 工作主要外部参考。他们的 Anthropic/OpenAI 转换器设计帮助塑造了这里的路由方法。

何时使用 CCR：

- 您需要一个不依赖 CCS profile 集成的独立路由器
- 您不需要 CCS 在请求流周围进行账户/运行时管理

何时使用 CCS：

- 您已经使用 CCS API profiles 或运行时桥接
- 您希望通过 `ccs <profile>` 和 `ccs proxy ...` 提供代理流
- 您希望路由行为在 CCS 工作流中记录和测试

## CCS 做什么

当您使用 Claude 目标启动兼容的设置 profile 时，CCS 现在：

1. 使用该 profile 的解析本地端口在 `127.0.0.1` 上启动本地代理
2. 接受来自 Claude Code 的 Anthropic `/v1/messages` 流量
3. 将请求转换为 OpenAI 聊天补全格式
4. 转发到您配置的上游 provider
5. 将流式响应转回 Anthropic SSE

您不需要每次手动重写您的 profile。

## 快速开始

创建或重用指向 OpenAI 兼容端点的 API profile：

```bash
ccs api create --preset hf
```

然后您可以直接使用该 profile：

```bash
ccs hf
```

CCS 检测到 profile 是 OpenAI 兼容的，并自动通过本地代理路由 Claude Code。

## 手动代理生命周期

如果您想显式管理代理：

```bash
ccs proxy start hf
eval "$(ccs proxy activate)"
ccs proxy status
ccs proxy stop
```

有用变体：

```bash
ccs proxy start hf --host 127.0.0.1
ccs proxy start hf --port 3460
ccs proxy activate hf
ccs proxy activate --fish
ccs proxy status hf
ccs proxy stop hf
```

端口选择优先级是：

1. CLI `--port` 用于精确的一次性固定
2. `proxy.profile_ports[profile]` 用于精确的 per-profile 固定
3. `proxy.port` 用于共享首选起始端口
4. 当没有固定时，自适应 per-profile 回退

旧版共享 `proxy.port: 3456` 值被视为未设置，因此较旧的配置进入自适应路径而不是停留在热门的旧默认值。如果您现在需要精确的 `3456` 绑定，通过 `--port` 或 `proxy.profile_ports` 固定它。

`ccs proxy activate` 现在打印完整的本地运行时契约：

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_MODEL` 加上存在时的层级默认值
- `DISABLE_TELEMETRY`
- `DISABLE_COST_WARNINGS`
- `API_TIMEOUT_MS`
- `NO_PROXY`

## 多个活动代理 Profiles

CCS 现在按 profile 存储 OpenAI 兼容代理状态，而不是将运行时视为单例。

- 不同的兼容 profiles 可以同时在独立本地端口上运行
- 当只有一个代理运行时，不带 profile 的 `ccs proxy activate` 仍然方便
- 当多个代理运行时，显式传递 profile 到 `activate`、`status` 或 `stop`
- `status` 和 `activate` 总是反映实际运行端口而不是假定的默认值

如果您想显式固定或引导端口，请在 `~/.ccs/config.yaml` 中配置它们：

```yaml
proxy:
  port: 45000
  profile_ports:
    hf: 3460
    openai: 3461
```

## 请求时路由

代理不再局限于启动 profile 的默认模型。

支持的请求时选择器：

- `profile:model`
  示例：`deepseek:deepseek-reasoner`
- `profile`
  示例：`openrouter`
- 纯模型 id
  示例：`deepseek-chat`

纯模型 id 对配置的 profile 模型槽（`model`、`opusModel`、`sonnetModel`、`haikuModel`）使用精确字符串相等性。CCS 不在这里应用模糊匹配或前缀匹配。如果没有找到精确匹配，请求保持在活动 profile 上，请求的模型 id 不变。

路由行为：

1. `profile:model` 立即获胜。
2. 场景路由可能在配置时覆盖活动 profile。
3. 纯模型 id 在回退到活动 profile 之前与配置的 OpenAI 兼容 profiles 匹配。

这意味着通过一个兼容 profile 启动的 Claude 会话仍然可以请求另一个兼容 profile/模型（当代理可以安全解析时）。

## 场景路由

现在通过 `~/.ccs/config.yaml` 中的 `proxy.routing` 支持场景路由。

示例 `~/.ccs/config.yaml`：

```yaml
proxy:
  routing:
    default: "deepseek:deepseek-chat"
    background: "ollama:qwen2.5-coder:0.5b"
    think: "deepseek:deepseek-reasoner"
    longContext: "openrouter:google/gemini-2.5-pro"
    longContextThreshold: 60000
    webSearch: "openrouter:perplexity/sonar-pro"
```

当前场景检测：

- `background`：请求的模型包含 `haiku`
- `think`：Anthropic `thinking` 已启用
- `longContext`：估计的请求 token 超过 `longContextThreshold`
- `webSearch`：工具列表包含 `web_search`
- `default`：当上述不适用时的回退选择器

路由决策通过 CCS 结构化日志记录。

`longContextThreshold` 使用基于消息字符、工具 payload 大小和 `chars / 4` 启发式的故意近似 token 估计。如果您的路由决策在边界附近需要更清晰的截止，请保守地调整阈值。

## Profile 检测如何工作

CCS 在正常 API/settings-profile 流中保持这些 profiles。

仍然直接启动的 Anthropic 兼容端点：

- `https://api.anthropic.com`
- `https://api.z.ai/api/anthropic`
- `https://api.deepseek.com/anthropic`

通过本地代理路由的 OpenAI 兼容端点：

- `https://router.huggingface.co/v1`
- `https://api.openai.com/v1`
- `http://localhost:11434`

## Provider 设置

### DeepSeek

使用其 env 如下的 settings profile：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/v1",
    "ANTHROPIC_AUTH_TOKEN": "sk-...",
    "ANTHROPIC_MODEL": "deepseek-chat",
    "CCS_DROID_PROVIDER": "generic-chat-completion-api"
  }
}
```

典型覆盖目标：

- `deepseek:deepseek-reasoner`

### OpenRouter

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://openrouter.ai/api/v1",
    "ANTHROPIC_AUTH_TOKEN": "sk-or-...",
    "ANTHROPIC_MODEL": "openai/gpt-4.1-mini",
    "CCS_DROID_PROVIDER": "generic-chat-completion-api"
  }
}
```

当您想要以下内容时有用：

- 一个 provider profile 后的模型扇出
- 长期上下文或网络搜索场景目标

### Ollama / 本地网关

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:11434",
    "ANTHROPIC_AUTH_TOKEN": "ollama",
    "ANTHROPIC_MODEL": "qwen3-coder",
    "CCS_DROID_PROVIDER": "generic-chat-completion-api"
  }
}
```

对于自签名 HTTPS 网关，添加 `CCS_OPENAI_PROXY_INSECURE=1`。

### DashScope / Qwen 兼容模式

DashScope 兼容端点即使旧设置文件仍携带过期的 Anthropic 风格 provider 提示也能工作：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
    "ANTHROPIC_AUTH_TOKEN": "sk-...",
    "ANTHROPIC_MODEL": "qwen3.6-plus",
    "CCS_DROID_PROVIDER": "anthropic"
  }
}
```

CCS 现在从 base URL 推断 OpenAI 兼容路由，不会让那个过期的 provider 提示阻止代理路由。

## 自签名 TLS

如果您的上游网关使用自签名或私人发行的证书，请在 profile 设置 JSON 中设置：

```json
{
  "env": {
    "CCS_OPENAI_PROXY_INSECURE": "1"
  }
}
```

该标志被以下两者尊重：

- `ccs <profile>` 自动路由
- `ccs proxy start <profile>`

## 支持的运行时路径

- `ccs <profile>` 使用 Claude 目标：需要时自动启动本地代理
- `ccs proxy start <profile>`：显式启动代理
- `GET /`：代理信息和绑定 profile 详情
- `GET /health`：代理存活检查
- `GET /v1/models`：配置模型映射的本地视图
- `POST /v1/messages`：Anthropic 兼容请求入口点

## 故障排除

### 缺少或无效的本地代理 token

- 重新运行 `eval "$(ccs proxy activate)"`
- 检查 `ccs proxy status` 并确认预期 profile 正在运行

### 自签名或私人 CA 上游

- 在 profile 设置中添加 `CCS_OPENAI_PROXY_INSECURE=1`
- 更改设置后重启代理

### 需要固定或验证本地端口

- 使用 `ccs proxy status hf` 检查活动绑定
- 使用 `ccs proxy start hf --port 3460` 固定一次性端口
- 使用 `proxy.profile_ports` 保留稳定的 profile 端口
- 更改端口后重新运行 `ccs proxy activate hf`

### Provider 返回 `429` 或空上游输出

- CCS 现在保留上游速率限制错误和重试头
- 空或格式错误的 provider JSON 作为 Anthropic 风格的 `api_error` 返回

### 请求路由到错误的模型/profile

- 使用显式选择器如 `profile:model`
- 如果启用了场景路由，检查 `proxy.routing`
- 在 `~/.ccs/logs/current.jsonl` 中检查 CCS 结构化日志以获取路由决策

## 验证

随附覆盖包括：

- OpenAI 兼容 profile 检测的单元测试
- Anthropic -> OpenAI 请求转换的单元测试
- 请求时 profile/model 路由和场景路由的单元测试
- 多行 SSE 解析的单元测试
- `/v1/messages` 请求/响应转换的集成测试
- 速率限制、空上游响应、超时处理、thinking/tool-call chunk 流和请求时路由的集成测试
- daemon 生命周期和 `/health` / `/v1/models` 的集成测试
- `ccs proxy` 生命周期的 e2e 测试
- 通过模拟上游的 `ccs <profile>` 自动路由的 e2e 测试

专注验证命令：

```bash
bun test tests/e2e/proxy-command.e2e.test.ts tests/integration/proxy/request-routing.test.ts --coverage
```

预合并门禁：

```bash
bun run validate
```
