# 硬化债务消除追踪器

最后更新：2026-02-12
负责人：Stream D（`#542`）

## 范围

可维护性硬化基础工作，低风险更改：

- 盘点旧版 shims/兼容性标记
- 盘点同步文件系统使用情况，特别是运行时热路径
- 增量将热路径同步 I/O 迁移到异步 I/O 并测试

## 如何测量

运行：

```bash
bun run report:hardening
```

生成的产物：

- `docs/reports/hardening-inventory.json`
- `docs/reports/hardening-inventory.md`

## 启动基线（Issue #542 Stream D）

当前基线来自运行 `bun run report:hardening` 后的 `docs/reports/hardening-inventory.json`。
基线捕获日期：`2026-02-12`。

| 指标 | 基线 |
|---|---:|
| 同步 fs 出现次数（全部） | 835 |
| 受影响的同步 fs 文件（全部） | 100 |
| 同步 fs 出现次数（运行时热路径） | 724 |
| 受影响的同步 fs 文件（运行时热路径） | 89 |
| 旧版 shim 标记 | 131 |
| 受影响的旧版 shim 文件 | 56 |

## 初始异步 I/O 迁移日志

| 日期 | 领域 | 更改 | 安全说明 |
|---|---|---|---|
| 2026-02-12 | `src/web-server/jsonl-parser.ts` | 将 `parseProjectDirectory()` 目录列表从同步 `readdirSync` 迁移到异步 `fs.promises.readdir` | 保持现有行为（相同的过滤/回退）；由 `tests/unit/jsonl-parser.test.ts` 覆盖 |
