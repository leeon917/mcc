# Agent 指南

面向 Agent 工具的 AI 指导，用于处理此仓库。

## 关键约束（永不违反）

### 测试隔离（强制）

**测试期间绝不触碰用户真实的 `~/.ccs/` 或 `~/.claude/` 目录。**

- 所有访问 CCS 路径的代码必须使用 `src/utils/config-manager.ts` 中的 `getCcsDir()`
- 此函数尊重 `CCS_HOME` 环境变量用于测试隔离
- **错误：** `path.join(os.homedir(), '.ccs', ...)`
- **正确：** `path.join(getCcsDir(), ...)`

测试将 `process.env.CCS_HOME` 设置为临时目录。直接使用 `os.homedir()` 的代码会修改用户的真实文件。

## CI 优先协议（强制）

**任务在 CI 变绿之前不算完成。每次 `git push` 后，AI agent 必须阻塞等待 CI 通过。**

### 必需顺序
1. `git push`
2. **立即**运行 `gh pr checks --watch`（或 `gh run watch`）并阻塞直到所有检查完成。
3. 如果**变绿** → 任务可以继续下一步或宣告完成。
4. 如果**变红**：
   - 拉取失败日志：`gh run view --log-failed`（或 `gh pr checks <n>` 识别失败任务，然后 `gh run view <run-id> --log-failed`）。
   - 本地修复根本原因。不要盲目重试。
   - 提交并重新推送。重新监视 CI。
5. 适用于首次 `gh pr create` 以及开放 PR 上的每次后续推送。

### 回退（当 `--watch` 不可用或不稳定时）
轮询短暂等待，直到没有检查处于 `pending` / `in_progress`：
```bash
until [ "$(gh pr checks <n> --json state -q '[.[] | select(.state == "IN_PROGRESS" or .state == "PENDING" or .state == "QUEUED")] | length')" = "0" ]; do
  sleep 10
done
gh pr checks <n>
```

### 绝对规则
当 CI 变红或仍在运行时，AI 不得宣告任务完成、关闭会话或转向下一个任务。让 PR 保持变红状态然后离开是此协议要防止的主要失败模式。

### Dev Release 与 Push CI

- `CI` 是贡献者分支的 PR 质量门。
- `Push CI` 是 `dev` 合并后的质量信号。
- `Dev Release` 在 `dev` 变更落地后发布 `@dev` 包。
- 变红的 `Dev Release` 不一定意味着贡献者代码失败。先检查 `Push CI`。
- 于 `2026-04-22` 通过 `gh api repos/kaitranntt/ccs/branches/dev/protection` 验证：`dev` 当前要求 `typecheck`、`lint`、`format`、`build` 和 `test`，无分支限制，无必需的 PR 审查门。
- `dev-release.yml` 当前使用 `PAT_TOKEN` 推送，因为 `dev` 受那些必需状态检查保护。除非分支保护随之改变，否则不要切换回 `github.token`。

### 自托管运行器策略

- 默认将活跃 CCS 工作流保留在本地自托管运行器上。不要将任务迁移到 `ubuntu-latest`、`macos-latest` 或其他 GitHub 托管运行器作为第一安全修复。
- 对于这个公共仓库，标准 GitHub 托管运行器可能不消耗计费分钟，但项目策略仍然是本地运行器优先，以保持计算可预测并避免仓库间配额意外。
- 通过以下方式使自托管使用安全：限制不受信任的 PR 触发、在特权 `pull_request_target` 作业中避免检出不受信任的代码、设置 `persist-credentials: false`，以及将 PAT 支持的凭证限制在精确的发布/同步推送步骤。
- 如果工作流确实需要 GitHub 托管运行器，在此文件中记录例外并添加回归测试。

## 核心功能

Claude Code、Factory Droid、Codex CLI 及其他兼容目标的多 Provider Profile 和运行时管理器。
用户文档见 README.md。

## README 保护

