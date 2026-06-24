# 踩过的坑与学到的教训

本文件记录"代码里看不出的东西"：诡异 bug 的根因、反直觉的行为、重构中学到的教训。被修复的条目可以剪枝删除，但能长期留作警示的坑建议保留。

---

## 2026-06-24 17:14:32 +00:00: GLM proxy 报 400 error 1210——metadata 字段不兼容

**现象**：用 `bigmodel`（GLM-5.2）profile 发任意消息，立刻得到 API Error 400，错误体 `{"code":"1210","message":"API调用参数有误，请检查文档。"}`。

**根因**：Claude Code 的每个 Anthropic API 请求都带 `metadata: {user_id: "..."}` 字段。`ProxyRequestTransformer` 将这个字段透传进 OpenAI 格式的请求体；但 GLM（以及大多数 OpenAI-compat provider）不认识 `metadata`，直接拒绝请求。

**修复**：在 `src/proxy/proxy-server.ts` 的 `buildUpstreamRequest()` 里，解构时把 `metadata` 剔掉，不发给上游。

**推广**：如果未来某个 provider 又报参数错误（4xx），第一步是开 `MCC_LOG_LEVEL=debug` 看 `DEBUG [PROXY] upstream body:` 里到底发了什么字段，再对照 provider 文档逐一排查。

---

## 2026-06-24 17:14:32 +00:00: Proxy 完全没有日志，4xx 错误无从定位

**现象**：proxy 以 `stdio: 'ignore'` 的 detached 进程启动，既没有日志文件也没有 stderr 输出；出错时除了 Claude Code 界面上的原始 API 错误 body，什么上下文都没有。

**修复**：
1. 建立功能×时间两级日志分区：
   - session 日志：`~/.mcc/logs/<profile>/sessions/<sessionId>/mcc.log`（每次 `mcc launch` 独立目录）
   - proxy 日志：`~/.mcc/logs/<profile>/proxy/<YYYY-MM-DD>/mcc.log`（daemon 按天分目录）
2. proxy-daemon.ts 在 spawn detached child 时把 `MCC_LOG_SESSION_ID` / `MCC_LOG_DIR` / `MCC_CURRENT_PROFILE` 通过 env 注入
3. proxy-entry.ts 调用 `initFromEnv()` 初始化 logger
4. proxy-server.ts 每个请求记录：`→ /v1/messages model=... msgs=... stream=...`；响应成功记 `← 200 OK`；4xx/5xx buffer 响应体记完整错误：`← 400 upstream error: {...}`

**教训**：长命 daemon（proxy）和短命进程（session）生命周期不同，日志也要分开——不要把 proxy 日志放进 session 目录，否则无法在 session 结束后继续追溯 proxy 的历史请求。

**排查步骤**：遇到 API 错误时，先看 `~/.mcc/logs/<profile>/proxy/<today>/mcc.log`，ERROR 行会有完整的上游响应 body。


---

## 2026-06-24 17:33:18 +00:00: Anthropic 兼容第三方网关普遍不实现 `/v1/models`，导致测试功能全部误报失败

**现象**：Dashboard 的"测试 & 拉模型"对所有 Anthropic 协议 profile（xiaomi / deepseek / kimi）一律报失败，错误是 `HTTP 404 Not Found`（openresty / url.not_found）。看起来像 key 全错或 base url 全错。

**真相**：key 和配置都没问题。直接打这些网关的 `/v1/messages` 全部 200（deepseek 当时是 402 余额不足，也属 key 有效）。问题出在测试按钮的实现——旧逻辑用 `GET {base}/v1/models` 来"顺带验证 key"，但这些第三方 Anthropic 兼容网关**只实现了 `/v1/messages`，没有 `/v1/models` 列表接口**（只有官方 Anthropic API 才有，且是较晚才加的）。所以无论 key 对不对都 404 → 全线误报。

**修复**（`src/dashboard/server.ts` `testProviderKey` / 新增 `testAnthropicKey` / `fetchAnthropicModels`）：
1. Anthropic 协议改用 `POST /v1/messages` 的 1-token ping（即 profile 真正会用到的端点）来验证连接；
2. `/v1/models` 降级为**可选的模型列表来源**——能拉到就显示，拉不到（404）不算失败；
3. 错误按状态码区分：401/403 = key 无效、402 = key 有效但余额不足、404 = Base URL 错；
4. 测试接口与前端补传 `model`（ping 需要 model）；OpenAI 协议（qwen/bigmodel）的 `GET /models` 本来就好用，保持不变。

