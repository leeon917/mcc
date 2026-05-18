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

## 2026-05-14 17:37:50 +08:00: KISS direct-API 路线——不做 OAuth、不做本地 proxy

**背景**: 现有工具 CCS 已经覆盖了 OAuth + local proxy + 多 runtime 的完整场景。MCC 的定位是极简替代——给只需要 API key 切换的用户一个更轻的选择。

**选项**:
- 沿用 CCS 架构（OAuth + proxy）：功能完整但复杂度高
- 纯 CLI wrapper：直接设 env 然后 spawn Claude Code

**选择**: 纯 env-based direct API。`buildDirectApiEnv()` 返回 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_MODEL`，`cmdUse()` 拼上 `CLAUDE_CONFIG_DIR` 后 `spawn('claude', ...)`。

**代价**: 不支持 OAuth provider（Codex、Kiro 等），不支持 `profile:model` 运行时路由。这些场景留给 CCS。

---
