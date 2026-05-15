# 为 CCS 做贡献

CCS 是一个基于 Bun + TypeScript 的 CLI，带有 React dashboard。本指南是进行干净变更的最短路径，无需先逆向工程整个仓库。

## 开始之前

- 中等或大的变更最好先开 issue，但小的修复和文档更新可以直接走 PR。
- 从 `dev` 创建分支。
- 向 `dev` 提交 PR。
- 使用 conventional commits。
- 如果变更涉及用户面向的行为，更新描述它的文档。
- 疑似安全漏洞不要通过公开 issue 处理。请使用 [SECURITY.md](./SECURITY.md)。

如果你对项目不熟悉，从文档修复、针对性 bug 修复或标记为 `good first issue` 的 issue 开始。

## 仓库地图

| 领域 | 主要路径 | 典型后续操作 |
| --- | --- | --- |
| CLI runtime | `src/`、`lib/`、`config/`、`scripts/` | 在 `tests/` 添加或更新测试 |
| Dashboard UI | `ui/src/` | 运行 `cd ui && bun run validate` |
| Web server 和 config API | `src/web-server/`、`src/api/`、`src/config/` | 添加单元或集成测试覆盖 |
| 文档 | `https://docs.ccs.kaitran.ca`、`README.md`、`docs/`、`CONTRIBUTING.md` | 保持用户面向的文档同步 |
| 静态资源 | `assets/` | 验证截图和引用仍然匹配 |

有用目录：

- `tests/unit/` 用于针对性逻辑测试
- `tests/integration/` 用于跨模块行为
- `tests/npm/` 用于打包检查
- `tests/native/` 用于 shell 和平台覆盖
- `docs/` 用于架构、路线图和内部实现笔记

## 环境设置

### 前置要求

- Node.js `>=18`
- Bun `>=1.0`
- GitHub CLI (`gh`)（如果你想从终端创建 PR）

### 克隆和安装

```bash
git clone https://github.com/YOUR_USERNAME/ccs.git
cd ccs
git remote add upstream https://github.com/kaitranntt/ccs.git

git checkout dev
git pull upstream dev

bun install
cd ui && bun install && cd ..
```

## 分支和 PR

从 `dev` 创建所有正常贡献分支。

```bash
git checkout dev
git pull upstream dev
git checkout -b feat/short-description
```

使用以下前缀：

- `feat/*` 用于新功能
- `fix/*` 用于 bug 修复
- `docs/*` 用于仅文档变更

规则：

- 永远不要直接提交到 `main` 或 `dev`。
- 向 `dev` 开 PR，不要向 `main`。
- 将 `hotfix/*` 视为从 `main` 开始的维护者专用紧急流程。
- 合并后删除你的分支。

## CI 和发布流程

CCS 现在使用三条独立的自动化通道：

- `CI` 在 PR 到 `dev` 和 `main` 时运行。这是贡献者分支的 review 关卡。
- `Push CI` 在合并到 `dev` 后运行。这是共享 `dev` 分支的代码质量信号。
- `Dev Release` 在 `dev` 变更合并后发布 `@dev` 包。这是发布自动化，不是主要的贡献者质量信号。

如果 `Dev Release` 是红色的但你的 PR checks 是绿色的，在假设合并的代码坏了之前，先检查 `Push CI`。

如果 `CI` 或 `Push CI` 长时间排队，这是维护者基础设施问题，不是贡献者的错误。在你的 PR 上留言，维护者会处理。

## AI Agent 规则

`CONTRIBUTING.md` 是人类入口。对于在这个仓库工作的 AI agents，权威的自动化和工作流规则在 [CLAUDE.md](./CLAUDE.md) 中。

## AI Review 通道

CCS PR review 不再依赖 `anthropics/claude-code-action`。仓库 review 通道是自托管的 PR-Agent：

- 保留的 `.github/workflows/ai-review.yml` 在 GitHub Actions 中运行 PR-Agent。
- 当你在 follow-up commits 后需要新一轮 review 时，在 PR 上使用 `/review`。
- 只有受信任的 `/review` 评论路径是启用的。
- 在根目录的 `.pr_agent.toml` 中保留仓库级 reviewer 说明。
- 在 `ai-review.yml` 中保留运行时接线 和默认值，它仍然将现有的 `AI_REVIEW_BASE_URL`、`AI_REVIEW_MODEL` 和 `AI_REVIEW_API_KEY` 集成映射到 PR-Agent 的 `OPENAI.*` 和 `config.*` 设置。
- 如果你改变了 review 默认值，在同一个 PR 中更新工作流或 `.pr_agent.toml` 以及贡献者或架构文档。

示例：

```bash
git push -u origin docs/contributing-refresh
gh pr create --base dev --title "docs(contributing): refresh contributor guide"
```

## 本地开发

### 安全的测试环境

CCS 在 `~/.ccs/` 下读写。开发时不要针对你的真实配置进行测试。

Unix：

```bash
export CCS_HOME="$(mktemp -d)"
```

PowerShell：

```powershell
$env:CCS_HOME = Join-Path $env:TEMP ("ccs-" + [guid]::NewGuid())
```

