# CCS Dashboard 设计系统

从**规范参考页面** — `home` 和 `cliproxy` — 中提取的页面级设计系统，这两个页面已经在生产环境中证明了这些模式的有效性。新页面应适应这些参考，而非反过来。

某些页面合法地需要定制设计（重新设计的 `health` 页面是当前的例子）— 当内容形状需要自定义层次结构时，系统应让开，而不是将页面强行塞进不合身的原型中。

> 开发中的实时预览：`bun run dev` 然后访问 `/_styleguide`。

---

## 0. 布局不变式（永不违反）

这些规则先于原型选择。当一个原型似乎需要违反它们时，是原型错了，而非规则。代码审查拒绝违反 §0 的 PR。

### 0a. 两列 shell，全视口高度

每个 Config 页面都是严格的两列 shell：

- **左列**是统一身份面板（rail / list）。它拥有页面身份（品牌、主要 CTA、实体选择器、状态 footer）。
- **左列宽度是 content-fit，而非固定。** Rail 在*风格*和*primitives*上跨每个 Config 页面统一，但实际宽度适应其标题内容（`w-fit min-w-[240px] max-w-[360px]`）。Rail 永远不能溢出或换行其标题 — 如果 rail 在 240px 处无法在一行内容纳"API Profiles"+ "+ New"按钮，它会增长到 360px。超出此范围，列表项标签按项目截断。页面不得覆盖此 envelope；如果页面确实需要更宽的 rail，将其作为系统级 envelope 变更提出（一个 PR 为所有人调整上限）。
- **右列**是主要内容（form，或 form + json）。它填充剩余宽度。
- 两列共享**相同的顶部边缘**，与全局 topbar 对齐。
- 它们一起填充 `100vh` 减去全局 topbar — 两个 pane 上方没有向上滚动的空白带，没有"第一页高度只是标题"。

### 0b. 全局 topbar 下方无水平条带

视口顶部唯一允许的水平条带是**全局 topbar**（logo、ClaudeKit / Sponsor badges、连接状态、locale、theme）。

你不得在其下方堆叠第二个条带 — 无 `PageHeader`、无面包屑行、无描述带、无 KPI 丝带 — 当 body 是 `ConfigLayout` 时。Config 页面的身份位于**左侧 rail 内部**，在那里占用零垂直空间。

### 0c. Pane 顶部对齐

在 `ConfigLayout` 内，所有 panes（左侧 rail、form、json）共享**相同的顶部边缘**。Form pane 内的标签栏不得将 json pane 向下推 — 它们是同级列，而非父子。标签属于**内部** form pane 自己的滚动区域。

### 0d. cliproxy 页面是规范的 Config 参考

当 Config 页面在布局形状上与 `pages/cliproxy.tsx` 不一致时，页面是错的。任何产生任一列上方空白带、重复身份条带或同级 panes 之间顶部偏移的内容都是 §0 违反，无论声称了哪种 §1 模式。

### 0e. Form 和 JSON panes 是用户可调整大小的

`ConfigLayout` 的**中间（form）和右侧（json）panes 必须由用户通过可拖动分隔符水平调整大小**：

