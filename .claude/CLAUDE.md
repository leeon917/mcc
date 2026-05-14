-- Active: 1768900505806@@1.94.118.252@3306@chat_service
# MCC - My Cloud Code

## 项目概述

MCC 是一个轻量级的多账号切换工具，用于在多个 Claude Code 账号（不同 API Provider）之间快速切换。

核心功能：
- 多账号管理（deepseek、qwen、glm、km、mm、anthropic）
- 直接 API 模式（无需本地 proxy）
- MCP 工具支持（WebSearch、ImageAnalysis）
- 每个账号独立的 `CLAUDE_CONFIG_DIR` 隔离

## 设计原则

- **KISS**：简单直接，不用 OAuth，不用本地 proxy
- **File-based**：API Key 存在 `~/.mcc/accounts/<name>/.key`
- **YAGNI**：只做需要的功能

## 目录结构

```
src/
├── mcc.ts                    # CLI 入口
├── accounts/
│   ├── store.ts              # 账号元数据存储
│   └── instance-manager.ts   # CLAUDE_CONFIG_DIR 隔离
├── core/
│   └── model-router.ts       # 模型路由（复用 provider-preset-catalog）
├── mcp/
│   ├── registry.ts           # MCP 服务器注册表
│   └── installer.ts          # MCP 安装到 instance
└── shared/
    └── provider-preset-catalog.ts  # 模型 preset（从 CCS 复制）
lib/
├── mcp/                      # MCP server JS 文件
│   ├── mcc-websearch-server.cjs
│   └── mcc-image-analysis-server.cjs
└── mcp-hooks/                # WebSearch hooks
    ├── websearch-transformer.cjs
    └── image-analysis-runtime.cjs
```

## 存储结构

```
~/.mcc/
├── accounts.json             # 账号元数据
├── accounts/                 # per-account
│   └── <name>/.key          # API key
├── instances/                # per-account isolated dirs
│   └── <name>/
│       ├── .mcp/mcpServers.json
│       └── (CLAUDE_CONFIG_DIR subdirs)
└── mcp/                     # bundled MCP servers
```

## 开发

```bash
npm install
npm run build
npm run dev -- help
```

## MCP 工具

内置两个 MCP server：
- `mcc-websearch` - Web 搜索（Exa/Tavily/Brave/DuckDuckGo）
- `mcc-image-analysis` - 图片分析

通过 `MCC_WEBSEARCH_*` / `MCC_IMAGE_ANALYSIS_*` 环境变量配置。

## 记忆索引

- `docs/product.md` — 理解产品意图和范围时读
- `docs/decisions.md` — 做架构 / 选型决策前先看有无先例
- `docs/lessons.md` — 遇到诡异现象时优先 grep，可能已有人踩过

<!-- BEGIN: PROJECT MEMORY PROTOCOL (injected by project-memory-init skill) -->

## 项目记忆维护协议

本项目维护三份长期记忆文件：

- `docs/product.md` — 当前产品是什么、为谁做、不做什么（滚动更新）
- `docs/decisions.md` — 重大技术决策的追加式记录（只增不改）
- `docs/lessons.md` — 踩过的坑与教训（追加为主，修复后剪枝）

### 时间戳规范

追加到 `decisions.md` / `lessons.md` 以及任何归档注释块的条目标题，**必须**使用 `YYYY-MM-DD HH:MM:SS +TZ` 格式（24 小时制 + 时区），例：`2026-04-25 14:30:45 +08:00`。不要只写日期。

**为什么**：本项目可能同时开多个 git worktree 改同一份记忆文件，仅凭日期无法稳定排序——合并时容易冲突，错误记录也无法对回到当时的代码状态。

