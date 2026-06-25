# 技术决策记录

本文件追加记录本项目的重大技术决策。新决策追加到文件末尾；历史条目不修改；如某决策被推翻，新建条目并引用被推翻的条目（例如 "Supersedes 2026-01-15 14:30:45 +08:00 的条目"）。所有条目标题必须带 24 小时制时分秒与时区，详见「时间戳规范」章节。

---

## 2026-05-14 17:37:50 +08:00: TypeScript + CommonJS + tsc，不引入 bundler

**背景**: 项目是 Node.js CLI 工具，需要编译到 JS 后通过 `node dist/mcc.js` 运行。

**选项**:
- esbuild / tsx 等快速工具：开发体验好但多一个依赖
- tsc：零额外依赖，TypeScript 自带

**选择**: `tsc` + CommonJS（`module: "commonjs"`）+ ES2020 target。`npm run build` 即 `tsc`，`npm run dev` 直接 `node dist/mcc.js`。

**代价**: 放弃了 esbuild 的 sub-second 编译速度和 ESM 生态。后续如果编译时间明显影响开发体验可重新评估。

---

## 2026-06-24 06:57:48 -07:00: Dashboard UI 采用 project-template 三层 token 架构

**背景**: 单文件 753 行 App.tsx + 扁平 shadcn HSL 变量，未来扩展和换皮肤都不顺。project-template/build.md §11.2 规定了 primitive → semantic → components 的三层 CSS token 约定，决定把 MCC Dashboard 对齐。

**选项**:
- 沿用 shadcn 扁平 HSL：改动最小，但"换品牌色"要扫一遍组件
- 引入完整设计系统（Storybook、tokens-studio）：过度工程
- 三层 token（primitive/semantic/components）+ 保留 shadcn HSL 作 Tailwind 适配层

**选择**: 第三种。三层在 `ui/src/design/tokens/` 落地，shadcn 的 HSL 变量保留在 `index.css` 作为 Tailwind 桥，新组件类（badge-*/status-*/banner-*/code-*）走 component 层 token 实现。换主题只动 semantic.css 一处。同步把 753 行 `App.tsx` 拆成 6 个组件文件（ProfileList / ProfileForm / WebSearchPanel / ImageAnalysisPanel / McpServerStatusPanel / ExternalMcpPanel）。

**代价**: 维护两套色彩契约（HSL 三元组 vs 三层 token）。短期内 shadcn 组件还是吃 Tailwind HSL，需要清楚边界："新组件用 token，shadcn 内部留 HSL"。

---

## 2026-06-24 06:57:48 -07:00: Provider preset catalog 修正与国内化

**背景**: catalog 里 `qwen` preset 的 baseUrl 是 `dashscope-intl.aliyuncs.com/apps/anthropic`，这个 endpoint 只对阿里云 Coding Plan 的 sk-sp- key 生效，普通 DashScope sk- key 调不通；`mm` 用了海外域名 `api.minimax.io`；`deepseek` 默认还是 `deepseek-chat`（V4 已发布且原生支持 vision）。同时 catalog 缺小米 MiMo 这一家。

**选项**:
- 保留旧 preset 不动，新增 `qwen-cn` / `mm-cn`：避免破坏，但实际上旧的 qwen preset 对普通 DashScope key 本就跑不通（等于死链）
- 直接修正旧 preset：覆盖更彻底

**选择**: 直接修正——
- `qwen` → `https://dashscope.aliyuncs.com/compatible-mode/v1`，OpenAI 兼容模式，`proxyChatCompletionsPath: '/chat/completions'`，默认 `qwen3-coder-plus`
- `mm` → `api.minimaxi.com`（国内域名，对 Token Plan key 兼容性更好）
- `deepseek` 默认 `deepseek-v4-pro`（V4 起原生 vision，可与 MCP image-analysis 共享 key）
- 新增 `xiaomi-mimo` preset，base `https://api.xiaomimimo.com/anthropic`，默认 `mimo-v2-pro`，alias `xiaomi` / `mimo`

同步在 `mcp-config.ts` 里给 WebSearch 加了博查 / 阿里通义 / MiniMax Search 三个国内 provider 的预置位（adapter 实现单独追踪），ImageAnalysis 补了小米一项。

