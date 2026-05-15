# Dashboard i18n 指南

最后更新：2026-04-14

本文档描述 CCS Dashboard（`ui/`）使用的国际化（i18n）架构、locale 选择工作原理以及如何安全地添加新语言。

---

## 范围

Dashboard i18n 当前涵盖 React 组件呈现的 UI 文本。

- 当前支持的 locale：
  - `en`（英语）
  - `zh-CN`（简体中文）
  - `vi`（越南语）
  - `ja`（日语）
- Locale 状态使用 `ccs-ui-locale` 保存在浏览器 localStorage 中。
- 回退语言是 `en`。

超出范围：

- CLI 终端输出本地化
- 后端/API payload 本地化

---

## 架构

### 初始化

- 文件：`ui/src/App.tsx`
- `import '@/lib/i18n'` 在路由渲染前初始化 i18next 一次。

### 翻译资源

- 文件：`ui/src/lib/i18n.ts`
- 包含带有 locale 块的 `resources` 对象：
  - `en.translation`
  - `zh-CN.translation`
  - `vi.translation`
  - `ja.translation`
- 使用 `initReactI18next` 进行 React 集成。

### Locale 工具

- 文件：`ui/src/lib/locales.ts`
- 核心辅助函数：
  - `normalizeLocale(locale)` 将浏览器/存储值映射到支持的 app locale。
  - `getInitialLocale` 选择存储的 locale，然后是浏览器 locale，然后是 `en`。
  - `persistLocale` 将规范化 locale 写入 localStorage。

### 语言切换器

- 文件：`ui/src/components/layout/language-switcher.tsx`
- 使用 `react-i18next` + shadcn `Select`。
- 选择时调用 `persistLocale` 和 `i18n.changeLanguage`。

### 测试引导

- 文件：`ui/tests/setup/vitest-setup.ts`
- 测试设置必须导入 `ui/src/lib/i18n.ts`，以便直接 `useTranslation()` 消费者解析与应用相同的单例实例。
- 如果测试模拟 `useTranslation()`，保持模拟的 key 表面与组件输出或断言对齐，否则会漂移。

---

## 关键约定

### 翻译 key 命名

按功能区域使用点号命名空间：

- `nav.home`
- `cursorPage.title`
- `settingsTabs.web`

保持 key 名称稳定和语义化，以最小化跨 locale 的变更。

### 复数

对于基于计数的字符串，使用 i18next 后缀规则：

- `<key>_one`
- `<key>_other`

示例存在于同步/账户计数器中。

### 插值和富文本

- 对运行时值使用插值：`t('key', { value })`。
- 尽可能使用纯文本 key。
- 如果需要格式化（例如粗体段），使用 `<Trans />` 而不是 `dangerouslySetInnerHTML`。

---

## 添加新 Locale

添加 locale（如泰语 `th`）时：

1. 在 `ui/src/lib/locales.ts` 的支持 locale 列表中添加 locale id。
2. 在 `ui/src/lib/i18n.ts` 的 `translation.locale` 下添加 locale 显示标签。
3. 添加包含所有 key 的完整 `<locale>.translation` 块。
4. 验证缺失 key 的回退行为仍为 `en`。
5. 运行 UI 验证和 i18n 测试：
   - `cd ui && bun run validate`
   - `cd ui && bun run test:run tests/unit/ui/i18n/language-switcher.test.tsx`
6. 添加或更新 key 一致性测试以捕获 locale 漂移。

推动越南语推出的当前 issue：

- https://github.com/kaitranntt/ccs/issues/659

---

## 贡献者清单

在打开涉及 i18n 的 PR 之前：

- [ ] 新 UI 字符串在所有支持的 locale 中都已翻译。
- [ ] 运行时 UI 中没有原始 key 字面量。
- [ ] 没有为翻译内容引入不安全的 HTML 注入路径。
- [ ] `ui` validate/test 命令通过。
- [ ] 如果架构或约定更改，更新本文档。
