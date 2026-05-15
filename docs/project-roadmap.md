# CCS 项目路线图

最后更新：2026-05-09

前瞻性路线图，记录当前优先级、GitHub issues 和未来功能计划。

---

## 已完成模块化总结

所有主要模块化工作已完成。代码库从单体文件演变为结构良好的模块化架构。

| 阶段 | 描述 | 关键结果 |
|-------|-------------|------------|
| 1 | 类型系统 | `src/types/` 与 barrel exports |
| 2 | CLI 命令 | `src/commands/`（提取了 8 个处理器） |
| 3 | CLIProxy | `src/cliproxy/` 与 auth/、binary/、services/ 子目录 |
| 4 | Utils/Errors | `src/utils/ui/`、`src/errors/`、`src/management/` |
| 5 | UI 组件 | 5 个巨型文件拆分为模块化目录（54+ 模块） |
| 6 | Settings 页面 | `pages/settings/`（1,781->20 个文件） |
| 7 | Analytics 页面 | `pages/analytics/`（420->8 个文件） |
| 8 | Auth Monitor | `monitoring/auth-monitor/`（465->8 个文件） |
| 9 | 测试基础设施 | 1407 测试，90% 覆盖率 |
| 10 | 远程 CLIProxy | `proxy-config-resolver.ts`、`remote-proxy-client.ts` |
| 11 | Kiro + 旧版 ghcp Providers | 通过 CLIProxyAPIPlus 的 OAuth 支持（v7.2） |
| 12 | 混合配额管理 | `quota-manager.ts`、`quota-fetcher.ts`（v7.14） |
| 13 | Docker 支持 | `docker/` 目录与 Dockerfile、Compose、entrypoint |
| 14 | 图片分析 Hook | 通过 CLIProxy transformers 的视觉代理（v7.34） |
| 15 | 第三方工具集成 | 带多格式导出的 `ccs env` 命令（v7.39） |

**已达成指标**：
- 超过 500 行的文件：12 -> 5（-58%）
- 超过 200 行的 UI 文件：28 -> 8（-71%）
- Barrel exports：5 -> 39（+680%）
- 测试覆盖率：0% -> 90%
- 总测试数：1440（6 跳过）

---

## 当前状态

### 最近修复