编辑 `README.md` 时，保持文件简洁，将详细用法引导至文档站点，但**不要删除 `## Community Projects` 部分**
或 `## Star History` 部分，除非用户明确要求删除。将两者视为受保护的 README 内容。

当贡献者向 `README.md` 添加有用的社区集成部分时，
优先在 `## Community Projects` 中保留 attribution，并将设置内容移至文档页面，而不是删除贡献。

除特定 Provider 的 Gemini 和 Antigravity 文档外，避免使用 `ccs gemini`
或 `ccs agy` 作为主要示例、默认入门路线或通用工作流示例。
当页面涉及更广泛主题时，优先使用 `ccs`、`ccs codex`、`ccs kiro`、`ccs glm`、Droid
示例或中立的 `ccs <provider>` 占位符。

## 设计原则（严格强制执行）

### 技术卓越
- **YAGNI**：不添加"以防万一"的功能
- **KISS**：仅使用简单的 bash/PowerShell/Node.js
- **DRY**：单一事实来源（config.yaml）

### 用户体验（同等重要）
- **CLI 完整**：所有功能必须有 CLI 接口
- **仪表板对等**：配置功能也必须有仪表板界面
- **执行靠 CLI**：运行 Profile 通过终端而非仪表板按钮
- **UX > 简洁**：错误消息和帮助文本优先考虑用户成功而非简洁
- **渐进式披露**：默认简单，强大功能可访问但不令人不知所措

### 原则冲突时
- 用户面向功能的 **UX > YAGNI**（如果用户需要，就不是"以防万一"）
- **KISS 适用于两者**代码和用户体验（简单旅程，而不仅仅是简单代码）
- **DRY 适用于两者**代码和接口模式（CLI/仪表板行为一致）

## 常见错误（避免）

| 错误 | 后果 | 正确操作 |
|---------|-------------|----------------|
| 先运行 `validate` 而不先运行 `format` | format:check 失败 | 在 validate 之前运行 `bun run format` |
| 将 `Dev Release` 视为贡献者质量信号 | `dev` 上的发布失败看起来像代码损坏 | 先检查分支上的 PR `CI` 和 `dev` 上的 `Push CI` |
| 对 dev→main PR 使用 `chore:` | 不会触发 npm 发布 | 使用 `feat:` 或 `fix:` 前缀 |
| 直接提交到 `main` 或 `dev` | 绕过 CI/审查 | 始终使用 PR |
| 手动版本提升或 git 标签 | 与 semantic-release 冲突 | 让 CI 处理版本控制 |
| 忘记更新 `--help` | CLI 文档不同步 | 更新 `src/commands/help-command.ts` |
| 忘记更新文档 | 用户文档不同步 | 更新 `docs/` 和 CCS 文档子模块 |

## GitHub Issue 操作（CCS 特定）

当任务是 issue 分类、排期清理、标签、评论、项目或此仓库的里程碑时适用。

### 范围边界

- 将 issue 分类视为 **GitHub 仅限工作流**，除非用户明确要求实现。
- **不要**创建 worktree、分支、PR 或运行 `/fix`、`/cook` 或 `kai:maintainer` 来标记 issue、
  发布后续评论、关闭重复或清理排期状态。
- 仅在以下情况升级到代码工作流：
  - 用户明确要求修复/实现 issue，或
  - 分类证明同样的任务现在需要代码更改。

### 变更前先阅读

- 始终先用 `gh issue view <n> --json ...` 或 `gh api` 检查实时 issue 状态。
- 永远不要依赖过时的记忆、截图或 issue 标题。
- 在关闭为已解决之前，至少在以下之一中交叉检查仓库证据：
  - `README.md`
  - `docs/`
  - `CHANGELOG.md`
  - 相关源/帮助处理程序
- 如果 `gh` 查询会触及项目字段，先验证令牌范围。缺少 `read:project` 是真正的阻碍，而不是可以忽视的东西。

### 标签标准

