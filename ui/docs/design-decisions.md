# 设计系统 — 决策日志

头脑风暴阶段的 6 个开放问题，在实施前已解决。

| # | 问题 | 决策 | 理由 |
|---|------|------|------|
| 1 | Storybook vs 应用内 `/_styleguide` | **应用内 `/_styleguide`** | 零配置，存在于 repo 中，通过 `import.meta.env.DEV` 控制。Storybook 在这个规模下是一个重量级的第二构建流水线，收益甚微。 |
| 2 | Archetype B 名称（Monitor vs Dashboard） | **Monitor** | "Dashboard" 是整个产品。"Monitor" 与现有的 health/analytics 措辞一致，避免了该词的语义过载。 |
| 3 | JsonPane 可编辑性范围 | **默认只读**，opt-in `editable` prop | Cliproxy 是目前唯一真正需要面板内编辑的页面。opt-in 方式保证了对 codex/copilot/cursor（只读）的 API 安全性。 |
| 4 | Health 终端外观 | **保留**为 `MonitorCard variant="terminal"` | 保留 `ccs health --watch` 的视觉感受。作为 opt-in variant 实现，而非独立 primitive。 |
| 5 | i18n key 命名空间约定 | **按页面命名空间**（`pages.<name>.*`）+ 共享（`common.*`） | 现有的 i18n 已经在使用按页面的 ad-hoc keys；这只是将其正式化。Primitives 使用 `common.*`，因此在页面间翻译稳定。 |
| 6 | SectionRail 激活方式 | **Scroll-spy** via `IntersectionObserver` | 保留长表单配置的感受 + 同时显示所有验证错误。点击切换会隐藏非活跃 section 的错误，这对表单来说是更差的 UX。 |

---

## v1.1 修订（2026-04-25）— identity-strip 模式

第二阶段尝试将 `home` 和 `cliproxy` 迁移到一刀切的 `PageShell + PageHeader` chrome。两者的密度都出现了退化：

- **home** 有一行 hero（logo + 标题 + 版本号 + 4 个内联统计），拆分为堆叠的 PageHeader + KpiRow 使垂直占用翻倍，失去了扫描性
- **cliproxy** 的身份标识在左侧 rail 中，添加顶部 PageHeader 重复了品牌，偷走了 3-pane body 约 80px 的空间

**决议：** 设计系统围绕从现有规范参考中提取的三种 identity-strip 模式重新构建：

| # | 模式 | 参考 | 适用场景 |
|---|------|------|----------|
| 7a | `HeroBar`（1行密集型） | `pages/home.tsx` | 带有 ≤4 个 hero 统计的 Dashboard 页面 |
| 7b | Rail 锚定身份（无顶部 chrome） | `pages/cliproxy.tsx` | Rail 承载品牌的多实体 Config 页面 |
| 7c | `PageHeader`（当前） | `pages/health.tsx` | 描述/状态信息不冗余的页面 |

第二阶段的 home + cliproxy 迁移已回滚。Health 保持迁移（Monitor archetype + PageHeader 在那里有效）。未来页面迁移适配符合条件的模式，而非反过来。

**为什么自下而上：** 现有参考已在生产环境中证明了其模式的有效性。设计系统的职责是使有效的模式正式化，而非强加应该怎样的规范。

---

## v1.2 修订（2026-04-25）— health 重设计和 bespoke 模式

在 v1.1 重构之后，`health` 页面按照专用交接简报（`plans/reports/handoff-260425-1417-health-page-redesign.md`）进行了单独的、聚焦的重设计。设计采用了 bespoke 方式：

- 新领域组件：`HealthStatusRibbon`、`HealthPriorityCard`、`HealthPriorityList`、`HealthAuditSection`
- 按严重度驱动的布局：错误/警告等优先表面在顶部，带有突出的修复功能，审计手风琴在下方
- 动态彩色背景与整体状态关联，玻璃态强调
- 无 `PageShell`，无 `PageHeader`，无 `MonitorLayout` — 完全自定义 shell

**决议：** 添加第四种 identity-strip 模式 — **§1d Bespoke** — 用于内容形状不符合三种主要模式的页面。v1.1 行的声明"health 保持迁移（Monitor archetype + PageHeader 在那里有效）"不再成立；此处已更正。

**副作用：**
- `PageHeader` 失去了规范参考（曾是 health）。新参考待定（等下一个采用它的 Monitor 无 rail 页面出现）。
- `MonitorLayout` 失去了规范参考。Primitives 保留供未来 Monitor 页面使用。
- `Bespoke` 明确是一个逃生舱，而非默认。代码审查强制要求"先尝试三种模式"。

---

## v1.8 修订（2026-04-26）— PR-Agent 第二轮：storageKey 默认值、MaskedInput 类型安全、键盘可访问的显示切换