**教训**：给第三方 Anthropic 兼容网关做 health check / key 验证，只能依赖 `/v1/messages` 这个一定存在的端点，**不要假设官方 Anthropic API 的辅助端点（如 `/v1/models`）在第三方网关上也存在**。同理，验证 key 时优先打"实际会用到的那个端点"，而不是另选一个看似等价的接口。


---

## 2026-06-24 17:58:05 +00:00: DeepSeek V4 不支持识图（与 catalog 注释相反）；provider 是否识图必须用真图实测

**现象**：`mcp-config.ts` 注释写 "DeepSeek（V4 起原生 vision）"，据此把 deepseek 配成识图 provider。

**真相**：实测 deepseek-v4-pro 两个端点都**不识图**——anthropic `/v1/messages` 收到的图被当成 `[Unsupported Image]`（模型 thinking 里明写），openai `/v1/chat/completions` 直接 400 `unknown variant image_url, expected text`。已从识图预设/默认链中移除，并补上验证过的 `glm`(glm-4.6v) / `siliconflow`(Qwen3-VL) 预设。Kimi（kimi-k2.6 / moonshot-v1-*-vision）主模型则真能识图。

**教训**：

1. provider 是否支持 vision **必须用真图实测**，不要信文档/注释/模型名里的 "vision/omni" 字样。屡试不爽的探针：一张四象限定色图（左上红/右上绿/左下蓝/右下黄），模型答全 4 色才算真"看见"——纯文本模型会回"没看到图"或瞎编。`scripts/test-vision.mjs` 与 `mcc profile test --vision` 就是干这个的。
2. 编程向文本模型（qwen3-coder / glm-5.2 / mimo-v2-pro / deepseek-v4）一律不识图，识图得另走识图 MCP 链或换该家的 VL 模型。

**附（另一个吃时间的坑）**：长命 Dashboard 进程会与 CLI 抢 `~/.mcc/profiles.json`——浏览器侧 `DELETE /api/profiles/:name` 会删掉 CLI 刚加的 profile（特征：`profiles/<name>/` 没了但 `instances/<name>/` 还在 = `deleteProfile` 被调过，而非 `cmdProfileRemove`），`PUT /api/mcp-config` 会重写 mcp-config.json。**用 CLI 批量增改 profile 前先把 Dashboard 关掉**，否则会反复被 clobber。

---

## 2026-06-24 18:09:58 +00:00: npm OIDC Trusted Publishing 连环 4 坑

**现象**: CI Release workflow 首次跑就 publish 失败，依次踩了 4 个坑、每个错误信息都把人往错方向带，排了很久才通。

**4 个坑（按踩到的顺序）**:

1. **E404（token 无权限）**：原 `pnpm publish` 用 `secrets.NPM_TOKEN`，但该 token 没有发布权限。**npm 会把 403 伪装成 404**（`Not Found - PUT .../@hileeon%2fmcc`），看起来像"包/scope 不存在"，其实是"你没权限"。已存在的包报 publish E404，第一反应应是查 token 权限，而非包名。
2. **改走 trusted publishing 后还是 E404**：`actions/setup-node` 只要设了 `registry-url`，就会写一个 `.npmrc` 并把 `NODE_AUTH_TOKEN` 注入成占位值 `XXXXX-XXXXX-XXXXX-XXXXX`。npm 拿这个假 token 去认证 → 404，**永远走不到 OIDC**。修复：去掉 `registry-url`（OIDC 模式下根本不需要它，默认 registry 就是 npmjs.org）。
3. **ENEEDAUTH（版本不够）**：trusted publishing 要求 **npm ≥ 11.5.1 + Node ≥ 22.14**。Node 22 自带的 npm 才 10.9.8，不会发起 OIDC。修复：Node 升 22 + `npm install -g npm@latest`（实测发布时 npm 11.17）。注意 setup-node 日志里打印的 `npm: 10.9.8` 是升级前的，要在 publish 前 `npm -v` 确认真实版本。
4. **还是 ENEEDAUTH（网页没保存）**：npmjs.com 的 Trusted Publisher 表单字段填全了，但**没点 "Set up connection" 按钮**，等于没注册。判断依据：那块还显示成"可编辑表单 + Set up connection/Cancel 按钮"就是没保存；保存后会变成一条已建立的连接记录。

**最终可用配置**: workflow 无 token、Node 22、`npm install -g npm@latest`、`npm publish`（不用 pnpm publish——pnpm 11 OIDC 有 404 回归 pnpm/pnpm#11513）；npm 网页注册 org `leeon917`/repo `mcc`/workflow `release.yml`/Environment **留空**/勾 Allow npm publish 并点 Set up connection。