- 每个**开放** issue 分类结束时应包含：
  - 一个主要类型标签：`bug`、`enhancement`、`question`、`documentation`、`duplicate`、`invalid` 或 `wontfix`
  - 一个区域标签：
    - `area:cli-runtime`
    - `area:dashboard-ui`
    - `area:config-auth`
    - `area:provider-integration`
    - `area:install-packaging`
    - `area:documentation`
    - `area:contributor-workflow`
- 仅在路由标签实质性改变处理时才添加：
  - `upstream-blocked`
  - `needs-repro`
  - `needs-split`
  - `docs-gap`
- 对已发布的工作使用发布状态标签：
  - `pending-release`
  - `released-dev`
  - `released`
- **不要**创建或使用状态标签如 `todo`、`doing`、`blocked`、`done`。
- **不要**创建 Provider 名称标签，除非有证实的长期需求。Provider 名称属于标题/issue，不属于标签垃圾邮件。

### 评论规则

- 保持 issue 评论简短、技术性和中立。
- plainly 陈述决定：关闭、保持开放、重新标记、需要复现、重复、上游阻塞。
- 相关时包含精确证据：版本、文档路径、变更日志发布、规范 issue、上游链接。
- **不要**引用内部计划、本地报告文件、agent 提示或私人推理。
- 每次分类传递只发布一条维护者后续评论。如果意外创建了重复项，用
  `gh api repos/<owner>/<repo>/issues/comments/<id> -X DELETE` 删除。

### 关闭规则

- 立即关闭当：
  - issue 明显重复且可以指向规范 issue
  - 功能/修复已明确发布并记录
  - 先前 `pending-release` 的 issue 现在明显已过发布且不再需要追踪
- 保持开放并重新标记当：
  - 上游依赖仍阻止 CCS 采用 -> `upstream-blocked`
  - 最新发布行为不清楚 -> `needs-repro`
  - issue 包含多个独立请求 -> `needs-split`
  - 功能可能存在但可发现性/文档薄弱 -> `docs-gap`
- **不要**仅仅因为 issue 旧、模糊或不方便就关闭。仅凭证据关闭。

### 项目和里程碑

- 此仓库的首选项目模型：一个项目，`CCS Backlog`。
- 使用项目管理工作流状态和优先级。使用标签表示含义和路由。
- 里程碑仅用于真正的发布窗口，而不是通用分类桶。
- 如果 `gh` 令牌缺少 `read:project`，明确说明并停止假装项目数据可用。
- 活跃项目：
  - owner: `kaitranntt`
  - number: `3`
  - URL: `https://github.com/users/kaitranntt/projects/3`
- 活跃项目字段：
  - `Status` -> 用于工作状态（`Todo`、`In Progress`、`Done`）
  - `Priority` -> Bug 用 `P1`，默认排期用 `P2`，宽泛的 `needs-split` 桶用 `P3`，除非明确重新优先级
  - `Follow-up` -> `Ready`、`Needs repro`、`Blocked upstream`、`Needs split`、`Docs follow-up`
  - `Next review` -> 仅对需要后续检查点的 issue 使用日期
- 分类开放 issue 时，确保它存在于 `CCS Backlog` 中且项目字段与路由标签匹配。
- **不要**创建第二个排期项目，除非用户明确要求项目拆分并给出原因。
- 当前自动化路径：
  - 工作流文件：`.github/workflows/sync-ccs-backlog-project.yml`
  - 同步脚本：`scripts/github/ccs-backlog-sync.mjs`
  - 必需的 Actions 密钥：`CCS_PROJECT_AUTOMATION_TOKEN`
- 自动化映射必须与标签保持对齐：
  - `upstream-blocked` -> `Follow-up=Blocked upstream`
  - `needs-repro` -> `Follow-up=Needs repro`
  - `needs-split` -> `Follow-up=Needs split`
  - `docs-gap` -> `Follow-up=Docs follow-up`
  - 否则 -> `Follow-up=Ready`

### 新建或更新 Issue 创建