PR #1109 上游审查中提出的三个更实质性问题。每个都编码在代码和规范中：

**Required `storageKey` 是错误的修复。** v1.7 使 `storageKey: string` 成为 REQUIRED 以防止跨页面状态混淆，但这将未来的每个生产页面迁移都变成了破坏性构建事件。更好的工程实践：保持 prop 为可选，**默认为从 `window.location.pathname` 派生的 key**，这样每个路由自动获得自己的 localStorage slot。跨页面混淆问题仍然适用于硬编码的共享 key，但 pathname 派生的默认值天然唯一。SSR 安全（当 `window` 不可用时回退到稳定字符串）。页面仍可传递显式 `storageKey` 以选择退出 pathname 耦合（例如当子路由应该共享状态时）。

**`MaskedInput` 类型可被调用者覆盖。** 展开的 `{...props}` 放在硬编码的 `type={revealed ? 'text' : 'password'}` **之后**，因此传递 `type="text"` 的调用者会静默地将凭证渲染为明文 — 这是一个真实的泄漏风险，破坏了组件的初衷。双层修复：
- 编译时：`MaskedInputProps` 现在扩展 `Omit<InputHTMLAttributes, 'type'>`，使得调用者字面上无法传递 `type`。类型系统强制执行此契约。
- 运行时：`<Input>` 上的 `type` 属性现在放在展开**之后**，因此即使编译时检查被绕过（例如通过 `as`-cast），组件仍然胜出。双重保险。

**显示切换键盘不可访问。** `MaskedInput` 和 `Field` 的眼形图标按钮都有 `tabIndex={-1}`，将其从 tab 顺序中移除 — 纯键盘用户无法显示或隐藏密码。解决方案：
- 移除 `tabIndex={-1}`，使按钮加入自然 tab 顺序。
- 添加 `aria-pressed={revealed}`，使屏幕阅读器宣布切换状态。
- 添加 focus-visible 强调环，使焦点状态在无鼠标情况下可见。

这些是不应该发货的无障碍功能回归；§5g 的新测试记录为：(a) `type` 无法被覆盖，(b) 切换可通过 Tab 到达并宣布状态。

---

## v1.7 修订（2026-04-26）— PR-Agent 反馈：强制执行最小值、要求 storageKey、扩展 sensitive 启发式

PR #1109 上游审查中提出的三个实质性问题。每个都编码在代码和规范中：

**宽度下限 — 像素声明无法执行。** 之前的规范措辞说"form ≥ 360px / json ≥ 320px"，但 `react-resizable-panels` v3 只接受百分比 `minSize`。在 1280px 视口上，这可能使用户将面板拖动到约 250px — 远低于文档化的下限。解决方案：将 `minSize` 从 25 提升到 **30**，将下限重新表述为百分比（rail 后 body 宽度的 ≥ 30%），记录跨现实视口的实际 300–360px 范围，注明 v3 API 约束，并为未来需要的硬像素下限留下 `onResize` clamp 的空间。

**`storageKey` 不再是可选的。** 之前的默认值 `storageKey="ccs.config-layout"` 意味着任何没有显式 key 的 `<ConfigLayout>` 都将与每个其他 Config 页面共享 localStorage 状态 —split ratio 会渗透到不相关的页面。解决方案：在 `ConfigLayout` props 中使 `storageKey` 成为 REQUIRED（无默认值）。TypeScript 现在强制执行显式 per-page keys。页面必须传递例如 `storageKey="config-layout.cliproxy"` — 这在编译时检查，而非运行时。

**Sensitive-field 启发式过于狭窄。** 之前的正则 `AUTH_TOKEN|API_KEY|SECRET|PASSWORD|PRIVATE_KEY` 遗漏了常见密钥名称：`ACCESS_TOKEN`、`REFRESH_TOKEN`、`BEARER_TOKEN`、`CLIENT_SECRET`、`CLIENT_ID`、`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`、GCP/Azure/GitHub/OpenAI/Anthropic 变体、`JWT`、`OAUTH`、`CREDENTIAL`、`PAT`、`WEBHOOK_SECRET`、`HMAC_KEY`、`SIGNING_KEY`、`SSH_KEY`。解决方案：将启发式提取到 `src/lib/sensitive-label.ts`（`isSensitiveLabel(label)`）并将模式扩展覆盖所有这些；大小写不敏感；容忍 `_`/`-` 分隔符。Field 组件导入共享辅助函数。添加新模式意味着编辑一个正则；每个消费者都继承。

共享辅助函数是单一真实来源，因此未来的漂移无法重新引入彼此不同意的大型组件启发式。

---

## v1.6 修订（2026-04-26）— content-fit rail（统一 envelope，固定宽度）

