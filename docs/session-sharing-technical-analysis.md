# 会话共享技术分析

最后更新：2026-05-05

## 摘要

CCS 通过在选定账户之间共享工作区上下文文件来支持实用的跨账户连续性，同时保持每个账户的凭证隔离。

这是通过每个账户的上下文策略实现的：

- `isolated`（默认）：账户保持自己的工作区上下文
- `shared` + `standard`（默认）：账户工作区上下文链接到共享上下文组
- `shared` + `deeper`（高级可选加入）：账户还共享连续性产物

## 推荐的双账户路径

当您想要两个真实 Claude 账户并选择每个会话运行哪个时，使用 `ccs auth` 账户 profiles：

```bash
ccs auth create work
ccs auth create personal

ccs work
ccs personal
```

这保持使用和凭证隔离。每个账户拥有自己的 Claude 配置目录、登录状态和 `.anthropic` 凭证。

共享资源与历史同步是分开的。默认情况下，非裸账户 profiles 从原生 Claude 继承 Claude 本地资源：

```text
~/.ccs/instances/<account>/settings.json
  -> ~/.ccs/shared/settings.json
  -> ~/.claude/settings.json
```

这涵盖了普通 Claude Code `settings.json`、commands、skills、agents 和 plugins。这不是 token 共享。`ccs auth show <account>` 报告 `Resources`、`Settings`、`History` 和 `Plain ccs` 通道，以便用户可以看到共享资源和恢复历史是否对齐。

对于现有账户，从 CLI 更改共享资源：

```bash
ccs auth resources work --mode profile-local
ccs auth resources work --mode shared
```

- `shared`：从共享 Claude 资源布局链接 plugins、commands、skills、agents 和 `settings.json`。
- `profile-local`：为账户分离那些共享资源。这是现有 `--bare` 行为作为现有账户设置公开。

仅在两个账户应看到相同的本地连续性时选择加入共享历史：

```bash
ccs auth create work2 --share-context --context-group daily --deeper-continuity
```

对于现有历史同步，使用 Dashboard -> Accounts -> Sync 在两个账户上，将两者都设置为 `shared`，并使用相同的 `History Sync Group`。仅在用户期望项目上下文之外的更强本地交接时使用 `deeper`。历史同步不控制 plugins 或 `settings.json`；为此使用 `ccs auth resources`。

## 为什么这是足够安全的

CCS 仅共享工作区上下文路径（项目/会话上下文文件）。它**不会**在账户之间合并或复制认证凭证。

凭证存储保持按账户实例分开。

## 实现模型

账户元数据存储在 `~/.ccs/config.yaml`：

```yaml
accounts:
  work:
    created: "2026-02-24T00:00:00.000Z"
    last_used: null
    shared_resource_mode: "shared"
    context_mode: "shared"
    context_group: "team-alpha"
    continuity_mode: "deeper"
```

规则：

- `shared_resource_mode` 控制 commands、skills、agents、plugins 和 `settings.json`（`shared` 或 `profile-local`）
- `context_mode` 必须是 `isolated` 或 `shared`
- `context_group` 在 `context_mode=shared` 时是必需的
- `continuity_mode` 仅在 `context_mode=shared` 时有效（`standard` 或 `deeper`）
- 组规范化：trim、小写、内部空格 -> `-`
- 组必须以字母开头且仅包含 `[a-zA-Z0-9_-]`
- 最大长度：`64`

Deeper 连续性链接每个上下文组的这些目录：

- `session-env`
- `file-history`
- `shell-snapshots`
- `todos`

`.anthropic` 和账户凭证保持隔离。

## 跨 Profile 继承（API / CLIProxy / Copilot）

您可以明确地将非账户 profiles（包括 `default`）映射为重用账户 profile 的连续性产物：

```yaml
continuity:
  inherit_from_account:
    glm: pro
    gemini: pro
    copilot: pro
```

行为：

- 仅在运行 Claude 目标时适用（`ccs <profile>` 或 `--target claude`）
- 不改变 provider 凭证或 API 路由
- 在正常账户上下文策略解析后从映射账户 profile 重用 `CLAUDECONFIGDIR`
- 无效/缺失映射账户被安全跳过

### 恢复通道说明

恢复遵循活动的 `CLAUDECONFIGDIR`，而不仅仅是连续性组：

- plain `ccs -r` 恢复 plain `ccs` 当前正在使用的通道
- `ccs <account> -r` 仅恢复该账户通道
- 这两个命令可以指向不同的连续性清单

这意味着在账户上设置 `shared + deeper` **不会**自动使旧的 plain-`ccs` 恢复历史出现在 `ccs <account> -r` 内。

如果您希望未来的 plain `ccs` 会话使用账户通道，请执行以下操作之一：

```bash
ccs auth default work
```

或明确映射默认 profile：

```yaml
continuity:
  inherit_from_account:
    default: work
```

带有现有 `ck` 账户的示例：

```bash
ccs auth show ck
ccs auth backup default
ccs auth default ck
```

`ccs auth default ck` 使未来的 plain `ccs` 会话使用 `ck` 账户通道，因此未来的 `ccs` 和 `ccs ck` 从相同的本地清单恢复。它不会自动将旧的原生 `~/.claude/projects` 历史导入 `ck`；继续使用 `ccs -r` 用于旧原生通道，直到您有意迁移该本地历史。

## 用户工作流

### 带有共享上下文的新账户

```bash
ccs auth create work2 --share-context
ccs auth create backup --share-context --context-group sprint-a
ccs auth create backup2 --share-context --context-group sprint-a --deeper-continuity
```

### 现有账户

历史同步：

- 打开 `ccs config`
- 进入 `Accounts`
- 点击铅笔图标（`Edit History Sync`）
- 选择 `isolated` 或 `shared`，设置组，并（可选）选择 deeper 连续性

共享资源：

```bash
ccs auth resources work --mode profile-local
ccs auth resources work --mode shared
```

Dashboard：

- 打开 `ccs config`
- 进入 `Accounts`
- 使用 `Resources` 在 `shared` 和 `profile-local` 之间切换现有账户
- 进入 `Shared Resources` 检查共享 commands、skills、agents、plugins 和 `settings.json` 中心

此工作流不需要账户重新创建。

### 更改同步前备份

CCS 可以在您更改设置前备份本地连续性产物：

```bash
ccs auth backup work
ccs auth backup default
```

- `ccs auth backup work` 备份选定账户通道
- `ccs auth backup default` 备份 plain `ccs` 当前将使用的通道
- 这是本地连续性备份，不是所有上游 Claude 托管恢复状态的保证导出

## 当前限制

- 共享上下文是本地文件系统共享。它不会绕过远程 provider 权限模型。
- 会话连续性仍取决于上游工具/provider 存储和允许的内容。
- 仅应为您有意信任共享工作区历史的账户启用上下文共享。
- Dashboard 中共享资源检查是只读的。编辑各个文件仍属于拥有该文件的 command、skill、plugin 或设置表面。

## 替代方案：CLIProxy Claude Pool

对于更喜欢较低手动账户切换的用户，请使用 CLIProxy Claude pool：

- 通过 `ccs cliproxy auth claude` 认证池账户
- 在 `ccs config` -> `CLIProxy Plus` 中管理账户池行为

## 验证清单

- 确认账户行在 Dashboard Accounts 表中显示 `shared (<group>)`
- 在同一组中的账户之间切换并验证工作区连续性
- 如果符号链接/上下文健康看起来不一致，运行 `ccs doctor`