- 为此仓库创建 issue 时：
  - 分配 `@kaitranntt`
  - 使用 conventional issue 标题：`bug: ...`、`feat: ...`、`docs: ...`
  - 保持 body 事实性和技术性
  - 避免个人信息，仅限内部上下文

## 质量门（强制）

推送前必须通过质量门。**两个项目工作流相同。**

### 预提交顺序（按此顺序执行）

```bash
# 主项目（从仓库根目录）
bun run format              # 步骤 1：修复格式
bun run lint:fix            # 步骤 2：修复 lint 问题
bun run validate            # 步骤 3：快速门（typecheck + lint + format + test:fast）
bun run validate:ci-parity  # 步骤 4：PR-CI 对等门（分支检查 + build + 完整测试 + e2e）

# UI 项目（如果 UI 更改）
cd ui
bun run format              # 步骤 1：修复格式
bun run lint:fix            # 步骤 2：修复 lint 问题
bun run validate            # 步骤 3：最终检查（必须通过）
```

**为什么是这个顺序：**
- `validate` 运行 `format:check`，仅验证——不会修复
- 如果 format:check 失败，说明你跳过了步骤 1
- `validate` 现在使用只读 `lint`，所以自动修复仍然属于步骤 2
- PR CI 和 `validate:ci-parity` 都只运行非变更检查

### 每个门运行什么

| 项目 | 命令 | 运行内容 |
|---------|---------|------|
| Main | `bun run validate` | typecheck + lint + format:check + test:fast |
| Main | `bun run validate:ci-parity` | base branch check + typecheck + lint + format:check + build:all + test:all + test:e2e |
| UI | `bun run validate` | typecheck + lint:fix + format:check |

### ESLint 规则（全部错误）

| 规则 | 级别 | 备注 |
|------|-------|-------|
| `@typescript-eslint/no-unused-vars` | error | 忽略 `_` 前缀 |
| `@typescript-eslint/no-explicit-any` | error | 使用适当类型或 `unknown` |
| `@typescript-eslint/no-non-null-assertion` | error | 不使用 `!` 断言 |
| `prefer-const`, `no-var`, `eqeqeq` | error | 代码质量 |
| `react-hooks/*`（仅 UI） | recommended | Hooks 规则 |
| `react-refresh/*`（仅 UI） | vite | 快速刷新 |

### TypeScript 选项（严格模式）

| 选项 | 值 | 备注 |
|--------|-------|-------|
| `strict` | true | 启用所有严格标志 |
| `noUnusedLocals` | true | 无未使用变量 |
| `noUnusedParameters` | true | 无未使用参数 |
| `noImplicitReturns` | true | 所有路径必须返回 |
| `noFallthroughCasesInSwitch` | true | 显式 case 处理 |

### 自动执行

- `prepack` 运行 `build:all`
- PR `CI` 运行 `typecheck`、`lint`、`format`、`build`、`test:all` 和 `test:e2e`
- `Push CI` 在合并后在 `dev` 上运行相同的质量套件，单独于发布推送
- `Dev Release` 在发布前仍运行 build + 快速验证 + 慢速测试 + e2e，仍需要 `PAT_TOKEN` 推送回受保护的 `dev`
- husky `pre-commit` 运行快速 lint/类型/格式检查
- husky `pre-push` 在 `main`/`dev`/hotfix 分支上运行完整的 `bun run validate:ci-parity` 门
- husky `pre-push` 在功能分支上运行更快的门（`typecheck` + `lint` + `format:check` + `test:fast`）以及基于更改文件的针对性检查

### 可维护性门状态

- 历史可维护性基线门已从活跃 CCS 工作流中退役。
- `validate`、`validate:ci-parity`、PR `CI`、`Push CI` 和发布工作流**不**调用 `maintainability:check`。
- 较旧的路线路中对 `maintainability:baseline` / `maintainability:check` 的引用是历史上下文，不是当前仓库命令。

## 关键约束（永不违反）

