# CCS 产品开发需求（PDR）

最后更新：2026-05-07

## 产品概述

**产品名称**：CCS (Claude Code Switch)

**标语**：Claude Code 及兼容 CLIs 的多 provider profile 和运行时管理器

**描述**：多 provider CLI/运行时管理器，实现多个 Claude 账户、OAuth/API providers 以及 Claude Code、Factory Droid 和 Codex CLI 等备用目标之间的无缝切换。包括用于配置管理的基于 React 的 dashboard，支持本地和远程 CLIProxyAPI 实例、混合配额管理以及 Telegram、Discord 和 iMessage 的官方 Claude channel 运行时设置。

**当前版本**：v7.34.x+（一级 ImageAnalysis MCP 工具、WebSearch MCP、性能改进）

---

## 问题陈述

使用 Claude Code 的开发者面临以下挑战：

1. **单一账户限制**：无法同时运行多个 Claude 订阅
2. **Provider 锁定**：被困在 Anthropic 的 API 中，无法使用替代方案
3. **无并发会话**：无法使用不同账户处理不同项目
4. **配置复杂**：手动管理环境变量和配置文件
5. **无使用分析**：缺乏跨 providers 的 token 使用和成本可见性

---

## 解决方案

CCS 提供：

1. **多账户 Claude**：通过 `CLAUDECODE_CONFIG_DIR` 实现隔离实例
2. **OAuth Providers**：零配置 Gemini、Codex、Antigravity、Kiro 以及其他活动 OAuth 集成，现有的 Copilot 兼容性已弃用
3. **AI Providers**：用于 Gemini、Codex、Claude、Vertex 和 OpenAI 兼容 API-key 系列的专用 CLIProxy dashboard
4. **API Profiles**：GLM、Kimi、OpenRouter、任何 Anthropic 兼容 API
5. **可视化 Dashboard**：用于配置管理的 React SPA
6. **自动 WebSearch**：具有第三方 providers 确定 provider 链的一级本地 WebSearch 工具
7. **自动图片分析**：具有第三方 profiles 直接 provider 路由的一级本地 ImageAnalysis 工具
8. **使用分析**：Token 跟踪、成本分析、模型细分
9. **官方 Claude Channels**：Telegram、Discord 和仅限 macOS 的 iMessage 的运行时自动启用加 dashboard token/配置流程
10. **路由策略指导**：CLI 和 dashboard 中一级 `round-robin` vs `fill-first` 控制，具有明确的可选更改和无账户猜测

---

## 目标用户

| 用户类型 | 用例 | 主要功能 |
|-----------|----------|------------------|
| 个人开发者 | 工作/个人分离 | 多账户 Claude |
| 代理/承包商 | 客户账户隔离 | Profile 切换 |
| 成本敏感开发者 | GLM 用于批量操作 | API profiles、分析 |
| 企业 | 自定义 LLM 集成 | OpenAI 兼容端点 |
| 高级用户 | 多 providers | OpenRouter 300+ 模型 |

---

## 功能需求

### FR-001：Profile 切换
- 使用 `ccs <profile>` 命令在 profiles 之间切换
- 无参数时支持默认 profile
- 传递所有 Claude CLI 参数

### FR-002：多账户 Claude
- 创建隔离的 Claude 实例
- 维护每个账户独立的会话、todolists、日志
- 跨账户共享 commands、skills、agents

### FR-003：OAuth Provider 集成
- 支持 Gemini、Codex、Antigravity、Kiro 以及弃用的 Copilot 兼容性 OAuth 流程
- 基于浏览器的认证（大多数使用 Authorization Code 流程，ghcp 兼容性使用 Device Code）
- Token 缓存和刷新

### FR-004：API Profile 管理
- 配置自定义 API 端点
- 支持 Anthropic 兼容 API
- 模型映射和配置
- OpenRouter 集成与 300+ 模型

### FR-004A：CLIProxy AI Provider 管理
- 配置 CLIProxy 管理的 Gemini、Codex、Claude、Vertex 和 OpenAI 兼容 API-key 条目
- 将 provider 创作与 CCS API Profile 创建分开
- 在可用时支持本地配置编辑和远程 CLIProxy 管理 parity

