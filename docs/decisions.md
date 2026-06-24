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