1. **CLI 输出中禁止 EMOJIS** - 终端输出仅使用 ASCII：`[OK]`、`[!]`、`[X]`、`[i]`
   - **范围：** CCS CLI 终端输出（打印到 stdout/stderr 的 `src/` 代码）
   - **不适用于：** PR 描述、commit 消息、文档、评论、AI 对话
2. **TTY 感知颜色** - 尊重 NO_COLOR 环境变量
3. **非侵入性** - 未经用户明确请求和确认，绝不修改外部工具设置（`~/.claude/settings.json`）（`ccs persist` 命令除外）
4. **跨平台一致性** - bash/PowerShell/Node.js 必须行为相同
5. **CLI 文档** - 所有 CLI 更改必须更新相应的 `--help` 处理程序（见下表）
6. **幂等** - 所有安装操作可安全多次运行
7. **仪表板对等** - 配置功能必须在 CLI 和仪表板中均可工作

### 帮助位置参考

| 命令 | 帮助处理程序位置 |
|---------|----------------------|
| `ccs --help` | `src/commands/help-command.ts` |
| `ccs api --help` | `src/commands/api-command.ts` → `showHelp()` |
| `ccs cleanup --help` | `src/commands/cleanup-command.ts` → `printHelp()` |
| `ccs cliproxy --help` | `src/commands/cliproxy-command.ts` → `showHelp()` |
| `ccs config --help` | `src/commands/config-command.ts` → `showHelp()` |
| `ccs copilot --help` | `src/commands/copilot-command.ts` → `handleHelp()` |
| `ccs cursor --help` | `src/commands/cursor-command.ts` → `handleHelp()` |
| `ccs doctor --help` | `src/commands/doctor-command.ts` → `showHelp()` |
| `ccs docker --help` | `src/commands/docker/help-subcommand.ts` → `showHelp()` |
| `ccs migrate --help` | `src/commands/migrate-command.ts` → `printMigrateHelp()` |
| `ccs env --help` | `src/commands/env-command.ts` → `showHelp()` |
| `ccs persist --help` | `src/commands/persist-command.ts` → `showHelp()` |
| `ccs setup --help` | `src/commands/setup-command.ts` → `showHelp()` |

**注意：** `lib/ccs` 和 `lib/ccs.ps1` 只是引导包装器——它们通过 npx 委托给 Node.js，不包含帮助文本。

## 文档要求（强制）

**文档是一等公民。所有面向用户的更改都需要更新文档。**

### 本地文档（`docs/`）

为以下内容更新本地 `docs/` 文件夹：
- 架构更改
- 内部 API 文档
- 开发指南

### CCS 文档子模块（仅限所有者）

**对于 @kaitranntt（仓库所有者）：** 添加/更改 CLI 命令或配置选项时，
你还必须更新 `~/CloudPersonal/ccs/docs/` 中的 CCS 文档子模块：

| 更改类型 | 要更新的文件 |
|-------------|-----------------|
| 新 CLI 命令/标志 | `reference/cli-commands.mdx` |
| 新配置选项 | `reference/config-schema.mdx` |
| Provider 功能 | `providers/<provider>.mdx` |
| 新功能 | `features/<feature>.mdx` |

**文档子模块工作流：**
```bash
cd ~/CloudPersonal/ccs/docs/
git checkout main && git pull
# 进行更改
git add -A && git commit -m "docs: <description>"
git push origin main
```

**对于外部贡献者：** 在 PR 描述中记录更改。所有者将同步到 CCS 文档。

### 预提交文档清单

- [ ] 相应的 `--help` 已更新（见帮助位置参考表）
- [ ] 如果架构更改则更新本地 `docs/`
- [ ] 所有者更新 CCS 文档子模块，或贡献者在 PR 描述中包含文档

## 功能接口要求