- **2026-05-09**：**#1199** 现有 Claude 认证账户现在在 Dashboard 中可见的 Shared Resources 控制与 History Sync 分开。Accounts 公开了用于 `shared` vs `profile-local` 的专用 Resources 操作，`/shared` 现在清单 commands、skills、agents、plugins 和 `settings.json`，没有文档的 plugin 目录显示真实的目录内容，共享设置内容可通过 localhost-gated 共享内容 API 进行只读检查。
- **2026-05-07**：**#760** Codex GPT fast 模式现在是一级 CLIProxy 模型调优后缀。CCS 接受 `gpt-5.4-fast`、`gpt-5.4-high-fast` 以及原始 env 配置、CLI 变体创建和 dashboard 模型选择器中的等效规范化形式；运行时请求现在发送带 `reasoning.effort` 和 `service_tier: "priority"` 的基本上游模型，而不是将带后缀的别名泄露给 CLIProxy 上游路由。
- **2026-05-07**：**#1103** GitHub Copilot 现在被视为弃用的兼容性桥接。Dashboard 将 Copilot 从活动的 Identity & Access 部分移至 Deprecated，快速设置不再为新 onboarding 提供 `ghcp`，CLI/help/config 副本将 Copilot 标记为已弃用，现有的 `ccs copilot` / `ghcp` 兼容性路径保持可用以供当前设置使用。
- **2026-05-07**：**#1189** 无头 settings-profile delegation 现在保留原生 Claude passthrough 参数而不使用 Claude 标志允许列表。明确的 `--channels` 值到达 Claude Code，未来的原生标志可以携带多个相邻值，格式错误的 CCS 自有标志不再吞没下一个原生标志，`--prompt=<text>` 与 `--prompt <text>` 一致地通过无头 delegation 路由。
- **2026-05-03**：**#1172** 本地 CLIProxy 配置生成现在保持 CPAMC 管理 dashboard 与后端选择对齐。`backend: original` 指向上游 dashboard，`backend: plus` 指向 CCS 维护的 CPAMC fork，`cliproxy.management_panel_repository` 让高级用户覆盖面板仓库，当预期面板源更改时重新生成陈旧的本地 CLIProxy 配置。
- **2026-04-30**：**#1153** 原生 Claude 启动现在接受通过 CCS 的会话范围的 `--effort low|medium|high|xhigh|max` 覆盖而不改变全局 Claude 设置。CCS 在生成 Claude 前验证无效或缺失的 effort 值，规范接受的 values，保持默认 headless `-p/--prompt` 启动在原生 Claude 上而不是 delegation 解析，保留 CLIProxy/Codex/Droid effort 别名。
- **2026-04-28**：**#1123** CLIProxy 配额故障转移现在对所有带 CCS 配额获取器的配额可见 OAuth providers 使用 dashboard/手动暂停机制：Antigravity、Claude、Codex、Gemini CLI 和 GitHub Copilot。当存在健康回退时，CCS 将耗尽账户 token 从活动的 `auth/` 文件夹移至 `auth-paused/`，为 dashboard 可见性标记账户暂停，持久化自动恢复的冷却时间，仍避免自动暂停最后一个可用账户。
- **2026-04-28**：**#1115** CCS 现在将上游 CLIProxy 会话亲和性作为一级本地托管设置公开。用户可以从 `ccs cliproxy routing affinity` 检查和切换本地 `session-affinity` 加上 TTL，从 `/cliproxy` dashboard 路由卡，以及通过本地 dashboard API。生成的本地 CLIProxy 配置现在持久化 `routing.session-affinity` 和 `routing.session-affinity-ttl`，help/copy 说明 CLIProxy 偏好显式会话或线程标识符而不是回退到提示历史哈希，远程会话亲和性管理保持明确不支持，直到上游管理 API 公开超过 `routing.strategy` 的内容。
- **2026-04-24**：**#1065** 本地 CLIProxy Plus 作为明确的可选后端再次可用，通过社区维护的 `kaitranntt/CLIProxyAPIPlus` fork。CCS 保持 `original` 作为默认后端，不再将保存的 `backend: plus` 配置降级到 `original`，将 Plus 发布查找更新到维护的 fork，并将 Plus 记录为 plus-only providers 的定向路径。
- **2026-04-21**：CLIProxy 配额故障转移现在在存在健康回退时将耗尽的 Claude 和 Antigravity 账户隔离出活动轮换。CCS 在启动之间持久化这些配额触发的暂停，在配置的冷却窗口后自动恢复它们，并故意避免自动暂停最后一个可用账户，因此单账户设置仍然优雅降级而不是硬锁定自己。
- **2026-04-20**：**#1051** 浏览器自动化现在对新安装和尚未携带明确浏览器设置的升级版本默认安全关闭。CCS 将 Claude Browser Attach 和 Codex Browser Tools 都更改为以 `enabled: false` 和 `policy: manual` 启动，在升级时将缺失的浏览器策略规范化回 `manual`，保留明确的现有启用，并更新状态/help/docs，以便浏览器工具永不暗示自动暴露，除非用户选择加入。
- **2026-04-19**：**#1051** 浏览器工具现在有明确的暴露策略而不是仅粗粒度启用切换。CCS 为 Claude Browser Attach 和 Codex Browser Tools 添加 `browser.<lane>.policy`（`auto` 或 `manual`），通过 `ccs browser policy`、`ccs browser enable` 和 `ccs browser disable` 公开 CLI 优先策略控制，并添加单次启动覆盖 `--browser` 和 `--no-browser`，以便用户可以强制浏览器工具开启或关闭而无需编辑保存的配置。
- **2026-04-19**：**#1049** 浏览器设置现在有真正的补救路径而不是仅状态/doctor-only 指导。CCS 添加 `ccs browser setup` 作为 Claude Browser Attach 的主要一键流程，在适当的地方将托管浏览器路径输出缩短为 home-relative 显示路径，并更新浏览器就绪指导以首先指向用户设置，同时保持浏览器 doctor 默认只读。
- **2026-04-18**：**#1038** 旧版 OpenAI 兼容 provider 写入不再在下一次 `ccs cliproxy restart` 时自毁。CCS 现在在 CLIProxy 配置重新生成期间保留 AI-provider 管理的顶级部分如 `openai-compatibility`，旧版 `openai-compat` manager 现在只重写自己的 YAML 部分而不是转储整个文件并剥离生成的版本头。回归覆盖现在证明旧版辅助工具保持生成的标题完整，OpenAI 兼容连接器在重新生成中幸免。
- **2026-04-16**：**#1030** 浏览器自动化现在是一级 CCS 表面而不是仅 env-only/运行时功能。CCS 添加 `ccs help browser`、`ccs browser status` 和 `ccs browser doctor`；用于 Claude Browser Attach 和 Codex Browser Tools 的专用 `Settings -> Browser` dashboard 选项卡；`~/.ccs/config.yaml` 中的新 `browser` 部分；用于 attach 模式 Chrome 会话的明确就绪/后续步骤消息；以及 Codex UI 指导，将托管的 `ccs_browser` 条目标记为 CCS 自有并将浏览器设置重定向远离通用 MCP 编辑器。
- **2026-04-15**：**#969** 本地 CLIProxy 引导不再依赖正常 dashboard 和运行时启动期间的实时 GitHub 可达性。CCS 现在跳过标准 CLIProxy 引导路径上的隐藏自动更新查找，当服务启动需要本地未安装的二进制时，用明确的 `ccs cliproxy install` 指导快速失败，并保持 `ccs config` 能够在受限模式下打开 dashboard 而不是在阻塞的版本下载后面停滞。
- **2026-04-15**：**#1010** 远程 dashboard 认证指导现在明确说明 Docker 边界。readonly banner、远程登录/设置卡和 dashboard-auth 文档现在告诉用户集成 Docker 部署将配置保存在运行中的 `ccs-cliproxy` 容器卷内，因此 `ccs config auth setup` 必须在那里运行而不是在外层 host shell 中运行。
- **2026-04-14**：**#991** CCS 现在自动将通过使用 OpenAI 兼容端点的 Claude 目标 settings profiles 路由通过本地 Anthropic 兼容代理，而不是将原始 Anthropic `/v1/messages` 流量直接发送到聊天补全后端。`ccs proxy` 命令现在支持带明确主机绑定、shell 感知激活辅助和更完整的本地运行时 env 契约的 `start`、`status`、`activate` 和 `stop`。代理表面现在公开 `GET /`、`/health`、`/v1/models` 和 `/v1/messages`，将路由决策记录到 CCS 结构化日志，支持 Anthropic 图片块加上请求时 `profile:model` 覆盖，并在兼容 profile 路径之上添加配置驱动的场景路由（`background`、`think`、`longContext`、`webSearch`）。覆盖现在包括请求路由、速率限制/超时/空上游失败、chunked tool-call 流和断开清理以及现有单元、集成和 e2e 套件。
- **2026-04-10**：**#765** `/providers` 现在包括用于 API Profiles 的一级 Hugging Face preset。CCS 通过带官方路由器端点 `https://router.huggingface.co/v1` 的现有 OpenAI 兼容 profile 流程公开 Hugging Face Inference Providers，简称 `hf` 默认 profile 名称，以及 dashboard 选择器和 `ccs api create --preset hf` 的 `hf` preset 别名支持。
- **2026-04-10**：**#944** 图片分析认证就绪状态在合并运行时状态依赖覆盖包含缺失的初始化器值时不再崩溃为原生 Read。CCS 现在在覆盖条目为 `undefined` 时保留默认依赖函数，仍在本地就绪路径中直接读取基于 token 的认证状态，并包括回归覆盖用于之前表面为 `deps.initializeAccounts is not a function` 的缺失初始化器情况。
- **2026-04-10**：**#945** CCS 现在围绕明确的 `free / pro / ultra / unknown` 模型规范化和保留原始层级 id 如 `g1-pro-tier` 的 Gemini CLI 和 Antigravity 层级信号，用提供者权利证据丰富 Gemini 配额响应，分别分类 `MODEL_CAPACITY_EXHAUSTED` 与认证/权利失败，修复 Antigravity CLI 配额表以便实时配额派生的层级不再回退到陈旧的 `unknown`，将 Gemini 层级 id 添加到 CLI 配额输出，将 Gemini Flash Lite 分组扩展到覆盖 `gemini-3.1-flash-lite-preview`，并允许 Gemini 账户表面呈现与 Antigravity 相同的层级徽章语义。
- **2026-04-09**：**#938** Cliproxy 模型路由现在为重叠的 OAuth 后端公开后端固定短前缀。CCS 修复 Gemini CLI（`gcli`）和 Antigravity（`agy`）的托管 OAuth auth 文件前缀，用显示未前缀模型是否安全、阴影或仅前缀的路由提示丰富 `/api/cliproxy/catalog`，升级 `ccs cliproxy catalog` 加上交互式变体模型选择器以公开固定名称，并更新 `ccs config` Cliproxy 模型选择 UI，以便用户可以在保存设置之前看到首选调用名称和当前有效后端。
- **2026-04-08**：**#931** `/cliproxy` 模型选择器现在从 CLIProxy 管理模型定义获取其 provider 目录，而不是将 UI 目录文件作为下拉源的真实来源。CCS 现在通过 `/api/cliproxy/catalog` 刷新 Gemini、Codex、Claude、Antigravity、Qwen、iFlow、Kiro、GitHub Copilot 和 Kimi 的实时模型定义，在那些上游模型之上叠加 CCS 专用 preset/默认元数据，保持 `/api/cliproxy/models` 作为实时可用性 feed，并在代理不可用时回退到缓存/静态目录，以便 dashboard 永远不会空白。
- **2026-04-08**：**#929** 图片分析硬化现在使托管 `ccs-image-analysis` MCP 路径在健康的 Claude 目标启动上成为权威，抑制陈旧的 CCS 管理的图片 `Read` hooks 而不是让它们与 MCP 竞争，仅在 MCP 配置失败时保留旧版 hook 作为兼容性回退，并将自愈扩展到 dashboard 配置加上 `ccs doctor --fix`，以便陈旧 hook 文件和缺失的隔离 MCP 同步自动修复。
- **2026-04-07**：CLIProxy 路由策略现在是一级 CCS 表面。用户可以从 `ccs cliproxy routing` 检查和明确更改 `round-robin` vs `fill-first`，并从原生 `/cliproxy` dashboard 卡。本地模式现在将选定的启动默认值持久化到 CCS 管理的 CLIProxy 配置生成，而未触及的安装保持在 `round-robin`。CCS 有意不从账户组合推断策略。
- **2026-04-07**：**#926** CCS 现在拥有一级结构化日志层在 `src/services/logging/` 下，`~/.ccs/config.yaml` 中的有界顶级 `logging` 配置部分，用于 `~/.ccs/logs/` 下 CCS 自有日志的自动轮换/保留，原生 `/api/logs` dashboard 端点，dashboard 后端的请求跟踪，以及用于浏览最近条目和编辑保留设置的专用 `System -> Logs` dashboard 路由。旧版 CLIProxy 错误文件仍然可用作为标记的旧版来源，而不是作为主要日志模型。
- **2026-04-06**：dashboard 登录表面现在区分真实登录和主机设置要求。远程/IP 访问者在 dashboard 认证禁用或不完整时不再看到误导性的空白凭证表单；他们现在得到明确指导，说明 CCS 没有默认凭证，应该在主机上用 `ccs config auth setup` 启用，或者在同一台机器上使用时通过 localhost 重新打开。密码字段现在包含显示/隐藏切换，页面在登录前公开明确的浅色/深色主题切换。
- **2026-04-04**：GitHub README 从文本墙参考转储减少为更短的转换表面，保持 hero、proof 截图和快速启动命令，同时将更深入的安装、provider、功能和 CLI 参考内容委托给 `docs.ccs.kaitran.ca`。文档站点现在包括专用的 `Product Tour` 页面用于截图引导的演练。
- **2026-04-05**：**#912 #913 #914** Kiro 认证现在与当前 CLIProxyAPIPlus 契约对齐。CCS 为默认 `ccs kiro --auth` 流程自动选择 Builder ID 路径，而不是在上游 Builder ID vs IDC 选择器上停滞，基于回调的 Kiro 认证方法可以通过将粘贴的重定向 URL 重放到本地回调服务器来使用 `--paste-callback`，CLI 现在支持通过 `--kiro-auth-method idc` 以及 `--kiro-idc-start-url`、`--kiro-idc-region` 和 `--kiro-idc-flow` 的 IDC 认证。
- **2026-04-03**：CCS CLI help 和完成 UX 已刷新。Root help 现在更短且面向任务，`ccs help <topic|command>` 路由到主题感知帮助，shell 完成现在委托给隐藏的 `ccs __complete` 后端。
- **2026-04-02**：第三方图片和 PDF 分析现在遵循与 WebSearch相同的一级本地工具模型。CCS 将 `ccs-image-analysis` 配置为托管 MCP 工具，将请求直接路由到 provider 范围的 CCS 端点如 `/api/provider/agy/v1/messages`，在 `~/.ccs/prompts/image-analysis/` 下保持可编辑的提示模板，并将旧版 `Read` hook 降级为尽力兼容性回退。启动现在保持非致命并在托管运行时无法准备时回退到原生 `Read`。
- **2026-04-01**：`Compatible -> Codex CLI` dashboard 现在公开手动 long-context 控制用于 `model_context_window` 和 `model_auto_compact_token_limit`。CCS 直接读取和修补那些上游 Codex 配置 key，添加官方指导说明 GPT-5.4 长上下文是实验性的和可选的，并保持行为手动唯一，因此 dashboard 永远不会为用户自动填充或自动保存长上下文值。
- **2026-03-30**：**#862** 第三方 WebSearch 现在使用一级 CCS 托管 MCP 工具路径而不是依赖被拒绝的原生 Anthropic `WebSearch` 调用作为正常 UX。CCS 将 `ccs-websearch` 配置到 `~/.claude.json`，在需要时同步到隔离账户配置，在第三方启动上抑制原生 `WebSearch`，保留 provider 顺序 `Exa -> Tavily -> Brave -> DuckDuckGo -> 旧版 CLI 回退`，并保持旧版 hook 运行时仅作为共享 provider 管道和兼容性回退。卸载清理现在还移除托管 WebSearch MCP 运行时。
- **2026-03-28**：**#773** CCS 现在提供专用的 `Compatible -> Codex CLI` dashboard 路由与真正的分屏控制中心。该页面检测本地 Codex 二进制，保持 overview/docs 指导，并添加用于用户拥有的 `~/.codex/config.toml` 层的引导编辑器：顶级运行时默认值、项目信任、profiles、模型 providers、MCP servers 和支持的 feature flags。结构化保存有意地规范化和删除注释，因此原始编辑器仍然是保真度逃生通道。后续修复添加了即时原始快照刷新、刷新/丢弃恢复过期原始草稿、脏原始编辑器保护结构化控制、项目信任路径验证、不可读配置文件的只读处理、不支持的上游值的保留如细粒度 `approval_policy`，以及功能重置为默认值支持。CCS 仍警告瞬态运行时覆盖如 `codex -c key=value` 和 `CCS_CODEX_API_KEY` 可能改变有效行为而不持久化到文件。
- **2026-03-27**：WebSearch dashboard 卡片现在内联管理 Exa、Tavily 和 Brave API keys，而不是依赖单独的手动 env 步骤。CCS 通过 `global_env` 存储那些 secrets，在 `/api/websearch` 中反映掩码 key 状态，并在 WebSearch 状态流程中将 dashboard 管理的 keys 计为就绪。
- **2026-03-27**：**#812** CCS 现在包含一级 `ccs docker` 命令套件用于自托管集成 Dashboard + CLIProxy 堆栈。CLI 可以本地或通过 SSH 到远程 `--host` 暂存捆绑的 Docker 资产，报告 compose/supervisor 状态，流式传输 CCS 或 CLIProxy 日志，并在不依赖临时部署脚本的情况下运行容器内更新流程。
- **2026-03-24**：官方 Claude Channels 现在遵循 Anthropic 的实际运行时契约。CCS 阻止自动启用，除非 Bun 可用、Claude Code 验证为 v2.1.80+ 且 `claude.ai` 认证已验证；将 `--allow-dangerously-skip-permissions` 视为明确覆盖；将 Telegram/Discord bot tokens 保存在 Claude 共享的 `~/.claude/channels/` 状态（或官方 `*_STATE_DIR` 覆盖）中；并在 dashboard/CLI 状态流程中升级 Bun/版本/认证/状态范围指导、保存失败时更安全的 token 草稿保留以及非 macOS iMessage 切换（已选时可以关闭）中。
- **2026-03-23**：不暴露可靠 email 的 CLIProxy providers 不再在首次认证时需要用户提供的昵称。CCS 现在为 Kiro/Copilot 样式流程派生稳定的内部账户标识符，保留后续重命名支持，围绕该标识符硬化账户发现/注册表同步，并更新 AI Provider CRUD 以使用稳定的条目 ID 而不是 dashboard 列表索引。
- **2026-03-23**：敏感 dashboard 管理路由现在在 dashboard 认证禁用时失败关闭到 localhost 仅限访问。远程访问在 `ccs config auth setup` 后仍然可用，但 AI Provider 管理、CLIProxy 认证/状态辅助和其他写能力设置端点不再信任未经认证的非回环请求。
- **2026-03-19**：**#649** CCS 将 CLIProxy provider-key 创作拆分到专用 `CLIProxy -> AI Providers` dashboard 路由。`/cliproxy` 现在保持专注于 OAuth 账户和变体，`/cliproxy/ai-providers` 拥有 Gemini/Codex/Claude/Vertex/OpenAI 兼容 key 管理，`/providers` 保留用于 CCS 原生 API Profiles。
- **2026-03-18**：**#755** 市场刷新不再跨隔离实例重用一个共享的 `known_marketplaces.json`。CCS 现在保持市场 payload 目录共享，同时调和 per-instance 市场元数据，以便 Claude Code 验证对于交替或并发 profiles 成功，包括 Windows 复制回退。
- **2026-03-17**：弃用面向用户的 GLMT 发现在 CLI help、完成、presets 和文档中。现有 `glmt` profiles 现在通过将旧版代理设置规范化为直接 GLM 端点的兼容性路径运行。
- **#748**：API profile 创建现在通过将高级 presets 折叠在明确切换后面来保持 provider 选择紧凑，缩小选择器卡片以便表单字段保持视觉主要，并为 `llama.cpp` 提供专用 provider logo。
- **#744**：API profile 创建现在在带滚动回退的水平轨道中保持特色 providers，将 Anthropic Direct API 移到最后，重用共享 Claude logo，并将自定义端点入口点与高级模板发现分开。
- **#724**：Codex 启动现在是免费计划安全的。CCS 默认新 Codex 会话到跨计划模型，并对不支持的仅付费模型使用运行时回退处理，而不重写保存的 dashboard 设置。
- **#737**：Cursor、Copilot 和 CLIProxy 中的 dashboard 模型选择器现在对大模型目录使用带自动聚焦和明确无结果状态的可搜索组合框。
- **#736**：`ccs config` 现在支持通过 `--host` 的明确 dashboard 绑定主机，并在有效绑定是非回环时公开远程访问警告和可达 URL。
- **#1121**：使用分析定价现在在成本派生前刷新缓存的 models.dev 元数据，保持 CCS 静态定价作为离线回退，并在 CLIProxy/原生运行时细分中携带 provider 身份，以便订阅支持的 providers 不继承付费 API 定价。