如果你修改了读取 CCS 路径的代码，通过 `src/utils/config-manager.ts` 中的 `getCcsDir()` 来路由，这样测试能保持隔离。

### 常见工作流

```bash
bun run build            # 编译 CLI
bun run dev              # 构建 server 并启动本地 config dashboard
bun run dev:symlink      # 将全局 ccs 指向本地构建
bun run dev:unlink       # 恢复原始全局 ccs
cd ui && bun run dev     # 仅 Dashboard 的 dev server
```

在 `ccs config` 后面处理本地 dashboard 体验时，从仓库根目录使用 `bun run dev`。

## 验证

在开或更新 PR 之前，运行这个快速的本地关卡：

```bash
bun run format
bun run lint:fix
bun run validate
```

`bun run validate` 是日常贡献者关卡。它运行：

- `typecheck`
- `lint`
- `format:check`
- `test:fast`

在请求 review 之前，或者当你想要最接近 PR CI 的本地等价物时，运行：

```bash
bun run validate:ci-parity
```

`bun run validate:ci-parity` 额外添加：

- 针对 `origin/dev` 或 `origin/main` 的分支新鲜度检查
- `build:all`
- 通过 `test:all` 运行完整非 e2e 测试套件
- 使用 `CCS_E2E_SKIP_BUILD=1` 运行 `test:e2e`

如果你改了 dashboard，也运行 UI 关卡：

```bash
cd ui
bun run format
bun run validate
```

有用的针对性命令：

```bash
bun run test:unit
bun run test:all
bun run test:native
bun run test:e2e
```

如果你涉及命令路由、代理流程、发布自动化或工作流接线，并且想复现 PR CI 运行的相同 CLI e2e 通道，在 review 前本地使用 `bun run test:e2e`。

### 为什么 CI 失败了？

| 症状 | 可能原因 | 修复 |
| --- | --- | --- |
| PR CI 中 `format` 失败 | 本地跳过了 `bun run format` | 运行 `bun run format`，重新提交，再推送 |
| PR CI 中 `lint` 失败 | `validate` 现在使用只读 `lint` | 运行 `bun run lint:fix`，然后重新运行 `bun run validate` |
| PR CI 中 `test` 失败但 `validate` 通过 | 失败在 `test:slow` 或 `test:e2e` | 本地运行 `bun run validate:ci-parity` |
| Checks 排队超过 10 分钟 | 自托管 runner 离线 | 等待维护者介入；重新运行通常没有帮助 |
| 合并到 `dev` 后 `Dev Release` 是红色 | 仅发布失败或发布问题 | 先检查 `Push CI` 以确认代码质量 |

如果你无法运行完整套件，对于早期或仅文档的 PR 这也没关系。只要在 PR 中说明你运行了什么，或者什么阻止了你。

## 你的变更需要更新什么

### 如果你改变了 CLI 行为

- 更新 `src/commands/` 中相关的 `--help` 输出。
- 在 `tests/` 中添加或更新自动化覆盖。
- 如果用户工作流变了，更新 `README.md`。

### 如果你改变了 dashboard 行为

- 在功能同时支持 CLI 和 dashboard 的地方保持 parity。
- 更新 `ui/src/` 和任何受影响的测试。
- 从 `ui/` 运行 UI 验证。

### 如果你改变了配置、providers 或架构

- 更新 `docs/` 中的相关文档。
- 在 PR 中提及迁移或兼容性说明。
- 如果变更影响自动化 PR review 行为，同时更新 `ai-review.yml` 或 `.pr_agent.toml` 指导。

## 提交风格

CCS 使用 conventional commits，因为发布和工作流工具依赖它们。

```bash
git commit -m "fix(doctor): handle missing config gracefully"
git commit -m "feat(cliproxy): add provider quota check"
git commit -m "docs(contributing): simplify contributor workflow"
```

避免：

```bash
git commit -m "fix stuff"
git commit -m "WIP"
git commit -m "update file"
```

## 发布说明

发布是通过 semantic-release 自动化的。

- 合并到 `dev` 发布 `@dev` 频道。
- 合并到 `main` 发布 `@latest` 频道。
- 不要手动 bump 版本、创建 tags 或运行手动 `npm publish`。

## 安全报告

如果你认为发现了安全漏洞，不要开公开的 GitHub issue。

请使用 [SECURITY.md](./SECURITY.md) 中的私人报告路径：

- https://github.com/kaitranntt/ccs/security/advisories/new

公开 issue 适用于正常的 bug、regression、文档问题和功能请求。不适用于漏洞利用细节、泄露的凭证或任何可能在修复发布前让用户面临风险的事情。

## 需要帮助？

- Bugs 和功能：https://github.com/kaitranntt/ccs/issues
- 问题：https://github.com/kaitranntt/ccs/issues/new/choose
- 安全报告：https://github.com/kaitranntt/ccs/security/advisories/new
- 托管文档：https://docs.ccs.kaitran.ca
- 用户面向的文档：[README.md](./README.md)
- 内部架构笔记：[docs/](./docs)
- 社区期望：[`.github/CODE_OF_CONDUCT.md`](./.github/CODE_OF_CONDUCT.md)