- 左侧 rail **跨页面统一但 content-fit** — 相同的 envelope、相同的 primitives，但实际宽度适应其标题内容。约束：`min-w-[240px]`（下限 — 标题控件永远不会挤入换行）和 `max-w-[360px]`（上限 — rail 在实体标签异常长时也不能主导 body；`ListPane` 内的 per-item `truncate` 处理超出该范围的标签）。Rail 不是用户可调整大小的 — 只有 form↔json split 是。
- Form ↔ json 分隔符是**唯一可调整的 split**。用户经常需要宽 form 来输入 env 值，或宽 json pane 来读取有效配置 — 而非同时达到设计时的默认值。
- **默认比例：form 约 45% / json 约 55%** 的 rail 后剩余 body 宽度。json pane **默认稍大**，因为规范 cliproxy 参考显示用户花更多时间阅读有效配置而非一次编辑一个字段。通过 `react-resizable-panels` 的 `autoSaveId` 持久化用户选择的比例**每个页面独立**。`ConfigLayout` 的 `storageKey` prop 是可选的，**默认为从 `window.location.pathname` 派生的 key**（因此每个路由自动获得自己的 localStorage slot，split 状态永远不会渗透到不相关的 Config 页面）。仅在子路由应共享状态或选择退出 pathname 耦合时传递显式 key。
- 每个 pane 通过 `react-resizable-panels` 基于百分比的 `minSize` 强制执行**最小尺寸为 30%** 的 resizable container（rail 后 body 宽度）。在 1280px 视口和 280px rail 上，这约为每 pane 300px — 可读但不宽敞；在标准 1500px+ 视口上为 360px+，实际舒适下限。库的 `minSize` API 在 v3 中不支持像素值；如果将来需要硬像素下限，在顶部叠加 `onResize` clamp。
- 当 json pane 被省略（`json={undefined}`）时，form 扩展填充剩余宽度 — 不渲染分隔符。
- 在 `<1024px` 断点以下，布局折叠为 tabs（Browse / Configure / JSON）— 在 tab 模式下调整大小无关。

这满足了反复出现的需求，即将一个 pane 加宽以检查长 env block 或读取原始配置，而不丢失 rail 锚定的 shell。

---

## 1. Identity-strip 模式（每个页面选择一种）

三种模式覆盖 dashboard 中的每个页面。选择取决于你的页面已经有什么。

### 1a. `HeroBar` — 单行密集型 hero

**规范参考：** `pages/home.tsx`

```
┌────────────────────────────────────────────────────────────────────┐
│ [logo]  Title  [version]   ┃  [Stat] [Stat] [Stat] [Stat]          │
└────────────────────────────────────────────────────────────────────┘
```

一行包含 logo + 标题 + 版本号 + ≤4 个内联统计。可选的细微点状图案背景。统计在兼作导航入口点时是可点击的。

**使用场景：**
- 页面是带有清晰产品身份的 dashboard / monitor
- ≤4 个 hero 统计用数字总结页面
- 垂直空间重要（这是堆叠 PageHeader + KpiRow 的一半高度）

**构建块：**
- `<HeroSection version={…}/>` — 来自 `components/layout/hero-section.tsx` 的 logo + 标题 + 副标题
- `<InlineStat title value icon variant onClick/>` — 可点击统计瓦片（从 `home.tsx` 提取）；当第二个页面采用它时升级为共享 primitive

### 1b. Rail 锚定身份 — 无顶部 chrome

**规范参考：** `pages/cliproxy.tsx`

```
┌──────────┬─────────────────────────────────────────────────────────┐
│ ⚡ Brand  │                                                         │
│ subtitle │                                                         │
│ [QSetup] │  full-height 3-pane body                                │
│          │                                                         │
│ • prov A │  (form + raw json fill the entire viewport)             │
│ • prov B │                                                         │
│  …       │                                                         │
│ [status] │                                                         │
└──────────┴─────────────────────────────────────────────────────────┘
```

页面身份（品牌 + 页面级 CTA + 状态）位于**左侧 rail 内部**。零顶部 chrome — body archetype 获得完整垂直视口。

**使用场景：**
- 页面是多实体 Config（3-pane：list / form / json）
- Rail 自然承载页面名称（你会在顶部 header 中重复它）
- 垂直空间宝贵，因为 body 有密集的 form 内容

**构建块：**
- 左侧 rail 自己的 header section（就地标记，尚未提取 primitive — 保持 bespoke 直到第二个页面采用该模式）
- Rail 中推荐的顺序：品牌条 → 主要 CTA → 实体列表 → 状态 widget → footer 摘要

### 1c. `PageHeader` — 标题行 chrome（仅限 Monitor）

**规范参考：** 尚无（曾是 `health.tsx`，直到其定制重新设计 — 见 §1d）。