### 可维护性硬化启动

- Issue 负责人：Stream D 代表 **#542**
- 自动化清单命令：`bun run report:hardening`
- 生成的报告产物：
  - `docs/reports/hardening-inventory.json`
  - `docs/reports/hardening-inventory.md`
- 债务消除追踪器：[Hardening Debt Burndown Tracker](./hardening-debt-burndown.md)

### 剩余大文件（可接受）

**CLI**（复杂核心逻辑）：
- `model-pricing.ts`（676 行）- 数据文件
- `glmt-proxy.ts`（675 行）- 旧版内部兼容性代理
- `cliproxy-executor.ts`（666 行）- 核心执行
- `ccs.ts`（596 行）- 入口点

**UI**（外部/shadcn）：
- `components/ui/sidebar.tsx`（674 行）- shadcn 组件

---

## GitHub Issues 待办

### 关键（阻塞用户）

| Issue | 标题 | 类型 |
|-------|-------|------|
| #158 | AGY 不工作 - 缺少 API Key - 运行 /login | bug |
| #155 | Gemini/Antigravity 的无效 JSON payload 错误 | bug |
| #124 | Claude 3.5 Sonnet (Thinking) 的模型 ID 错误 | bug |

### 高优先级（功能）

| Issue | 标题 | 类型 | 状态 |
|-------|-------|------|--------|
| #142 | 使用可用 CLIProxyAPI 配置 | enhancement | **已完成**（v7.1） |
| #157 | 支持 CLIProxyAPIPlus 的 Kiro 认证 | enhancement | **已完成**（v7.2） |
| #123 | 添加更多模型 | enhancement | 进行中 |
| #114 | OpenCode Zen 免费模型 + 自动轮换 API Key | enhancement | - |