**读取时以时间戳为准，不要以文件中出现的顺序为准**：worktree 合并 / 并行追加 / Claude 误插位置等场景下，新条目可能落在文件中较旧条目之后但实际时间更早。判断"哪条最新 / 谁 supersede 谁 / 同一天的先后"一律看 header 里的时间戳，**不要**靠文件位置推断。位置错乱按 `decisions.md` 的「只增不改」原则不主动重排——动既往位置反而违反追加式协议。

**获取当前时刻**：

- bash：`date "+%Y-%m-%d %H:%M:%S %:z"`
- PowerShell：`Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"`

`product.md` 是滚动更新文件，不受此规范约束。

### 在以下情况主动提议沉淀

1. **做出非平凡的技术决策**（选型、架构变更、推翻旧方案、引入新依赖）→ 提议追加到 `decisions.md`
2. **修复一个花了 30 分钟以上才定位的 bug** → 提议追加到 `lessons.md`
3. **用户说"砍掉 X 特性" / "改成 Y 方案" / "这个方向不对"** → 提议更新 `product.md`
4. **发现代码里有"看起来奇怪但其实有原因"的地方** → 提议追加到 `lessons.md`

**提议方式**：给出**具体的文字草稿**，不要只问"要不要记"。让用户直接回复"记"或"不用"。

**决定权在用户**：说"记"则写入，说"不用"则跳过。**绝不自作主张更新文件**。

### `.claude/CLAUDE.md` 与 `README.md` 同步检查

`decisions.md` / `lessons.md` 沉淀**历史**；`.claude/CLAUDE.md` 和 `README.md` 描述**当前状态**——前者给未来的 Claude 读，后者给人类读。两份"门面文档"最容易悄悄落后于代码。

**触发时机**：上面四类触发里的 #1（非平凡技术决策）和 #3（方向性变化）发生时——简单说，**任何值得写进 `decisions.md` 或改动 `product.md` 的变化**，都要顺带跑一次本节的检查。

**检查做什么**：

1. 把这次的变化摘出来
2. 对照读 `.claude/CLAUDE.md` 和 `README.md`（两份都看，不是二选一）
3. 找三类不一致：
   - **事实相矛盾**（例："技术栈 = X" 但实际已切成 Y）
   - **功能说明指向已删功能**（例：README 还在教装某个已撤掉的模块）
   - **漏记新能力**（例：新增了 `install.sh`、新目录、新脚本，文件结构树没补）
4. 有不一致时，**分别**给出 `.claude/CLAUDE.md` 和 `README.md` 的修改草稿让用户确认——两份受众和粒度不同，不要套用同一份草稿
5. 两份都没问题也要**明确说一句**"CLAUDE.md / README.md 已核对，无需改动"，避免"默默跳过"让用户不确定你查没查

**边界**：

- `decisions.md` 记"为什么做这个决策"；`.claude/CLAUDE.md` / `README.md` 记"当前是什么状态"。同一变化在多处出现是正常的，角度不同
- 不要把决策的背景 / 选项 / 代价抄到 CLAUDE.md 或 README.md 里，**只抄结论**（当前事实）
- 没有实际变化就不改——不要为了"看起来在维护"做无意义修订

### 以下情况不要记录

- 小 bug、typo、无需思考就能修的问题
- 事后看来显然的决策（"obvious in retrospect"）
- 可以直接从代码看出的事实
- 临时讨论、没落地的想法

### 会话状态不落盘

"当前在做什么 / 卡在哪 / 下一步做什么"是会话状态，不是项目记忆——留在对话里，不写进任何文件。

### 各文件的变更模式

- `product.md`：滚动更新。方向有较大调整时重写对应章节。
- `decisions.md`：**追加式，只增不改**。历史决策永远不修改；如被推翻，新建条目并在其中引用旧条目（如 "Supersedes 2026-01-15 14:30:45 +08:00 的条目"）。
- `lessons.md`：追加为主。坑被彻底修复后可剪枝对应条目；有长期警示价值的保留。

<!-- END: PROJECT MEMORY PROTOCOL -->