在 API Profiles 页面上对 rail 锚定模式的现场审查发现了一个退化：在之前强制的固定 `260px` rail 宽度下，rail 标题"API Profiles"换行成两行，描述带换行，操作按钮相互拥挤 — 即 rail 本身溢出了其内容，尽管系统强制要求该确切宽度。

**决策：** 左侧 rail **跨页面统一但 content-fit**，而非固定宽度。相同的 primitives，相同的样式处理（§5），相同的垂直结构（header → search → list → footer）— 但**宽度**在统一 envelope 内适应其标题内容：

- `w-fit` — 自然宽度增长到最大的原子标题元素（标题 + 按钮保持在一行）
- `min-w-[240px]` — 下限，因此稀疏 rail（例如没有 badges 的单 section SectionRail）不会挤压控件
- `max-w-[360px]` — 上限，因此当实体标签异常长时 rail 不会占据 body 主导地位；`ListPane` 内的 per-item `truncate` 处理超出该范围的标签

页面不得覆盖此 envelope。如果页面确实需要更宽的 rail，这是系统级 envelope 变更（一个 PR 为所有人提高上限 — 一致性是重点）。

**为什么不用户可调整？** form↔json split *是* 用户可调整的（§0e），因为用户在不同任务中间对阅读 vs 编辑有不同的偏好。rail 不是，因为 rail 内容由页面作者控制，应在设计时由页面作者调整大小。允许用户拖动 rail 宽度会在 identity strip 内添加拖动 affordances（视觉噪音），而没有解决真正的反复出现的需求。

**编码为 §0a** 在 `design-system.md` 中（强制性布局不变式；§0e 中之前的"固定最小宽度"措辞被重写为引用新的 envelope）。`ConfigLayout` 随 envelope 一起发布为 `<aside className="w-fit min-w-[240px] max-w-[360px] …">`，因此每个 Config 页面免费继承该行为 — 页面不得使用自己的 rail 宽度。

---

## v1.5 修订（2026-04-26）— body panes 的颜色和强调处理

在 v1.4 styleguide 审查期间的用户反馈：form 和 JSON panes 都渲染为平面白色表面，没有视觉层次或强调存在感 — panes 技术上正确但视觉上惰性且彼此无法区分。

**决策：** 使用现有的 Pampas/Crail palette tokens 应用结构化强调处理 — 不引入新色调。处理被编码到 primitives（`FormPane`、`FormSection`、`JsonPane`），因此每个 Config 页面自动继承外观；页面不得使用自己的 bg/border/accent 覆盖。

**具体更改：**

- `FormSection` 获得 2px Crail 前导边缘条纹（`before:bg-accent/30`，悬停时变亮为 `accent/70`）和 1.5px 强调点前缀每个标题 — "1-accent-dot 规则"
- `FormPane` 标题获得 1px `accent/40` 顶部条纹和 `from-card to-card/70` 渐变；body wrapper 使用 `bg-muted/20`，使 FormSections（`bg-card/60`）读作凸起的卡片而非浮动；footer 使用 `bg-muted/40` 来锚定主要保存操作
- `JsonPane` shell 转换为 `bg-muted/30`，因此右侧 pane 在视觉上比 form pane（主动编辑表面）凹陷 → 凹陷的阅读表面；header 具有相同的 1px Crail 条纹 + 强调点 + 状态药丸（`editable` 用强调色调，`read only` 用中性色调）
- `JsonView` 中的内部 `<pre>` 块位于 `bg-card/80` `shadow-inner` well 内 — 赋予代码微妙的浮雕感，而非漂浮在平面上
- 新的 **§5 颜色和强调使用** 在 `design-system.md` 中编纂规则：token 表、1-accent-dot 规则、同级 pane 区分、状态药丸规范、错误/破坏性范围，以及新 panes 的 6 点检查清单

**为什么重要：**

- 用户不是设计师，要求可以遵循的护栏。§5 的检查清单 + token 表意在可复制粘贴，以便未来页面作者不需要品味 — 他们遵循规则
- 保持 palette 不变（Pampas + Crail 仅此而已）意味着品牌一致性得以保留，同时每个 pane 都获得了深度
- 强调点/条纹模式可识别：任何 Config 页面现在在瞥一眼时就会读作"CCS 形状"，甚至在用户阅读单个标签之前

**约束：**

- 除现有的 health-priority bespoke 页面（§1d）和严重度驱动的语义外，不得在任何地方使用原始 Tailwind 颜色（`bg-blue-*`、`text-emerald-*` 等）
- 所有 elevation 通过 `bg-card`、`bg-muted/*` 和 `bg-card/*` 透明度步骤完成 — 绝不单独通过 shadow
- 悬停状态改变现有 token 的透明度，而非色调

---

## v1.4 修订（2026-04-26）— 可调整大小的 form / json split