| 功能类型 | CLI | 仪表板 | 示例 |
|--------------|-----|-----------|---------|
| Profile 创建 | ✓ | ✓ | `ccs auth create`，仪表板"添加账户" |
| Profile 切换 | ✓ | ✓ | `ccs <profile>`（执行仅限 CLI） |
| API 密钥配置 | ✓ | ✓ | `ccs api create`，仪表板 API Profile |
| 健康检查 | ✓ | ✓ | `ccs doctor`，仪表板实时监控 |
| OAuth 认证流程 | ✓ | ✓ | 浏览器从 CLI 或仪表板打开 |
| 分析/监控 | ✗ | ✓ | 仪表板分析（本质是可视化的） |
| WebSearch 配置 | ✓ | ✓ | CLI 标志，仪表板设置 |
| 远程代理配置 | ✓ | ✓ | CLI 标志，仪表板设置 |

## 文件结构

```
src/           → TypeScript 源（主项目）
dist/          → 编译的 JavaScript（npm 包）
lib/           → 原生 shell 脚本（bash、PowerShell）
ui/src/        → React 组件、hooks、页面
ui/src/components/ui/ → shadcn/ui 组件
dist/ui/       → 构建的 UI 包（由 Express 提供服务）
```

## 关键技术细节

### Profile 机制（优先级顺序）

1. **CLIProxy 硬编码**：gemini、codex、agy → 基于 OAuth，零配置
2. **CLIProxy 变体**：`config.cliproxy` 部分 → 用户定义的 Provider
3. **基于设置**：`config.profiles` 部分 → GLM、传统 GLMT 兼容性、Kimi
4. **基于账户**：`profiles.json` → 通过 `CLAUDE_CONFIG_DIR` 隔离实例

### 设置格式（关键）