### 中优先级

| Issue | 标题 | 类型 |
|-------|-------|------|
| #137 | CCS 无法连接到 IDE，但原生 Claude 可以 | support |
| #89 | 添加 Claude Code CLI 标志 passthrough 用于 delegation | enhancement |
| #659 | Dashboard 全面的越南语 i18n | enhancement |

### 低优先级 / 问题

| Issue | 标题 | 类型 |
|-------|-------|------|
| #156 | 为 Zed IDE 配置 API | docs |
| #140 | 我们支持 ampcode 吗？ | question |
| #111 | Factory droid CLI 支持 | enhancement |
| #103 | /context 命令返回错误的上下文 | invalid |

---

## 未来路线图

### 优先级 1：多个 CLIProxyAPI 实例

同时支持连接到多个 CLIProxyAPI 服务器。

**用例**：
- 跨多个代理服务器负载均衡
- 主服务器不可用时故障转移
- 地理分布以优化延迟
- 不同 provider 组的单独代理

**建议配置**：
```yaml
cliproxy:
  instances:
    primary:
      url: http://localhost:8000
      providers: [gemini, codex]
      weight: 80
    secondary:
      url: http://192.168.1.100:8000
      providers: [agy]
      weight: 20
    failover:
      url: http://backup.example.com:8000
      priority: 2  # 仅在主/次失败时
  strategy: weighted-round-robin
```