在 v1.3 styleguide 审查期间的用户反馈：单一固定 form/json ratio 无法同时服务编辑（宽 form）和阅读（宽 json）— 像 GLM provider 示例这样的 env blocks 需要宽 form 来输入长值，而调试有效配置需要宽 json pane。

**决策：** `ConfigLayout` 的 **form（中间）和 json（右侧）panes 是用户可通过可拖动水平分隔符调整大小**。左侧 rail 宽度保持固定（rail 拥有身份，不与 body 宽度竞争）。用户选择的 ratio 在 per-page `localStorage` 中持久化（`ccs.config-layout.<page>.split`）。

**约束：**

- 强制执行最小宽度（form ≥ 360px，json ≥ 320px）— 两个 pane 都不会崩溃到不可读
- 默认 split：form `flex-1`，json 剩余宽度的 `~38–42%`
- 当省略 `json` prop 时，form 填充剩余宽度，不渲染分隔符
- 在 `<1024px` 以下，布局折叠为 tabs（现有行为）；分隔符在 tab 模式下无关
- 调整大小句柄键盘可访问（箭头键移动 16px 增量，Home/End 跳转到 min/max）

**编码为 §0e** 在 `design-system.md`（强制性布局不变式）以及 §2a Config archetype 中的规则更新。实现位于 `ConfigLayout`，因此每个 Config 页面免费继承该行为 — 页面不得使用自己的调整逻辑。

**为什么是不变式而非 feature flag：** 规范参考（`cliproxy`）和每个迁移的 provider 页面都显示了 env blocks，其中根据任务不同，一个 pane 总是比另一个更有趣。固定 ratio 天生就是错误的；使 split 可调整更接近"IDE 已经如何工作"，消除反复出现的小摩擦，而不扩展设计表面。

---

## v1.3 修订（2026-04-26）— 布局不变式和 Config 的 rail 锚定默认值

第三阶段 + 第四阶段（PR #1105）将 12 个 Config 页面迁移到堆叠在 `ConfigLayout` 上方的 §1c `PageHeader` 模式。API Profiles 页面的现场审查暴露了退化：

- 全局 topbar（ClaudeKit / Sponsor / Connected / locale / theme）已经占据了一个水平条带
- 在其下方添加 `PageHeader`（"API Profiles" + 描述）创建了**第二个条带**，消耗约 80px 的垂直空间
- form pane 的标签栏（`Environment / Info & Usage`）将 json pane 又向下推了约 40px，因此右侧列开始远低于左侧
- 净效果：一个大的空白 L 形条带包裹 body，规范的 `cliproxy`"无顶部 chrome，body 填充视口"感觉丢失，身份在 PageHeader 和 rail 之间重复

**解决方案：**

1. 在 `design-system.md` 中新增强制性 **§0 布局不变式** — 两列 shell、全视口高度、无第二水平条带、同级 panes 共享一个顶部边缘、`cliproxy.tsx` 是规范 Config 参考
2. `§1c PageHeader` 在任何 `ConfigLayout` 之上**明确禁止**。它保留给没有左侧 rail 的 Monitor 页面
3. 决策表更新：**所有** Config 页面（单实体 AND 多实体）使用 `§1b Rail 锚定`。删除之前的"单实体 Config 或 Monitor → PageHeader"行
4. 新的 **§4 反模式** 部分记录了四个具体失败模式及被拒绝的代码样本（PageHeader-over-ConfigLayout、标签栏偏移 json pane、冗余描述条带、列上方空白条带）
5. 采用 `PageHeader` 的第三阶段 + 第四阶段页面迁移现在是**非规范的**，直到重构为 rail 锚定。PR #1105 被搁置；合并需要后续 commit 从每个迁移的 Config 页面剥离 `PageHeader` 并将身份折叠到 rail 中

**原因：** 规范参考（`cliproxy`）已经证明 rail 锚定对密集 provider configs 有效。第三阶段忘记了 v1.1 的自下而上原则（"设计系统围绕从现有规范参考中提取的三种 identity-strip 模式重新构建"），并将自上而下的 chrome 强加给左侧 rail 已经承载身份的页面。v1.3 重申该原则并编码布局不变式，以便规则不能再静默漂移。

**副作用：**

- `PageHeader` 失去其剩余的规范参考（第三+四阶段页面），直到采用它的 Monitor 无 rail 页面出现
- `/_styleguide` 简介已更新以突出显示 §0 不变式
- 应在 `plans/reports/` 中提交第三 + 第四阶段回顾报告，记录哪些页面需要 rail-anchor 重构和 LOC 增量

---

## 如何重新审视

如果一个决策在实践中被证明是错误的，更新此文档并更新受影响的 primitive — 不要静默漂移。如果更改，上面每个条目应附上"Revised: <date> · <reason>"行。