### FR-005：Dashboard UI
- 可视化 profile 管理
- 实时健康监控
- 带成本跟踪的使用分析
- 模块化页面架构（settings、analytics、auth-monitor）

### FR-006：健康诊断
- 验证 Claude CLI 安装
- 检查配置文件完整性
- 验证符号链接和权限

### FR-007：WebSearch 回退
- 为无法访问 Anthropic 原生工具的第三方 profiles 公开 CCS 管理的本地 WebSearch 工具
- 在第三方启动上抑制原生 `WebSearch` 并在可用时引导 Claude 使用 CCS 自有路径
- 支持 Exa、Tavily、Brave 和 DuckDuckGo 真实搜索后端
- 保持 Gemini CLI、OpenCode 和 Grok 作为可选的传统回退
- 优雅的回退链

### FR-007A：一级图片分析
- 为需要 provider 支持 vision 的第三方 profiles 公开 CCS 管理的本地 `ImageAnalysis` MCP 工具
- 在启动前解析 provider 路由并直接发送到 `/api/provider/<backend>/v1/messages`
- 使用 `default`、`screenshot` 和 `document` 分析模式的可编辑提示模板
- 在健康的 MCP 启动上抑制旧的 CCS 管理的 `Read` hook，使其不能与主要路径竞争
- 仅在 MCP 配置失败但 provider 支持的分析仍然可行时保留旧 `Read` hook 作为兼容性回退
- 通过启动时清理、dashboard 配置和 `ccs doctor --fix` 自动修复过期的 CCS 管理的图片 hooks 和缺失的隔离 MCP 同步
- 当托管运行时、认证或代理就绪状态不可用时，回退到原生 `Read` 而不是使整个启动失败

### FR-008：远程 CLIProxy 支持
- 连接到远程 CLIProxyAPI 实例
- 用于代理配置的 CLI 标志（--proxy-host、--proxy-port 等）
- 环境变量配置（CCS_PROXY_HOST 等）
- 远程不可达时回退到本地代理
- 基于协议的默认端口（443 用于 HTTPS，8317 用于 HTTP）
- 用于远程服务器配置和测试的 Dashboard UI

### FR-009：配额管理（v7.14）
- 通过 `ccs cliproxy pause/resume <account>` 暂停/恢复单个账户
- 通过 `ccs cliproxy status [account]` 检查配额状态
- 通过 `ccs cliproxy routing` 检查当前代理范围的路由策略
- 从 CLI 或 dashboard 明确切换 `round-robin` vs `fill-first`
- 保持 `round-robin` 作为默认值，直到用户明确更改
- 不要从账户数量、层级混合或暂停/默认账户状态推断路由策略
- 账户耗尽时自动故障转移
- 层级检测：free/pro/ultra/unknown
- 区分权利失败和临时容量耗尽
- 会话开始前的预检配额检查
- 带暂停/恢复切换、层级徽章和配额详情指导的 Dashboard UI

### FR-010：Docker 部署
- 带 bun 1.2.21 和 node:20-bookworm-slim 的多阶段 Dockerfile
- 带资源限制和 healthcheck 的 Docker Compose 设置
- 用于配置、凭证和 CLI 工具的持久化卷
- 预装 CLIs：claude、gemini、grok、opencode、ccs
- 端口：3000（Dashboard）、8317（CLIProxy）
- 带权限降级和使用帮助的入口脚本
- 环境变量配置支持

### FR-011：第三方工具集成
- 通过 `ccs env` 命令导出 shell 可求值的环境变量
- 支持 OpenAI、Anthropic、原始输出格式
- 从 $SHELL 自动检测 shell（bash/zsh、fish、PowerShell）
- 安全：单引号输出、key 清理、shell 特定转义
- 跨平台兼容性（macOS、Linux、Windows）

### FR-012：官方 Claude Channels
- 通过 `ccs config channels` 和 dashboard 支持 Telegram、Discord 和 iMessage 选择
- 仅对原生 Claude `default` 和 `account` 会话自动注入 `--channels`
- 将 Telegram/Discord bot tokens 存储在 Claude 自己管理的 `~/.claude/channels/<channel>/.env` 状态或官方 `*_STATE_DIR` 覆盖路径中
- 将 iMessage 视为仅限 macOS、无 token 并依赖于 Claude 端安装和 OS 权限
- 需要 Bun、Claude Code v2.1.80+ 和验证的 `claude.ai` 认证才能自动启用
- 保持 `--dangerously-skip-permissions` 可选，并且在用户已做出明确权限选择时永不添加
- 在 CLI 和 dashboard 流程中清楚显示平台/认证/版本/设置障碍
- 在保存/刷新失败时保留 dashboard token 草稿，并允许关闭已选的不支持的 iMessage，而不允许在不支持的平台上重新启用

