# 图片分析配置指南

CCS 为没有可靠原生视觉支持的第三方 Claude 启动提供一级图片和 PDF 分析。

## 图片分析如何工作

原生 Claude 账户保持 Anthropic 自己的视觉流程。

第三方 profiles 现在在运行时可用时使用名为 `ImageAnalysis` 的 CCS 管理本地 MCP 工具。CCS 还附加了一个简短的引导提示，让 Claude 优选该工具而不是 `Read` 来处理本地图片和 PDF 文件。

健康的 Claude 目标启动会抑制旧版 CCS `Read` hook，使 MCP 保持权威。如果无法配置托管运行时，CCS 保留旧的 `Read` hook 仅作为兼容性回退（当该路径仍然可行时）。如果运行时/认证/代理就绪状态退化到该点之外，CCS 会回退到原生 `Read` 而不是使整个启动失败。

## 路由模型

ImageAnalysis 请求直接发送到 CCS 管理的 provider 路由：

```text
Claude -> ccs-image-analysis MCP -> CCS provider route -> /api/provider/<backend>/v1/messages
```

重要：
- CCS 不通过 Claude Code、另一个 CLI 或第二个模型包装器中继图片分析。
- 对于桥接支持的 settings profiles，CCS 在启动前解析后端和 provider 路径。
- CCS 避免将 profile 普通的第三方 `ANTHROPIC_BASE_URL` 或 token 泄露到图片分析，除非该 profile 明确使用 CLIProxy 桥接。

## Profile 行为

| Profile 类型 | 图片方法 |
|--------------|--------------|
| Claude `default` / `account` | 原生 Claude vision / 原生 `Read` |
| 第三方 settings / CLIProxy / Copilot | 就绪时使用 CCS 本地 `ImageAnalysis` MCP 工具 |
| MCP 配置失败但 provider 支持的分析仍然可行时的第三方 | 旧版 CCS `Read` hook 回退 |
| 运行时/认证/代理不可用时的第三方 | 原生 `Read` 回退 |

## 配置

通过 dashboard（`Settings -> Image`）或 `~/.ccs/config.yaml` 配置：

```yaml
image_analysis:
  enabled: true
  timeout: 60
  fallback_backend: agy
  provider_models:
    agy: gemini-3-1-flash-preview
    codex: gpt-5.1-codex-mini
    ghcp: claude-haiku-4.5
```

有用命令：

```bash
ccs config image-analysis
ccs config image-analysis --enable
ccs config image-analysis --disable
ccs config image-analysis --set-fallback agy
ccs config image-analysis --set-profile-backend glm agy
ccs config image-analysis --clear-profile-backend glm
```

## 提示模板

CCS 在以下位置安装可编辑的提示模板：

```text
~/.ccs/prompts/image-analysis/
```

模板：
- `default.txt`
- `screenshot.txt`
- `document.txt`

CCS 自动为类似截图的文件名选择 `screenshot`，为 PDF 选择 `document`，其他情况选择 `default`。

## 运行时环境

关键运行时 env 变量：

| 变量 | 用途 |
|----------|-------------|
| `CCS_IMAGE_ANALYSIS_SKIP` | 禁用当前启动的图片分析 |
| `CCS_IMAGE_ANALYSIS_SKIP_HOOK` | 仅抑制旧版 CCS `Read` hook，同时保持 MCP ImageAnalysis 可用 |
| `CCS_IMAGE_ANALYSIS_RUNTIME_BASE_URL` | 明确的 CCS 运行时 base URL |
| `CCS_IMAGE_ANALYSIS_RUNTIME_PATH` | Provider 路由，如 `/api/provider/agy` |
| `CCS_IMAGE_ANALYSIS_RUNTIME_API_KEY` | 明确的 CCS 运行时认证密钥 |
| `CCS_IMAGE_ANALYSIS_MODEL` | 强制使用单一图片分析模型 |
| `CCS_DEBUG` | 详细运行时日志 |

## 自愈

CCS 现在在三个地方自动修复过期的托管图片分析状态：

- 健康的 Claude 启动在启动前从活动 profile 设置中删除过期的 CCS 管理的图片 `Read` hooks。
- `Settings -> Image` 保存/配置修复托管 MCP 运行时文件，将托管 MCP 条目同步到隔离的 Claude 配置目录，并从 `~/.ccs/*.settings.json` 清理过期的 CCS 管理的图片 hooks。
- `ccs doctor --fix` 修复无效的图片分析配置，删除过期的 CCS 管理的图片 hooks，并将托管的 `ccs-image-analysis` MCP 条目重新同步到隔离配置。

## 故障排除

### Claude 仍使用 `Read`

- 确认 `ccs config image-analysis` 显示 `enabled: true`
- 检查活动 profile 是否解析为配置的后端
- 运行 `ccs doctor --fix` 修复过期的托管 hooks 或缺失的托管 MCP 同步
- 使用 `CCS_DEBUG=1` 运行以查看运行时准备详情

### ImageAnalysis 未暴露

- 验证已解析后端的 CLIProxy 认证
- 验证本地或远程 CLIProxy 目标可访问
- 检查 `~/.claude.json` 和继承的账户配置中是否有 `ccs-image-analysis`

### 我需要证明请求直接发送到 provider 路由

使用 `CCS_DEBUG=1` 运行并检查解析的运行时路径。请求目标应该是 provider 范围的，例如：

```text
/api/provider/agy/v1/messages
```