**通用教训**:

1. **npm 的 E404 ≠ "不存在"**，多数时候是认证/权限问题（故意混淆以防探测）。
2. OIDC 发布要彻底**清掉一切 token 痕迹**，包括 setup-node 因 `registry-url` 注入的占位 token——有任何 token 在，npm 就不走 OIDC。
3. 升 npm 后别信旧日志里的版本号，发布前 `npm -v` 实测。
4. trusted publisher 配完务必确认**已保存**（页面状态变化）而非只是填了表单。

详细决策见 [decisions.md](decisions.md) 同日条目。

---

## 2026-06-24 18:22:19 +00:00: kimi-k2.7-code 强制要求每个请求带 thinking，"无 thinking" 直接 400

**现象**: Dashboard「测试 & 拉模型」对 kimi profile 报 `HTTP 400 — invalid thinking: only type=enabled is allowed for this model`。其它 anthropic 直连 provider（deepseek/xiaomi）同样的 ping 全 200，只有 kimi 炸。

**真相**: `kimi-k2.7-code` 把思考做成**强制项**——请求里**必须**带 `thinking`，且只接受 `type:enabled` 或 `type:adaptive`；发"无 thinking 字段"或 `type:disabled` 一律 400。实测：无 thinking→400、`disabled`→400、`adaptive`→200、`enabled`→200。而测试的 ping 之前是最小化、不带 thinking 的请求，正好踩中。

**两层影响（关键）**:
1. 测试 ping 失败（表面现象）。
2. **运行时**：kimi 是 anthropic 直连（无 proxy 改写请求体），如果 Claude Code 思考处于关闭态（默认会省略 thinking 字段），**真实对话也会每次 400**——光修测试不够。

**修复**:
- 测试 ping：先不带 thinking 试；遇到 message 含 "thinking" 的 400，自动带 `thinking:{type:"adaptive"}` 重试（`src/dashboard/server.ts` `pingMessages`）。
- 运行时：`model-router` 同时注入 `CLAUDE_CODE_EFFORT_LEVEL` + `MAX_THINKING_TOKENS`，保证 CC 默认带上思考字段（adaptive 或 enabled，kimi 两者都收）。详见 decisions 同日条目。

**教训**: (1) 给第三方 Anthropic 兼容模型做连通性测试，不能假设"最小请求"通用——有的模型对 `thinking` 有强制约束，测试要能按错误信息自适应重试。(2) provider 的怪癖往往同时影响"测试"和"运行时"两条路，定位时要追问运行时是否也中招，别只修了表面的测试。

## 2026-06-24 18:51:50 +00:00: update-notifier 后台检查不可靠 & 自实现版本检查的两个陷阱

**现象**: 用户发了新包（0.2.0 已上 npm），但本地 `mcc`（装的 0.1.9）启动时从不弹"有新版本"提醒。

**真相（三个独立坑）**:
1. **`update-notifier` 的后台 detached 子进程实测不向 configstore 持久化结果** —— configstore 里只有 `lastUpdateCheck`、永远没有 `update` 字段，所以"启动自动弹"形同虚设。叠加它"一天只查一次 + 延迟一轮才弹"的设计，刚发包后几乎必然不弹。而同步 `fetchInfo()` 反而正常返回 `{latest, current, type}`——问题只在那条后台链路。
2. **npm registry 的 `/latest` 端点不接受简化元数据头** `Accept: application/vnd.npm.install-v1+json`，会返回 **406 Not Acceptable**——该头只对完整 packument（`/<pkg>`）有效。`/latest` 用默认 Accept 即可拿到含 `.version` 的 manifest。
3. **用原生 https 自查时，`await` 的路径不能 `unref` socket**：promise 挂起期间 unref'd socket 是唯一保活句柄，Node 会在 fetch 完成前以 **exit 0 静默退出**，表现为命令"啥都不打印就退出"。只有后台 fire-and-forget 路径（防止拖住 `mcc -v`）才该 unref。

**修复**: 弃用 update-notifier，改自管缓存 + 原生 https（详见 decisions 同日条目）。`fetchLatest` 加 `background` 参数区分两条路：后台 unref、awaited 不 unref。

**教训**: (1) "声称帮你做后台版本检查"的库未必真的写成了——别假设它在工作，要去缓存文件里核实结果有没有落盘。(2) `socket.unref()` 是把双刃剑：它解决"别拖住快命令"，但用在 await 的请求上会让进程在结果到手前静默退出。判断标准是"这次请求的结果有没有人等"——有人 await 就别 unref。
