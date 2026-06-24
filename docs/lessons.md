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