**代价**: 已经按旧 qwen preset 建了 profile 的用户不会自动迁移，旧 profile 仍然死链；只影响新建。

---

## 2026-05-14 17:37:50 +08:00: KISS direct-API 路线——不做 OAuth、不做本地 proxy

**背景**: 现有工具 CCS 已经覆盖了 OAuth + local proxy + 多 runtime 的完整场景。MCC 的定位是极简替代——给只需要 API key 切换的用户一个更轻的选择。

**选项**:
- 沿用 CCS 架构（OAuth + proxy）：功能完整但复杂度高
- 纯 CLI wrapper：直接设 env 然后 spawn Claude Code

**选择**: 纯 env-based direct API。`buildDirectApiEnv()` 返回 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_MODEL`，`cmdUse()` 拼上 `CLAUDE_CONFIG_DIR` 后 `spawn('claude', ...)`。

**代价**: 不支持 OAuth provider（Codex、Kiro 等），不支持 `profile:model` 运行时路由。这些场景留给 CCS。

---

## 2026-06-24 15:27:59 +00:00: Dashboard 视觉系统重做 + Templates 模块

**背景**: Dashboard 默认 0 profile，用户首次打开不知道从哪开始；catalog 已经有 17 项 provider 模板但只通过 CLI 暴露。UI 是 shadcn 默认风格，识别度低、没有"挑一个就能跑"的入口。

**关键选择**:

1. **图标内嵌为 SVG React 组件**（`ProviderIcon` + `Ui`）而非 `/public/icons/*.svg` —— 离线可用、零网络依赖，`shape-rendering: crispEdges` 任意缩放保持像素锐利；同步从 catalog 删掉 `icon?: string` 字段（无消费方）。
2. **三层 token 保留结构、只重写值**（primitive / semantic / components）—— shadcn 的 HSL 桥继续在，MCP 面板（WebSearchPanel 等）零改动也跟上新视觉。
3. **`/api/profile-presets` 直接返回 `PROVIDER_PRESET_DEFINITIONS` 全量** —— 前端按 `featured / category` 分组即可，后端不掺合展示语义。
4. **协议判定下沉到前端 `inferProtocol(preset)`**（看 baseUrl 是否含 `/anthropic`）—— CLI 仍以用户显式 `--protocol` 为准，前端只在"装模板"这条路径上给合理默认。

**风格**: "Cupertino Arcade" —— Apple 软质感（圆角、分层阴影、留白）× 8-bit 像素（pixel logo、crispEdges、CRT 扫描线）× 6 色街机调板（tangerine / lagoon / leaf / hibiscus / sunshine / lilac，每个 provider 挑一色作为品牌色）。卡片采用 1.5px 墨边 + 4px 硬偏移阴影（System-7 / NeoBrutalist 感）。

**代价**:
- 字体走 Google Fonts CDN（Inter Tight / Plus Jakarta Sans / Silkscreen / VT323 / JetBrains Mono），离线场景回退到 `system-ui` —— 可接受，Dashboard 本就是联网工具。
- 像素 logo 是品牌的"风格化呈现"而非 1:1 复刻 —— 若后续需要法务严谨可换 official SVG，但会牺牲整体调性的统一感。

**影响范围**: 仅 Dashboard。`ui/src/**` + `src/dashboard-server.ts`（新增一个 GET 路由）+ `src/shared/provider-preset-catalog.ts`（删 `icon` 字段）。CLI、Profile 存储、MCP 注册表、proxy 全部零改动。

---

## 2026-06-24 17:58:05 +00:00: 识图 MCP 从"单 provider"改为"多 provider 自动 fallback" + 新增 mcc profile test

**背景**: `getActiveImageAnalysisProvider` 只取第一个 enabled 的识图 provider，无兜底；某 provider 402/限流就整条识图链路死。验 key 也只有 Dashboard 有，CLI 侧无自检手段。

**关键选择**:

1. **多 provider fallback 链**: model-router 把所有 enabled 识图 provider 序列化进 `MCC_IMAGE_ANALYSIS_PROVIDERS`(JSON)；runtime `analyzeWithRetry` 先走 provider 链，任一错误（402/鉴权/网络）顺次降级，旧单端点逻辑保留为 fallback（无该 env 时行为完全不变）。
2. **新增 `mcc profile test [name...] [--vision]`**：三探针——`models`(拉 /v1/models 验鉴权，第三方网关 404 算中性不算失败) / `usable`(1-token 真实请求，专抓"key 有效但余额 0"如 DeepSeek 402) / `vision`(四象限定色图验主模型能否原生识图)。直连真实 upstream，不经本地 proxy。
3. **openai 协议 profile 的识图直连**: provider 链各自带 baseUrl/key/format，不再被强制经本地翻译 proxy。

**代价**: 识图链路对 openai profile 不再复用 profile 自身 upstream，各识图 provider 需单独配 key。

**影响范围**: `src/mcp/mcp-config.ts`(新增 `getEnabledImageAnalysisProviders`) + `src/core/model-router.ts` + `lib/mcp-hooks/image-analysis-runtime.cjs` + 新增 `src/commands/profile-test.ts` / `src/shared/test-image.ts` / `scripts/test-vision.mjs`。

---

## 2026-06-24 18:09:58 +00:00: npm 发布从 NPM_TOKEN 切到 OIDC Trusted Publishing

**背景**: CI 的 Release workflow 首次启用即 publish 失败（E404）。根因是 `NPM_TOKEN` 这种长命 token 易过期、要轮换、有泄露风险，且首次配错权限难排查（npm 把无权限的 403 伪装成 404）。

**决策**: 弃用 `NPM_TOKEN` secret，改用 npm **Trusted Publishing（OIDC）**——CI 用 GitHub 的 OIDC 身份直接向 npm 证明"我是这个仓库"，零密钥、永不过期、自动带 provenance 签名。

**约束 / 代价**:

1. 要求 **Node ≥ 22.14**、**npm CLI ≥ 11.5.1**（workflow 里 Node 升到 22 + `npm install -g npm@latest`）。
2. 发布步骤**不能用 `pnpm publish`**——pnpm 11 的 OIDC 有已知 404 回归（pnpm/pnpm#11513），故 install/build 仍用 pnpm，最后 `npm publish` 走 OIDC。
3. **不能给 `actions/setup-node` 设 `registry-url`**——它会写一个带占位 token 的 `.npmrc`，npm 拿假 token 认证就不走 OIDC 了。
4. 需在 npmjs.com 的包 Settings → Trusted Publisher 注册：org `leeon917` / repo `mcc` / workflow `release.yml` / Environment 留空 / 勾 Allow npm publish，**且必须点 "Set up connection" 保存**。

详细踩坑链见 [lessons.md](lessons.md) 同日条目。

---

## 2026-06-24 18:22:19 +00:00: 思考模式以 Claude Code 为真相源 + 每 profile reasoningEffort 兜底

**背景**: 用户要求"编程用、默认开启思考、可配强度，且优先用 Claude Code 自身配置，非必要不在 MCC 里配"。各 provider 的思考参数互不兼容（Anthropic `thinking{enabled/adaptive,budget_tokens}` / OpenAI `reasoning_effort` / Qwen `enable_thinking+thinking_budget` / GLM `thinking{enabled}+reasoning_effort`），且部分模型强制要求思考（见 lessons 同日 kimi-k2.7-code 条目）。

**决策**:

1. 新增 profile 字段 `reasoningEffort`（`off|low|medium|high|max`，缺省 `high`）。它**不是**主控开关，而是"Claude Code 没给信号时的兜底默认"。

2. **Claude Code 是思考的真相源**。`model-router` 启动时按 `reasoningEffort` 同时注入两个 CC env：
   - `CLAUDE_CODE_EFFORT_LEVEL`（现代模型 adaptive 思考路径 → `output_config.effort`）
   - `MAX_THINKING_TOKENS`（老/未知模型 legacy 路径 → `thinking{type:enabled,budget_tokens}`，effort→budget: low4096/medium8192/high16384/max32768）
   两个都设，是因为 CC 对第三方未知 model id 走哪条路不确定；都铺好才能保证默认带上思考字段。`off` 时两者都不设。

3. **anthropic 直连**: 不改请求，CC 发什么 provider 收什么（deepseek 读 effort；kimi/mimo 思考常开）。

4. **openai 经 proxy**: proxy 改成 **hybrid** —— 读 CC 实际发来的信号决定 effort（`thinking.type=disabled`→off；`enabled`+`budget_tokens`→分桶；`adaptive`/无 → `output_config.effort` 否则 profile 默认），再**按上游 host 方言注入**（dashscope→`enable_thinking+thinking_budget`；bigmodel→`thinking{enabled}+reasoning_effort`，且 `tool_choice` 非 auto 一律 clamp 成 auto；generic→`reasoning_effort`，max/xhigh 降 high）。

**结果**: CC 的 `/model` 切档（早有 `ANTHROPIC_DEFAULT_*_MODEL`）+ Tab 调思考档都自动映射到各 provider；MCC 的「思考强度」选择器退化为兜底默认，平时不用碰。

**代价 / 边界**:
- 方言靠 host 字符串匹配（沿用 upstream-url.ts `/v4` 特例的先例）。
- Kimi/MiMo 思考是二元常开，强度档对它们 no-op。
- kimi-k2.7-code 这类强制思考的模型，若用户在 CC 里把思考**完全关掉**（CC 省略 thinking 字段），直连无 proxy 补字段，仍会 400 —— 固有边界，正常（思考开着）不触发。

**全部 profile 同步升到当期最高编程模型**: xiaomi=mimo-v2.5-pro / qwen=qwen3-max-2026-01-23 / deepseek=deepseek-v4-pro / kimi=kimi-k2.7-code / glm=glm-5.2 / siliconflow=DeepSeek-V4-Pro；openrouter 按用户意愿保持免费且 `reasoningEffort:off`（不注入思考）。preset catalog 同步更新。

## 2026-06-24 18:51:50 +00:00: 弃用 update-notifier，改自管原生 https 版本检查

启动时的"有新版本"提醒原用 `update-notifier`，但其后台 detached 子进程在实测中从不向 configstore 写入结果，叠加"一天只查一次 + 延迟一轮才弹"，导致刚发包后几乎永远不弹（用户从没见过更新提醒）。

改为自管方案：
- 缓存 `~/.mcc/update-cache.json`（`{lastCheck, latest}`）+ Node 原生 https 直查 `registry.npmjs.org/<pkg>/latest` 读 `.version`，无第三方依赖、无 detached 子进程。
- 启动 `checkForUpdates`：缓存已知更新 → **当次**弹（注册在 `process.on('exit')`，落在 Claude TUI 关闭后的干净 shell 提示符上）；缓存过期（>1h）→ 后台 fire-and-forget 刷新，socket `unref` 防止拖住 `mcc -v`。`mcc <profile>` 启动后 Node 挂着等 claude，fetch 有时间跑完写缓存。
- `mcc update --check` 同步路径也改用自家 `fetchLatest`（**不** unref，否则 await 期间提前 exit 0）。
- 移除 `update-notifier` 依赖，清掉 ~713 行 lockfile（boxen/chalk/configstore 等）。

`mcc update` 升级命令与 `mcc update-check on/off` 开关不变。**部署边界**：旧版本（≤0.1.9）内置的是坏掉的旧检查，本修复只在包含它的版本（≥下次发布）生效——首次需手动 `mcc update` 跨过去一次，之后才自动可靠提醒。详见 lessons 同日条目里的三个陷阱。

## 2026-06-24 18:54:48 +00:00: 外部 MCP registry 支持 http/sse + 新增 `mcc mcp import-global`

背景：`ExternalMcpServer` 原本只建模 stdio（`command`/`args`/`envVars`），无法表达 http/sse（url）类 MCP。为支持「一键把全局 `~/.claude.json` 的 MCP 同步进指定 profile」，做了两件事：

- **schema 扩展**：`ExternalMcpServer` 与 `McpServerConfig` 加可选 `type`（`stdio|http|sse`）/`url`/`headers`，stdio 字段全部转为可选；`syncInstanceMcpServers` 按 transport 分支输出（http/sse → `{type,url,headers}`，stdio → `{type,command,args,env}`）。
- **新命令** `mcc mcp import-global <profile> | --all-profiles [--only a,b] [--exclude a,b] [--include-ccs]`：读全局 `~/.claude.json` 的 `mcpServers`，默认跳过 `mcc-*` 内置与 `ccs-*`（CCS 自带，MCC 已有等价内置），写进 external registry 并在目标 profile 的 `external-mcp-enabled.json` 启用。

**关键约束**：导入必须经 registry + `external-mcp-enabled.json`，**不能**手改 instance 的 `.claude.json`——因为 `launch.ts` 每次启动都调 `syncInstanceMcpServers` 整体覆写 `mcpServers`，手改会被抹掉。registry 路径下每次 sync 都重新写回，故能跨重启存活。

**部署边界**：http MCP 的正确 emit 依赖新版 sync 代码——旧二进制（≤0.2.0）会把 http server 当 stdio 输出成 `{command:undefined}` 而坏掉；stdio server（如 mcp-ssh / js-reverse）不受影响。

## 2026-06-25 09:12:55 +00:00: Proxy 层视觉注入——让纯文字上游"看见"粘贴的图

**决策**：在 OpenAI 翻译 proxy 的 `/v1/messages` 处理链里，转发上游**之前**拦截 inline base64 `image` block，送 `mcp-config.json` 配置的视觉 provider（imageAnalysis）转成文字描述、原地替换为 `text` block，再走正常翻译转发。新增 `src/proxy/vision-injection.ts`，接进 `src/proxy/proxy-server.ts` 的 `handleMessages`。

**为什么**：内置的 `mcc-image-analysis` MCP 工具只在「文件路径 + 工具调用」时触发；用户**剪贴板粘贴**的图是 Claude Code 直接塞进请求体的 inline image block，不经过任何工具调用，**proxy 是请求路径上唯一能拦截它的点**。纯文字上游（如 glm-5.2）收到 image block 会忽略或 400。视觉注入把"文件→MCP 工具"那条已有能力补到粘贴这条路上。

**关键设计**：
- **内容 SHA-256 缓存**（上限 200 条）：CC 每轮重发完整历史，同一张图会在后续每个请求里复现——不缓存就每轮重复送审、烧钱；缓存后同图只送审一次。
- **provider fallback 链**：多 provider 按 mcp-config 顺序逐个试（沿用 `image-analysis-runtime.cjs` 的 fallback 思路）。
- **优雅降级**：全部 provider 失败时替换为占位文字「[Pasted image could not be analyzed…]」，**不阻断对话**。
- **零开销快路径**：`hasImageBlocks` 先探测，无图请求完全不读 config、不进注入逻辑。
- 视觉 provider 用自己的 key（mcp-config 里的，如 Kimi），**不**走 proxy 的上游 key。

**代价 / 边界**：
- **只覆盖 openai 协议**（走 proxy 的 profile）。anthropic 直连无 proxy，粘贴的图直送上游，纯文字上游仍无解——将来「统一本地 relay」（所有 profile 恒过中继 + 共享视觉注入中间件）才能抹平协议差异。
- **scope 仅 base64 `image`**：`document`（PDF）与 `url` image 暂不碰（PDF 同理可在 relay 抽块转文字，留作后续）。音频/视频不在此链路（Anthropic 原生也无对应 block）。
- 粘贴改前端这类视觉细节强相关的活，是「视觉模型看图转文字→编码模型据文字改码」两段接力，**编码质量被视觉模型的描述质量卡上限**（不同于 Claude 原生「同一模型看图+写码」）。
- **部署边界**：proxy 是常驻 daemon，`startProxy` 仅在 path/effort 变化时重启——升级后需重启 proxy 才加载新代码。

## 2026-06-25 09:50:31 +00:00: Proxy 增加 usage / cache 命中日志

**决策**：openai 翻译 proxy 的 `/v1/messages` 成功响应路径上，① 流式请求自动注入 `stream_options:{include_usage:true}`，让上游在流末尾回 usage chunk；② 用 `ReadableStream.tee()` 非破坏性旁路上游响应体，解析出 token 用量打一行 `USAGE` 日志（含 cache hit/miss/命中率），归一 DeepSeek（`prompt_cache_hit_tokens`/`prompt_cache_miss_tokens`）与 OpenAI 风格（`prompt_tokens_details.cached_tokens`）两种 cache 字段。新增逻辑全在 `src/proxy/proxy-server.ts`，**不动 lib/ 的 CCS 编译产物**。

**为什么**：用户 DeepSeek 月账单 ¥61.52 偏高，官网整月汇总显示 cache 命中率仅 21~35%（flash 21.2% / pro 34.6%），远低于 agentic 编码应有的 70~90%。怀疑是 proxy 把可缓存前缀打散，但**之前 proxy 完全不记 usage**，无法逐请求验证。本改动把「命中率到底多少」从猜变成可观测——且对任何 openai profile 都生效，不再依赖各家官网给不给这个数。

**关键设计**：
- **stream-parser 本就兼容** usage-only / 空 choices 的尾 chunk（[stream-parser.js:49](lib/proxy/glmt/pipeline/stream-parser.js) `if (!choice) return events`），故注入 `include_usage` 不会污染发给 Claude Code 的流。
- **tee 旁路**：一支流原样进 transformer，另一支单独解析 usage；抓取异常一律吞掉，**绝不影响客户端主链路**。tee 两支都被消费完，无背压泄漏。
- 仅 status<400 成功响应才旁路；错误响应走原 reconstruct 路径不变。

**代价 / 边界**：
- **风险**：`stream_options.include_usage` 虽是 OpenAI 标准，个别上游（GLM bigmodel / Qwen dashscope 待验证）可能对未知字段报 400。届时按 host 做白名单 gate。
- provider 不回 cache 字段时日志显示 `rate=n/a`——意味着「无前缀缓存」或「不上报」，二者从日志无法区分。
- **部署边界**：proxy 是常驻 daemon，升级后需重启 proxy（path/effort 未变不会自动重启）才加载新代码。

## 2026-06-25 09:52:50 +00:00: instance settings.json 从「软链接共享」改为「每次启动生成（全局 settings + per-profile auth env 块）」+ 全局 MCP 自动镜像

**背景**: 交互式 Claude Code 只认 `settings.json` `env` 块里的 `ANTHROPIC_AUTH_TOKEN`，纯进程 env 传入的被忽略 → TUI 强制 `/login`（根因详见 lessons 同日条目）。原先 `instances/<p>/settings.json` 软链到 `~/.claude/settings.json`，无法注入 per-profile auth，导致每个 openai profile 交互式启动都要登录。

**决策**:
1. `shared-manager` 的 `SHARED_ITEMS` **移除 settings.json**（skills/commands/agents/plugins 仍软链共享）；新增 `writeInstanceSettings(instancePath, authEnv)`：读全局 `~/.claude/settings.json` 作基底 + 叠加 `{ANTHROPIC_BASE_URL/AUTH_TOKEN/MODEL/三档 model}` 的 `env` 块，写成 instance 自己的**真文件**。`launch.ts` 在 proxy 起好后调用，**每次启动重新生成**。
2. **全局 MCP 自动镜像**: `syncInstanceMcpServers` 每次启动把全局 `~/.claude.json` 的 user-scope `mcpServers` **实时镜像**进 instance（区别于 `import-global` 的一次性落库——这是 live mirror，全局删了下次启动即消失）；跳过 `mcc-*` 内置与 `ccs-*`，mcc 管理的同名优先；开关 `mcpConfig.globalMcpSync` 默认 true。

**结果**: 各 profile 体验统一——换 model 不再各自要登录；全局 settings 仍是唯一真相源（每次启动并入）；全局加一个 MCP 自动铺到所有 profile；项目级 `.mcp.json` 本就被 claude 按 cwd 自动加载、无需 mcc 介入。

**代价 / 边界**:
- instance `settings.json` 现为生成产物——**要改配置改全局 `~/.claude/settings.json`**，别改 instance 那份（每次启动被覆盖重写）。
- auth `env` 块里的 proxy token 随 proxy 重启变化，靠每次启动重生成保持新鲜。
- 部署边界：需用含本改动的版本启动一次才生成新 settings.json；旧的软链接会被 `writeInstanceSettings` 的 `removeExisting` 替换成真文件。