### 优先级 2：原生 Git Worktree 支持

用于 features/issues 的可选自动 git worktree 管理。

**用例**：
- 开始 issue 时自动创建 worktree
- 特性开发的隔离
- 合并后轻松清理
- 与 GitHub issues 集成

**建议设置**：
```yaml
worktrees:
  enabled: true
  base_path: ~/.ccs/worktrees
  auto_create: true
  auto_cleanup: true
  naming: "{issue-number}-{short-title}"
```

### 优先级 3：增强模型支持

- **#123**：用新版本扩展模型目录
- **#124**：修复 Claude 3.5 Sonnet (Thinking) 模型 ID
- **#114**：OpenCode Zen 免费模型 + API key 轮换

### 优先级 4：IDE 集成

- **#137**：调试 CCS 到 IDE 连接问题
- **#156**：Zed IDE 配置文档
- **#140**：调查 ampcode 兼容性
- **#111**：Factory droid CLI 支持评估

### 优先级 5：认证增强

- **#158**：修复 AGY OAuth 流程
- **#157**：~~添加 CLIProxyAPIPlus 的 Kiro 认证支持~~ **已完成**（v7.2）
- GitHub Copilot (ghcp) Device Code 流程 **已完成**（v7.2，现已弃用兼容性）
- 混合配额管理 **已完成**（v7.14）