---

## 非功能需求

### NFR-001：性能
- CLI 启动 < 100ms
- Dashboard 加载 < 2s
- 最小内存占用

### NFR-002：可靠性
- 幂等操作
- 优雅错误处理
- 尽可能自动恢复

### NFR-003：安全
- 仅本地代理绑定（127.0.0.1）
- 日志中无凭证暴露
- 安全 token 存储

### NFR-004：跨平台
- 支持 Linux、macOS、Windows
- Bash 3.2+、PowerShell 5.1+、Node.js 14+
- 跨平台行为一致

### NFR-005：可维护性
- 文件 < 200 行（有文档化例外）
- 基于领域的组织
- Barrel exports 实现干净导入
- 90%+ 测试覆盖率

---

## 技术需求

### TR-001：运行时依赖
- Node.js 14+ 或 Bun 1.0+
- Claude Code CLI 已安装
- 用于 OAuth/API 调用的互联网访问

### TR-002：可选依赖
- CLIProxyAPI 二进制（自动管理）
- 用于更高质量 WebSearch 的 Exa/Tavily/Brave API keys
- 用于传统 WebSearch 回退的 Gemini CLI
- 用于官方 Channels 自动启用的 Bun 和 Claude Code v2.1.80+ 以及 `claude.ai` 认证

### TR-003：配置
- 基于 YAML 的配置（`~/.ccs/config.yaml`）
- 每个 profile 的 JSON 设置
- 环境变量覆盖
- 官方 channel bot tokens 存储在 Claude 管理的 `~/.claude/channels/<channel>/.env`

---

## 架构约束

### AC-001：CLI 优先设计
- 所有功能可通过 CLI 访问
- Dashboard 是便利层，不是必需的
- 可脚本化和自动化

### AC-002：非侵入性
- 永不修改 `~/.claude/settings.json`
- 使用环境变量进行配置
- 仅可逆更改

### AC-003：代理模式
- 使用本地代理进行 provider 路由
- Claude CLI 与 localhost 通信
- 代理处理上游 API 调用

---

## 成功指标

| 指标 | 目标 | 当前 |
|--------|--------|---------|
| 启动时间 | < 100ms | 已达成 |
| Dashboard 加载 | < 2s | 已达成 |
| 错误率 | < 1% | 已达成 |
| 测试覆盖率 | > 90% | 90%（1440 测试，6 跳过） |
| 文件大小合规性 | 100% < 200 行 | 95% |

---

## 发布标准

### v1.0 发布（已完成）
- [x] 多账户 Claude 支持
- [x] OAuth provider 集成（Gemini、Codex、AGY）
- [x] API profile 管理
- [x] Dashboard UI
- [x] 健康诊断
- [x] WebSearch 回退
- [x] 跨平台支持

### v7.0 发布（已完成）
- [x] OpenRouter 集成与 300+ 模型
- [x] 交互式模型选择器
- [x] 动态模型发现
- [x] 层级映射（opus/sonnet/haiku）
- [x] Settings 页面模块化（20 个文件）
- [x] Analytics 页面模块化（8 个文件）
- [x] Auth monitor 模块化（8 个文件）
- [x] 综合测试基础设施（539 CLI + 99 UI 测试）

### v7.1 发布（已完成）
- [x] 远程 CLIProxy 路由支持
- [x] 远程代理的 CLI 标志（--proxy-host、--proxy-port 等）
- [x] 用于代理配置的环境变量（CCS_PROXY_*）
- [x] Dashboard 远程代理配置 UI
- [x] 带延迟显示的连接测试
- [x] 远程不可达时回退到本地
- [x] 基于协议的默认端口（HTTPS:443、HTTP:8317）