```
┌────────────────────────────────────────────────────────────────────┐
│ Title  [v-badge]                              [action] [action]    │
│ Description / last-update / status info                            │
└────────────────────────────────────────────────────────────────────┘
```

带有描述和尾随操作的传统标题行。

**禁止使用：** 任何 `ConfigLayout` 上方。见 §0b。这包括单实体 Config、多实体 Config 以及任何 list/form/json 布局。使用 **§1b Rail 锚定** — rail 拥有身份，body 填充视口。

**使用场景（仅限 Monitor）：**
- Body archetype 是 **Monitor**（KPI 行 + 网格）且页面**没有左侧 rail**
- 描述带有真正不冗余的上下文（最后刷新、页面层次结构、过滤状态、版本）
- `HeroBar`（§1a）不合适，因为页面有超过 4 个 hero 数字或没有干净的内联统计形状

**API：** `<PageHeader title description status actions />` — 左侧是标题 + 描述，右侧是状态 badges + 操作按钮。

### 1d. Bespoke — 完全自定义设计

**规范参考：** `pages/health.tsx`

当页面的内容形状需要自己的层次结构（优先级驱动的 sections、与状态关联的动态背景、`HealthStatusRibbon` / `HealthPriorityCard` 等自定义卡片 primitives）时，设计系统让开。Bespoke 页面仍然尊重全局关注点（隐私模式、主题、sidebar），但从头构建自己的布局。

**使用场景：**
- 三种模式都不能在不扭曲内容的情况下适用
- 页面的信息层次结构确实是独特的（例如带有次要审计列表的严重度驱动的优先级 surface）
- bespoke 实现明显优于强行适配

**成本：** 更高的 LOC、无复用、无一致性 — 仅在内容需要时合理。

### 决策表

| 页面形状 | Identity strip |
|----------|----------------|
| 带 ≤4 hero 统计的 Dashboard / overview | **HeroBar**（home 模式） |
| 单实体 Config（rail + form + 可选 json） | **Rail 锚定**（cliproxy 模式，无顶部 chrome） |
| 多实体 Config（3-pane：list/form/json） | **Rail 锚定**（cliproxy 模式，无顶部 chrome） |
| 带 hero viz **且无左侧 rail** 的 Monitor | **PageHeader** + Monitor body |
| 具有自定义层次结构的严重度/优先级驱动页面 | **Bespoke**（health 模式） |
| Wizard / login / dialog | 无 — bespoke shell |

> **经验法则：** 如果你的页面有左侧 rail，它使用 §1b Rail 锚定。`PageHeader` 保留给没有 rail 的 Monitor 的狭窄情况。

---

## 2. Body archetypes

### 2a. Config — 3-pane

**规范参考：** `pages/cliproxy.tsx`

```
┌──────────┬──────────────────┬──────────┐
│ left     │ form (FormPane)  │ json     │
│ rail     │                  │ (right)  │
└──────────┴──────────────────┴──────────┘
```

左 rail = `ListPane`（多实体）或 `SectionRail`（单实体，带 `IntersectionObserver` scroll-spy）。Form 和 JSON panes 分别是中间和右侧。

```tsx
<ConfigLayout
  left={<ListPane …/>}            // 多实体
  // 或
  left={<SectionRail …/>}         // 单实体
  form={<FormPane>…</FormPane>}
  json={<JsonPane data={…} />}
/>
```

**规则：**
- 保存操作仅位于 `FormPane` footer
- Form ↔ json split 是**用户可调整大小的**，比例持久化（见 §0e）。左 rail 宽度固定。
- `<1024px`：折叠为 tabs（Browse | Configure | JSON）— 在 tab 模式下分隔符隐藏
- `JsonPane` 默认只读；opt-in `editable` 用于 cliproxy 风格的内联编辑

### 2b. Monitor — KPI 行 + 12 列网格

**规范参考：** 此 PR 中尚无。Health 曾是参考但变得 bespoke（§1d）。Primitives（`MonitorLayout`、`KpiRow`、`KpiCard`、`MonitorGrid`、`MonitorCard`）随船提供并保持可用；第一个真正需要它们的页面成为下一个参考。