---

## 里程碑

| 里程碑 | 状态 | 目标 |
|-----------|--------|--------|
| 模块化（阶段 1-9） | 完成 | - |
| 远程 CLIProxy 支持（#142） | 完成 | v7.1 |
| Kiro + GitHub Copilot OAuth（#157） | 完成，Copilot 现为弃用兼容性 | v7.2 |
| 混合配额管理 | 完成 | v7.14 |
| Docker 支持（PR #345） | 完成 | v7.23 |
| 图片分析 Hook | 完成 | v7.34 |
| 第三方工具集成 | 完成 | v7.39 |
| 关键 Bug 修复（#158、#155、#124） | 计划 | Q1 2026 |
| 多个 CLIProxyAPI 实例 | 计划 | Q1 2026 |
| Git Worktree 支持 | 计划 | Q2 2026 |
| 增强模型支持 | 计划 | Q2 2026 |

---

## 成功标准

所有标准已达成：

- [x] 200 行以下的文件（除文档化例外）
- [x] 每个目录有 barrel export
- [x] 无循环依赖
- [x] TypeScript 严格模式通过
- [x] 90%+ 测试覆盖率
- [x] 清晰的领域边界
- [x] 一致的命名约定

## 历史可维护性门禁（已弃用）

本节保留作为原始 Issue `#539` 工作的历史上下文。

- 可维护性基线门禁不再属于活动 CCS 工作流的一部分。
- 当前的贡献者和 CI 门禁记录在 `CLAUDE.md`、`CONTRIBUTING.md` 和 GitHub 工作流文件中。
- 不要假设 `maintainability:baseline` 或 `maintainability:check` 存在，除非在未来后续中重新引入。

---

## 相关文档

- [Codebase Summary](./codebase-summary.md) - 当前结构
- [Code Standards](./code-standards.md) - 模式和约定
- [System Architecture](./system-architecture/index.md) - 架构图
- [Hardening Debt Burndown Tracker](./hardening-debt-burndown.md) - 旧版 shim + 同步-fs 债务跟踪
- [CLAUDE.md](../CLAUDE.md) - AI 开发指导