### v7.2 发布（已完成）
- [x] 通过 CLIProxyAPIPlus 支持 Kiro (AWS) OAuth provider
- [x] 通过 Device Code 流程的 GitHub Copilot (ghcp) OAuth provider（弃用的兼容性）
- [x] Kiro 的 Authorization Code 流程（端口 9876）
- [x] ghcp 的 Device Code 流程（不需要本地端口）

### v7.14 发布（已完成）
- [x] 带自动故障转移的混合配额管理
- [x] `ccs cliproxy pause/resume/status` 命令
- [x] API 层级检测（free/pro/ultra/unknown）
- [x] Dashboard 暂停/恢复切换和层级徽章
- [x] 会话开始前的预检配额检查

### v7.23 发布（已完成）
- [x] Docker 部署支持（PR #345）
- [x] 带 bun 1.2.21 的多阶段 Dockerfile
- [x] 带资源限制和 healthcheck 的 Docker Compose
- [x] 用于配置和凭证的持久化卷
- [x] 预装 AI CLI 工具（claude、gemini、grok、opencode）
- [x] 带权限降级的入口脚本

### v7.34 发布（已完成）
- [x] 用于第三方启动的一级 `ImageAnalysis` MCP 工具
- [x] 图片分析请求的直接 provider 范围路由
- [x] default / screenshot / document 流程的提示模板选择
- [x] 仅保留兼容性回退的 Hook 回退
- [x] 当托管运行时不可用时非致命的原生 `Read` 回退
- [x] `ccs config image-analysis` CLI 命令
- [x] 用于 hook 验证的 Doctor 集成
- [x] 791 行图片分析 E2E 测试套件
- [x] 性能：在配置锁中用 Atomics.wait 替换 busy-wait
- [x] 带 noRetryPatterns 的网络错误处理
- [x] 配额 429 速率限制处理改进
- [x] WebSocket maxPayload 限制（DoS 防护）

### v7.39 发布（已完成）
- [x] 用于第三方工具集成的 `ccs env` 命令（OpenCode、Cursor、Continue）
- [x] 多格式输出：openai、anthropic、raw
- [x] 多 shell 支持：bash/zsh、fish、PowerShell（自动检测）
- [x] CLIProxy profile 支持（gemini、codex、agy、qwen）
- [x] Settings profile 支持（glm、kimi、custom API）
- [x] 安全：单引号输出、key 清理、shell 特定转义
- [x] Shell 完成更新（bash、zsh、fish、PowerShell）
- [x] 34 个 env 命令单元测试

### v8.0 发布（计划 - Q1 2026）
- [ ] 多个 CLIProxyAPI 实例（负载均衡、故障转移）
- [ ] 原生 git worktree 支持
- [ ] 关键 bug 修复（#158、#155、#124）

### v9.0 发布（未来 - Q2 2026）
- [ ] 团队协作功能
- [ ] 用于 profiles 的云同步
- [ ] 插件系统
- [ ] CLI 扩展框架

---

## 依赖

### 外部服务
- Anthropic Claude API
- Google Gemini API
- GitHub Codex API
- GitHub Copilot（ghcp - 弃用的 Device Code OAuth 兼容性）
- AWS Kiro（Authorization Code OAuth）
- Z.AI GLM API
- OpenRouter API
- Moonshot Kimi API
- DeepSeek API
- Alibaba Qwen API
- Minimax API
- Azure Foundry API

### 第三方库
- Express.js（web 服务器）
- React（dashboard）
- Vite（构建工具）
- shadcn/ui（UI 组件）
- CLIProxyAPI（代理二进制）
- Vitest（测试）

---

## 风险和缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|-------------|--------|------------|
| Claude CLI API 更改 | 中 | 高 | 版本固定、兼容性层 |
| Provider API 弃用 | 低 | 高 | 回退链、多 providers |
| OAuth token 过期 | 中 | 中 | 自动刷新、清晰错误消息 |
| 二进制兼容性 | 低 | 中 | 多平台构建、回退 |

---

## 相关文档

- [Codebase Summary](./codebase-summary.md) - 技术结构
- [Code Standards](./code-standards.md) - 开发约定
- [System Architecture](./system-architecture/index.md) - 架构图
- [Project Roadmap](./project-roadmap.md) - 开发阶段和 GitHub issues
