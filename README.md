<div align="center">

# CCS - Claude Code Switch

![CCS Logo](assets/ccs-logo-medium.png)

### Claude Code 及兼容 CLI 的多 Provider Profile 和运行时管理器

运行 Claude、Codex、Droid 路由 Profile、GLM、本地模型和 Anthropic 兼容 API，无需频繁更换配置。

[![License](https://img.shields.io/badge/license-MIT-C15F3C?style=for-the-badge)](LICENSE)
[![npm](https://img.shields.io/npm/v/@kaitranntt/ccs?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@kaitranntt/ccs)
[![PoweredBy](https://img.shields.io/badge/PoweredBy-ClaudeKit-C15F3C?style=for-the-badge)](https://claudekit.cc?ref=HMNKXOHN)

**[网站](https://ccs.kaitran.ca)** |
**[文档](https://docs.ccs.kaitran.ca)** |
**[产品导览](https://docs.ccs.kaitran.ca/getting-started/product-tour)** |
**[CLI 参考](https://docs.ccs.kaitran.ca/reference/cli-commands)**

</div>

## 为什么使用 CCS

CCS 为你提供一个稳定的统一命令入口，同时可以在以下之间切换：

- 多种运行时，如 Claude Code、Factory Droid 和 Codex CLI
- 多个 Claude 订阅和隔离的账户上下文
- OAuth Provider，如 Codex、Kiro、Claude、Qwen、Kimi 等，以及现有设置的
  传统 Copilot 兼容性
- API 和本地模型 Profile，如 GLM、Kimi、OpenRouter、Ollama、llama.cpp、
  Novita 和阿里巴巴 Coding Plan

目标很简单：不再重写配置文件，不再打断活跃会话，在几秒内切换 Provider。

## 快速开始

```bash
npm install -g @kaitranntt/ccs
ccs config
```

然后启动适合任务的运行时：

```bash
ccs
ccs codex
ccs --target droid glm
ccs glm
ccs ollama
```

## OpenAI 兼容路由

CCS 现在可以通过本地 Anthropic 兼容代理将 Claude Code 桥接到 OpenAI 兼容 Provider，
而无需原生 Anthropic 上游。

```bash
ccs api create --preset hf
ccs hf
```

需要手动管理代理？

```bash
ccs proxy start hf
eval "$(ccs proxy activate)"
```

代理还支持请求时的 `profile:model` 选择器、通过 `proxy.routing` 的场景化模型路由，
以及显式激活辅助工具，如 `ccs proxy activate --fish`。

指南：[OpenAI 兼容 Provider 路由](./docs/openai-compatible-providers.md)

### 相关项目：claude-code-router

[claude-code-router](https://github.com/musistudio/claude-code-router) 是一个优秀的
独立工具，用于将 Claude Code 请求路由到 OpenAI 兼容 Provider。CCS 本地代理和 SSE
转换工作直接借鉴了 CCR 的转换器架构。

当你需要独立路由器而不需要 CCS Profile 管理时使用 CCR。
当你需要将路由流程与 CCS Profile、运行时桥接和现有 `ccs` 命令集成时使用 CCS。

需要完整的设置路径而非简化版本？

| 需求 | 从这里开始 |
| --- | --- |
| 安装并验证 CCS | [`/getting-started/installation`](https://docs.ccs.kaitran.ca/getting-started/installation) |
| 首次成功会话 | [`/getting-started/first-session`](https://docs.ccs.kaitran.ca/getting-started/first-session) |
| 可视化导览 | [`/getting-started/product-tour`](https://docs.ccs.kaitran.ca/getting-started/product-tour) |
| Provider 选择 | [`/providers/concepts/overview`](https://docs.ccs.kaitran.ca/providers/concepts/overview) |
| 完整命令参考 | [`/reference/cli-commands`](https://docs.ccs.kaitran.ca/reference/cli-commands) |
| 故障排除 | [`/reference/troubleshooting`](https://docs.ccs.kaitran.ca/reference/troubleshooting) |

## 观看 CCS 实际运行

### 使用分析

![分析仪表板](assets/screenshots/analytics.webp)

跨 Profile 追踪使用情况、成本和会话模式。深入了解：
[仪表板分析](https://docs.ccs.kaitran.ca/features/dashboard/analytics)。

### 实时认证和健康监控

![实时认证监控](assets/screenshots/live-auth-monitor.webp)

查看认证状态、账户健康状况和 Provider 就绪情况，无需深入原始配置。深入了解：
[实时认证监控](https://docs.ccs.kaitran.ca/features/dashboard/live-auth-monitor)。

### OAuth Provider 控制中心

![CLIProxy API](assets/screenshots/cliproxyapi.webp)

从一个地方管理 OAuth 支持的 Provider、配额可视化和全代理路由。CCS 现在在 CLI 和
仪表板流程中原生支持轮询与填满优先模式，而不是将其隐藏在上游控件内部。原始
CLIProxyAPI 后端仍然是默认选项；社区维护的 CLIProxyAPIPlus 分支是 Plus 专有
Provider 的可选选项。选择 Plus 后，CCS 默认将嵌入式管理面板指向维护的
CPAMC 仪表板分支。深入了解：
[CLIProxy API](https://docs.ccs.kaitran.ca/features/proxy/cliproxy-api)。

### 托管工具和回退方案

![WebSearch 回退](assets/screenshots/websearch.webp)

CCS 可以为第三方启动配置一等本地工具，如 WebSearch 和图像分析，而不是让你
自己手动连接。浏览器自动化现在也有一等设置路径。深入了解：
[WebSearch](https://docs.ccs.kaitran.ca/features/ai/websearch) |
[浏览器自动化](./docs/browser-automation.md)。

## 文档矩阵

README 的目的是保持简洁。详细指南和参考材料由文档站点负责。

| 如果你想... | 阅读这个 |
| --- | --- |
| 了解 CCS 是什么以及各部分如何配合 | [介绍](https://docs.ccs.kaitran.ca/introduction) |
| 在新机器上干净地安装 CCS | [安装](https://docs.ccs.kaitran.ca/getting-started/installation) |
| 从安装到成功首次运行 | [你的第一个 CCS 会话](https://docs.ccs.kaitran.ca/getting-started/first-session) |
| 在设置前查看仪表板和工作流界面 | [产品导览](https://docs.ccs.kaitran.ca/getting-started/product-tour) |
| 比较 OAuth Provider、Claude 账户和 API Profile | [Provider 概览](https://docs.ccs.kaitran.ca/providers/concepts/overview) |
| 了解仪表板结构和功能页面 | [仪表板概览](https://docs.ccs.kaitran.ca/features/dashboard/overview) |
| 配置 Profile、路径和环境变量 | [配置](https://docs.ccs.kaitran.ca/getting-started/configuration) |
| 了解浏览器附加与 Codex 浏览器工具的区别 | [浏览器自动化](./docs/browser-automation.md) |
| 保持 OpenCode 与你的实时 CCS 设置同步 | [OpenCode 同步插件](https://docs.ccs.kaitran.ca/features/workflow/opencode-sync) |
| 浏览每个命令和标志 | [CLI 命令](https://docs.ccs.kaitran.ca/reference/cli-commands) |
| 从安装、认证或 Provider 故障中恢复 | [故障排除](https://docs.ccs.kaitran.ca/reference/troubleshooting) |
| 了解存储、配置和架构细节 | [参考](https://docs.ccs.kaitran.ca/reference/architecture) |

## 工作流示例

```bash
# 使用默认 Claude 进行设计
ccs "design the auth flow"

# 使用不同 Provider 实现
ccs codex "implement the user service"

# 使用更便宜的 API Profile 处理日常任务
ccs glm "clean up tests and docs"

# 需要隐私或离线访问时运行本地模型
ccs ollama "summarize these logs"
```

## 社区项目

| 项目 | 作者 | 描述 |
| --- | --- | --- |
| [opencode-ccs-sync](https://github.com/JasonLandbridge/opencode-ccs-sync) | [@JasonLandbridge](https://github.com/JasonLandbridge) | 自动将 CCS Provider 同步到 OpenCode |

## 安全贡献和报告

- 贡献指南：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 每日本地检查：`bun run format && bun run lint:fix && bun run validate`（`validate` 仅是快速路径）
- 审查或合并前的信心检查：`bun run validate:ci-parity`
- 如果 PR 检查排队超过 10 分钟，假设自托管运行器已离线，通知维护者而不是盲目重试
- 入门工作：
  [good first issue](https://github.com/kaitranntt/ccs/labels/good%20first%20issue)，
  [help wanted](https://github.com/kaitranntt/ccs/labels/help%20wanted)
- 问题：[新建问题](https://github.com/kaitranntt/ccs/issues/new/choose)
- 安全报告：[SECURITY.md](./SECURITY.md) 和
  [私人咨询表单](https://github.com/kaitranntt/ccs/security/advisories/new)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=kaitranntt/ccs&type=date&legend=top-left)](https://www.star-history.com/#kaitranntt/ccs&type=date&legend=top-left)