```
┌────────────────────────────────────────┐
│ KpiRow (≤4 hero numbers)               │
├────────────────────────────────────────┤
│ MonitorGrid (12-col):                  │
│   <MonitorCard span={…}/>              │
└────────────────────────────────────────┘
```

```tsx
<MonitorLayout kpis={<KpiRow>…</KpiRow>}>
  <MonitorGrid>
    <MonitorCard span={6} variant="terminal" title=…>…</MonitorCard>
  </MonitorGrid>
</MonitorLayout>
```

**规则：**
- 仅在 ≤4 个 hero 数字时使用 `KpiRow`；更多 → 分组在网格内
- 每页一个主要 viz，跨度 ≥8 列
- `variant="terminal"` 用于实时日志 / `health --watch` 外观

---

## 3. 组合新页面

**Config 页面（任何 provider / profile / account / api 管理页面的默认值）：**

```tsx
<PageShell>
  <ConfigLayout
    left={<ListPane … />}     // rail 拥有身份（§1b）— 品牌、CTA、列表、状态
    form={<FormPane …/>}      // tabs（如果有）位于此 pane 滚动区域的内部
    json={<JsonPane …/>}      // 可选；与 form 相同的顶部边缘（§0c）
  />
</PageShell>
```

无 `PageHeader`。无描述带。Rail header 承载品牌和 section 名称；rail footer 承载状态/计数。

**Dashboard / home 页面（无 rail）：**

```tsx
<PageShell>
  <HeroBar … />               // §1a — 一行，≤4 个内联统计
  <MonitorLayout … />         // 可选的网格在下方
</PageShell>
```

**无 rail 的 Monitor 页面：**

```tsx
<PageShell>
  <PageHeader title description actions /> {/* §1c — 仅在此处有效 */}
  <MonitorLayout kpis={<KpiRow … />}>
    <MonitorGrid>…</MonitorGrid>
  </MonitorLayout>
</PageShell>
```

新页面的目标 LOC：**典型 config 约 ~80**，**带 hero strip 的 monitor 约 ~120**。异常重写的目标 LOC：**\<400**。

---

## 4. 反模式（审查中拒绝）

### 4a. `PageHeader` 堆叠在 `ConfigLayout` 上方

❌ 不要这样做：

```tsx
<PageShell>
  <PageHeader title="API Profiles" description="Premium APIs, local runtimes, custom endpoints" />
  <ConfigLayout left={…} form={…} json={…} />
</PageShell>
```

PageHeader 偷走了 body 约 80px，重复了 rail 已经承载的身份，并将 form + json panes 推到折叠下方。使用 rail 锚定身份（§1b）— 将标题移入 rail header 并完全移除描述带。见 §0b。

### 4b. 标签栏偏移同级 panes

❌ 不要将标签栏（例如 `Environment / Info & Usage`）放置在 form pane 顶部，使得右侧的 json pane 起点低约 40–60px。Form 和 json 是**同级**共享一个顶部边缘（§0c）。标签属于 form pane 自己滚动区域的**内部**，而非作为单独行在其上方。

### 4c. 重复 rail 的描述带

❌ 不要在标题下方添加描述，仅重述左侧 rail 项目已经传达的内容（"Premium APIs, local runtimes, custom endpoints"，而 rail 已经列出了这些实体）。如果 rail 显示了它，该带就是噪音。

### 4d. 任一列上方的空白垂直带

❌ 不要引入会在全局 topbar 和任一列顶部之间产生 >24px 空白带的填充、间距或包装器。`ConfigLayout` 的两列与全局 topbar 对齐（§0a）。如果包装器需要该带，包装器是错的。

---

## 5. 颜色和强调使用

CCS 调色板是 **Pampas（暖米色）+ Crail（赤陶橙）**，在 `src/index.css` 中定义为 CSS 变量。**永不引入新色调。** 每个视觉决策通过这些 tokens 路由：