所有 env 值必须是字符串（不是布尔值或对象）以防止 PowerShell 崩溃。

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.example.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_MODEL": "model-name"
  }
}
```

### 共享数据架构

从 `~/.ccs/shared/` 符号链接：commands/、skills/、agents/
Profile 特定：settings.json、sessions/、todolists/、logs/
Windows 回退：符号链接不可用时复制

## 代码标准

### 架构
- `lib/ccs`、`lib/ccs.ps1` - 引导脚本（通过 npx 委托给 Node.js）
- `src/*.ts` → `dist/*.js` - 主实现（TypeScript）

### Bash（lib/*.sh）
- bash 3.2+、`set -euo pipefail`、引用所有变量 `"$VAR"`、`[[ ]]` 测试
- 无外部依赖

### PowerShell（lib/*.ps1）
- PowerShell 5.1+、`$ErrorActionPreference = "Stop"`
- 仅原生 JSON，无外部依赖

### TypeScript（src/*.ts）
- Node.js 18+、Bun 1.0+、TypeScript 5.3、严格模式
- `child_process.spawn`，处理 SIGINT/SIGTERM

### 终端输出
- 仅 ASCII：`[OK]`、`[!]`、`[X]`、`[i]`（CLI 输出中禁止 emojis）
- 颜色前检测 TTY，尊重 NO_COLOR
- 错误框边框：╔═╗║╚╝

## 传统提交（强制）

**所有提交必须遵循传统提交格式。不符合的提交会被 husky 拒绝。**

### 格式
```
<type>(<scope>): <description>
```

### 类型（决定版本提升）

| 类型 | 版本提升 | 用于 |
|------|--------------|-------|
| `feat:` | MINOR | 新功能 |
| `fix:` | PATCH | Bug 修复 |
| `perf:` | PATCH | 性能 |
| `feat!:` | MAJOR | 破坏性更改 |
| `docs:`、`style:`、`refactor:`、`test:`、`chore:`、`ci:`、`build:` | None | 非发布 |

### 示例
```bash
# 正确
git commit -m "feat(cliproxy): add OAuth token refresh"
git commit -m "fix(doctor): handle missing config gracefully"

# 错误 - 拒绝
git commit -m "added new feature"
git commit -m "Fixed bug"
```

## 分支策略

### 层级
```
main (production) ← dev (integration) ← feat/* | fix/* | docs/*
     ↑
     └── hotfix/*（仅关键，绕过 dev）
```

### 标准工作流
```bash
git checkout dev && git pull origin dev
git checkout -b feat/my-feature
# ... 使用传统提交开发 ...
git push -u origin feat/my-feature
gh pr create --base dev --title "feat(scope): description"
# 在 @dev 测试后：
gh pr create --base main --title "feat(release): promote dev to main"
```

### 热修复工作流（仅生产紧急情况）
```bash
git checkout main && git pull origin main
git checkout -b hotfix/critical-bug
# ... 修复 ...
gh pr create --base main --title "fix: critical issue"
# 然后同步：git checkout dev && git merge main && git push
```

### 规则
1. **绝不**直接提交到 `main` 或 `dev`
2. 功能分支从 `dev`，热修复从 `main`
3. dev→main PR 必须使用 `feat:` 或 `fix:`（不是 `chore:`）
4. 合并后删除分支

## 自动发布（不要手动标签）

**发布通过 semantic-release 完全自动化。绝不手动提升版本或创建标签。**

| 分支 | npm 标签 | 时间 |
|--------|---------|------|
| `main` | `@latest` | PR 合并到 main 时 |
| `dev` | `@dev` | 推送到 dev 分支时 |

**CI 处理：** 版本提升、CHANGELOG.md、git 标签、npm 发布、GitHub 发布。

## 开发

### 测试（PR 前必需）
```bash
bun run test              # 所有测试
bun run test:npm          # npm 包测试
bun run test:native       # 本地安装测试
bun run test:unit         # 单元测试
```

### 本地开发
```bash
bun run dev               # Build + 启动配置服务器（http://localhost:3000）
bun run dev:symlink       # 符号链接全局 'ccs' → dev dist/ccs.js（快速迭代）
bun run dev:unlink        # 恢复原始全局 ccs
./scripts/dev-install.sh  # Build、pack、全局安装（完整安装）
rm -rf ~/.ccs             # 清理环境
```

**重要：** 在 CCS 根目录使用 `bun run dev` 以获得始终最新的代码。开发期间不要使用 `ccs config`，因为它使用全局安装的版本。

## 两层预推送清单

为优化的迭代推送然后审查工作流而设计。不要在每次推送时运行完整门——CI 是安全网。在请求审查/合并前运行一次完整门。

### 第一层 — 迭代推送（功能分支）
Husky `pre-push` 自动运行：`typecheck + lint + format:check + test:fast` 以及基于更改文件的针对性检查。AI 在推送时**不做额外操作**。

**推送后（强制）：** 遵循 [CI 优先协议](#ci-first-protocol-mandatory)——监视 CI 直到变绿。CI 变红时不要继续。

### 第二层 — 请求审查/合并前
运行一次，不是每次推送：
- [ ] `bun run validate:ci-parity` — 分支新鲜度 + build + 完整非 e2e 测试 + e2e
- [ ] `gh pr checks <n>` — 所有检查变绿
- [ ] 如果 UI 更改：`cd ui && bun run format && bun run validate`
- [ ] 如果触及命令路由、代理流程、工作流或发布逻辑：`bun run test:e2e`

### 代码/文档/标准（合并前验证）
- [ ] 传统提交格式（`feat:`、`fix:` 等）
- [ ] 相应的 `--help` 已更新（见帮助位置参考）——如果 CLI 更改
- [ ] 添加/更新了测试——如果行为更改
- [ ] README.md 已更新——如果面向用户
- [ ] CCS 文档已更新（所有者：`~/CloudPersonal/ccs/docs/`）——如果 CLI/配置更改
- [ ] 本地 `docs/` 已更新——如果架构更改
- [ ] CLI 输出仅 ASCII（终端输出中禁止 emojis），尊重 NO_COLOR
- [ ] YAGNI/KISS/DRY 对齐已验证
- [ ] 无手动版本提升或标签

## 错误处理原则

- 早验证，快速失败，消息清晰
- 犯错时显示可用选项
- 绝不留下损坏状态
