# CCS Dashboard UI

React + TypeScript + Vite 前端，用于 CCS 本地 dashboard。

此 UI 由 CCS Web 服务器提供，通过以下方式访问：

```bash
ccs config
```

---

## 开发

从项目根目录运行：

```bash
bun run dev
```

此命令启动 CCS 服务器，打开本地浏览器 URL，并打印 dashboard 的 bind/network 详情。
如果 runtime bind 可从 loopback 外部访问，CCS 还会打印认证提醒。

远程设备访问开发时，运行：

```bash
bun run dev -- --host 0.0.0.0
```

本地开发时运行：

```bash
bun run dev -- --host 127.0.0.1
```

仅在 `ui/` 目录下运行（前端开发服务器）：

```bash
cd ui
bun run dev
```

---

## 质量检查命令

```bash
cd ui
bun run typecheck
bun run lint
bun run validate
bun run test:run
```

---

## i18n

Dashboard 本地化使用 `react-i18next`。

- 主配置：`ui/src/lib/i18n.ts`
- Locale 辅助函数：`ui/src/lib/locales.ts`
- 语言切换器：`ui/src/components/layout/language-switcher.tsx`

完整的架构、约定和 locale 接入方式，参见：

- [`../docs/i18n-dashboard.md`](../docs/i18n-dashboard.md)

---

## 注意事项

- UI locale 持久化使用浏览器 localStorage key `ccs-ui-locale`。
- 当前支持的 locale 在 `ui/src/lib/locales.ts` 中管理。
- 当前 locale：`en`、`zh-CN`、`vi`。
- Fallback locale 为英语（`en`）。