| Token | 角色 | 使用时机 |
|-------|------|----------|
| `--background`（Pampas） | 页面画布 | 仅最外层 shell |
| `--card` | 凸起表面 | FormPane shell、JSON header bar、卡片 |
| `--card/60`、`--card/80` | 柔和凸起 | FormSection bg、渐变 header 尾部 |
| `--muted/20`、`--muted/30`、`--muted/40` | Pane 清洗、footer 锚点、JSON shell | 在没有硬边框的情况下区分同级 panes |
| `--accent`（Crail） | 身份/焦点 | Section 点、顶部 1px 条带、主要 CTA、关键 chrome 上的状态药丸 |
| `--accent/30`、`--accent/40` | 低语强调 | FormSection 边缘的垂直条纹、header bars 上的顶部边缘条带 |
| `--accent/10` | 色调背景 | 状态药丸 bg（"editable"、"sensitive"、"connected"） |
| `--muted-foreground` | 次要文本 | 字段标签、描述、提示文字 |
| `--destructive` | 错误/危险 | 表单错误、"删除账户"按钮、反模式标注 |
| `--ring` | 焦点轮廓 | 永不按组件覆盖 — 让 `focus-visible:ring-*` 使用 token |

### 5a. 1-accent-dot 规则

每个 FormSection 在其标题前有**恰好一个强调点**（1.5px 圆圈，`bg-accent`），以及**一条 2px Crail 前导边缘条纹**。这些是 `--accent` 在 body 内饱和的唯一地方。

Header bars（FormPane、JsonPane）在顶部边缘带有 1px `accent/40` 条带 — 与底部的 Save 按钮安静地呼应。

如果一个 section 需要更多关注（例如 connected 状态），使用**轮廓药丸**和 `bg-accent/10` + `text-accent` + `border-accent/30`，而非 body 中填充的 `bg-accent` 块。

### 5b. 区分同级 panes

Form pane（`bg-card`）和 JSON pane（`bg-muted/30`）必须在视觉上区分而没有硬边框线：

- **Form pane** = 凸起的卡片表面、主动编辑区域
- **JSON pane** = 凹陷的柔和表面、只读检查区域

在 JSON pane 内，`<pre>` 块使用 `bg-card/80` 和 `shadow-inner`，使代码位于微妙的浮雕井中 — 用户一眼就能分辨哪一侧是"你编辑的"，哪一侧是"为你计算的"。

### 5c. 状态药丸

使用小 uppercase 药丸（10px 字体，`tracking-wider`，`rounded`，1px 边框）表示状态。两种色调：

- **Active / accent**：`border-accent/40 bg-accent/10 text-accent` — 用于 `editable`、`connected`、`sensitive`、`default`
- **Neutral / muted**：`border-border bg-muted/60 text-muted-foreground` — 用于 `read only`、`unset`、`disabled`

除非语义是颜色本身（例如 §1d Bespoke 中的 health 严重度层），否则不要使用 `bg-emerald-*` / `bg-amber-*` / `bg-blue-*` 表示状态。默认为 palette tokens。

### 5d. 错误和危险

`--destructive` 是系统中**唯一的红色**。用于：
- 内联表单验证错误（错误消息使用 `text-destructive`，错误输入使用 `border-destructive/40`）
- 文档中的反模式标注（`/_styleguide` 中的 `§0 invariants` 标注使用它）
- 真正破坏性的按钮操作（"删除账户"、"重置配置"）

永远不要用 `--destructive` 为描述带、信息横幅或悬停状态着色。

### 5e. 新 pane 快速检查清单

- [ ] FormSections 使用 `bg-card/60` 和前导强调条纹 + 每个标题前的强调点
- [ ] FormPane header 有 1px `accent/40` 顶部条带和 `from-card to-card/70` 渐变
- [ ] FormPane footer 使用 `bg-muted/40` 锚定主要保存操作
- [ ] JsonPane shell 使用 `bg-muted/30`；header 使用 `bg-card/80` 和强调点 + 状态药丸
- [ ] 没有原始 `text-blue-500`、`bg-green-100` 等 — 只有 palette tokens
- [ ] 悬停状态改变现有 tokens 的透明度，而非色调（例如 `before:bg-accent/30 hover:before:bg-accent/70`）

### 5f. 交互状态（三级强度阶梯）

每个交互元素使用相同的强度阶梯表示强调存在感：

| 状态 | 强调强度 | 示例 |
|------|----------|------|
| Default | `accent/30` | FormSection 前导条纹在静止时 |
| Hover / scan | `accent/70` | 鼠标悬停时的 FormSection 条纹（ peripheral cue） |
| Focus / active | `accent` 纯色 + 柔和环 | `focus-within` 时的 FormSection、ListPane 选中的行 |

`FormSection` 实现所有三种：条纹变为 `30 → 70 → 100`，加上 `focus-within` 上的柔和 `ring-accent/20` 和阴影提升。用户始终知道哪个 group "拥有"他们的光标。

`ListPane` 选中的行使用相同的阶梯：前导边缘 3px Crail 条纹 + `bg-accent/10` 行色调 + 强调色调的图标和 badge。悬停给出没有行色调的 `accent/30` 条纹预览。这在视觉上将选中的实体与右侧的 FormSection 处理联系起来。

粘性 headers（`FormPane.header`）包括柔和的 inset 底部阴影，因此当 body 在其上方滚动时，深度得以保留而没有硬分隔线。

### 5g. 敏感字段

标签匹配 `src/lib/sensitive-label.ts` 中启发式（`isSensitiveLabel(label)`）的字段**自动**呈现为敏感。该模式涵盖常见约定：`AUTH_TOKEN | ACCESS_TOKEN | REFRESH_TOKEN | BEARER_TOKEN | API_KEY | API_TOKEN | API_SECRET | CLIENT_ID | CLIENT_SECRET | AWS_ACCESS_KEY_ID | AWS_SECRET_ACCESS_KEY | GCP/AZURE/GITHUB/GITLAB/OPENAI/ANTHROPIC/GEMINI 上述变体 | PRIVATE_KEY | SSH_KEY | JWT | OAUTH | CREDENTIAL | PAT | PASSWORD | PASSPHRASE | WEBHOOK_SECRET | HMAC_KEY | SIGNING_KEY`。匹配大小写不敏感，容忍 `_` / `-` 分隔符。如果启发式未匹配确实是凭证的标签，显式传递 `sensitive`。添加新模式意味着编辑 `sensitive-label.ts` 中的一个正则 — 每个消费者（委托的 Field、MaskedInput 调用者、未来辅助函数）自动拾取。

处理方式：

- 锁形图标（`lucide-react/Lock`）前缀标签，强调色调 `accent/70`
- 标签行右侧的"sensitive"状态药丸（按 §5c 的强调色调）
- 默认 `<input type="password">`，右侧边缘有显示/隐藏眼形切换
- 焦点环使用 `ring-accent/40` + `border-accent/50`（vs 普通字段的 neutral `ring-ring`）— 这是默认焦点环被覆盖的唯一位置

页面不得使用自己的 sensitive-field UI。如果启发式未匹配标签，显式传递 `sensitive`。

### 5h. 原始配置内容

`JsonPane` 内的 JSON 内容渲染为**纯文本** — 此设计系统无内联语法高亮。专用的 JSON 查看器将在后续替换 `<pre>`；在此之前，pane 的**chrome**（shell、header 条带、强调点、状态药丸、浮雕代码井）承载 §5 处理，而**内容**保持无色。页面在此期间不得添加内联 JSON 色调。

---

## 6. 何时不使用任一原型

这些保持 bespoke，超出范围：
- `/login` — 最小居中 shell
- Setup wizard — 模态叠加
- Dialogs — Radix `Dialog`

---

## 7. 决策

见 [`design-decisions.md`](./design-decisions.md) 了解已解决的开放问题和 v1.1 / v1.2 / v1.3 / v1.4 / v1.5 / v1.6 / v1.7 / v1.8 修订理由。
