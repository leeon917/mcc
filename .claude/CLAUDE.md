# MCC - My Cloud Code

## 项目概述

MCC 是一个轻量级多账号切换工具，用于在多个 Claude Code 账号（不同 API Provider）之间快速切换。

核心功能：
- 多 profile 管理（deepseek、qwen、glm、km、mm、xiaomi-mimo、anthropic）
- 直接 API 模式和 OpenAI 兼容模式（自动翻译 proxy）
- MCP 工具支持（WebSearch、ImageAnalysis）
- 每个 profile 独立的 `CLAUDE_CONFIG_DIR` 隔离
- 跨 profile 共享 skills/commands/agents/plugins/settings

## 设计原则

- **KISS**：简单直接，不用 OAuth
- **File-based**：API Key 存 `~/.mcc/profiles/<name>/.key`
- **YAGNI**：只做需要的功能

## 目录结构

```
src/
├── mcc.ts                      # CLI 入口
├── accounts/
│   ├── store.ts                # Profile 元数据存储
│   ├── instance-manager.ts     # CLAUDE_CONFIG_DIR 隔离
│   └── shared-manager.ts       # 跨 instance 共享目录（symlink）
├── core/
│   └── model-router.ts         # Profile env 构建 + tiered model
├── mcp/
│   ├── registry.ts             # MCP 服务器注册表（内置）
│   ├── installer.ts            # MCP 安装到 instance
│   ├── external-registry.ts    # 外部 MCP 注册表
│   └── mcp-config.ts           # WebSearch/ImageAnalysis provider 配置
├── proxy/
│   ├── proxy-server.ts         # OpenAI→Anthropic 翻译服务器
│   ├── proxy-daemon.ts         # Proxy 生命周期管理
│   ├── proxy-entry.ts          # Proxy 进程入口
│   ├── proxy-paths.ts          # PID/session 文件路径
│   └── upstream-url.ts         # upstream URL 解析
├── dashboard-server.ts          # Express Dashboard API
└── shared/
    ├── logger.ts               # 日志系统（session-based，logrotate）
    └── provider-preset-catalog.ts

lib/
├── mcp/                        # MCP server JS 文件
│   ├── mcc-websearch-server.cjs
│   └── mcc-image-analysis-server.cjs
├── mcp-hooks/                  # MCP 运行时 hook
│   ├── image-analysis-runtime.cjs
│   ├── image-analyzer-transformer.cjs
│   └── websearch-transformer.cjs
└── shared/
    └── logger.cjs
```

## 存储结构

```
~/.mcc/
├── profiles.json               # Profile 元数据
├── profiles/                  # per-profile
│   └── <name>/.key           # API key
├── instances/                 # per-profile isolated dirs
│   └── <name>/
│       ├── .claude.json       # Claude Code 实际读取的 MCP 配置
│       ├── .mcp/mcpServers.json  # 参考副本
│       └── (CLAUDE_CONFIG_DIR subdirs)
├── mcp/                       # 内置 MCP server 文件
├── mcp-hooks/                 # MCP runtime hook 文件
├── external-mcp-servers.json  # 用户添加的外部 MCP 定义
├── mcp-config.json            # WebSearch/ImageAnalysis provider 配置
├── proxy/                     # Proxy PID/session 文件
└── logs/                      # 运行时日志（功能→时间两级分区）
    └── <profile>/
        ├── sessions/<YYYY-MM-DD_HH-MM-SS>/mcc.log  # 每次 mcc launch 一个目录
        └── proxy/<YYYY-MM-DD>/mcc.log               # proxy daemon，按天分目录
```

## 排查 Bug

遇到 MCC 运行时问题时，使用本项目的 `mcc-debug` skill（`.claude/skills/mcc-debug/SKILL.md`）：它会自动定位相关日志、区分错误类型、给出修复建议。

**快速入口**：
```bash
# 查看最新 session 日志（主进程）
cat ~/.mcc/logs/<profile>/sessions/$(ls -t ~/.mcc/logs/<profile>/sessions/ | head -1)/mcc.log

# 查看 proxy 日志（openai 协议 profile 专有）
cat ~/.mcc/logs/<profile>/proxy/$(ls -t ~/.mcc/logs/<profile>/proxy/ | head -1)/mcc.log

# 开 debug 级别，看发给上游的完整请求体
MCC_LOG_LEVEL=debug mcc <profile>
```

## 开发

```bash
pnpm install
pnpm build           # tsc
pnpm mcc help        # 跑 CLI（pnpm 直接透传 args，无需 --）
pnpm build:ui        # 构建 React Dashboard
pnpm dashboard       # 编译 + 启动 Dashboard（端口 3000）
```

## CLI 命令

```bash
mcc <profile> [args...]          # 用指定 profile 启动 Claude Code
mcc profile add <name>           # 添加 profile
mcc profile list                 # 列出所有 profile
mcc profile remove <name>        # 删除 profile
mcc profile default [name]       # 查询或设默认 profile
mcc profile test [name...] [--vision]  # 体检 profile：验 key/余额，--vision 测主模型识图
mcc mcp list                     # 列出所有 MCP server
mcc mcp add --name <id> --command <cmd> [--display-name...] [--args...] [--provider-ref...]  # 添加外部 MCP
mcc mcp remove <name>           # 删除外部 MCP
mcc mcp enable <name> <profile> # 在指定 profile 启用外部 MCP
mcc mcp disable <name> <profile> # 在指定 profile 禁用外部 MCP
mcc config                       # 打开 Web 配置控制台（端口 3000）
mcc help                         # 显示帮助
```

## Profile 与 Protocol

每个 profile 支持 `protocol: 'anthropic'`（默认，直接 API）或 `protocol: 'openai'`（通过翻译 proxy）。

OpenAI 兼容 profile 启动时自动在 `127.0.0.1:43456-43555` 范围内启动一个 OpenAI→Anthropic 翻译 proxy，Claude Code 的请求经过本地 proxy 转发给 upstream OpenAI-compatible API。

## MCP 工具

内置两个 MCP server：
- `mcc-websearch` - Web 搜索（Bocha/MiniMax/Exa/Tavily/Brave/DuckDuckGo/SearXNG，按可用性 fallback）
- `mcc-image-analysis` - 图片分析（OpenAI / Anthropic 两种 vision 格式，provider 在 mcp-config.json 配置）

外部 MCP 通过 `mcc mcp add` 注册，支持 `${MCC_PROVIDER_KEY:<providerId>}` 引用 `mcp-config.json` 里配置的 API key。

MCP provider 配置在 `~/.mcc/mcp-config.json`。

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

追加到 `decisions.md` / `lessons.md` 以及任何归档注释块的条目标题，**必须**使用 `YYYY-MM-DD HH:MM:SS +00:00` 格式（24 小时制 + UTC），例：`2026-04-25 21:30:45 +00:00`。不要只写日期。

**时区一律用 UTC（协调世界时），偏移量恒为 `+00:00`，不跟本机时区走，也无夏令时切换**。

**为什么**：(1) 本项目可能同时开多个 git worktree 改同一份记忆文件，仅凭日期无法稳定排序——合并时容易冲突，错误记录也无法对回到当时的代码状态；(2) worktree / PR 可能从不同时区的机器上合并，统一钉成 UTC 这一个零偏移基准才能跨机器正确排序、无夏令时歧义，PR 合并时也按这个基准判断先后。

**读取时以时间戳为准，不要以文件中出现的顺序为准**：worktree 合并 / 并行追加 / Claude 误插位置等场景下，新条目可能落在文件中较旧条目之后但实际时间更早。判断"哪条最新 / 谁 supersede 谁 / 同一天的先后"一律看 header 里的时间戳，**不要**靠文件位置推断。位置错乱按 `decisions.md` 的「只增不改」原则不主动重排——动既往位置反而违反追加式协议。

**获取当前时刻（一律取 UTC，不取本机时区）**：

- bash（Linux / Mac / Windows Git Bash 均可）：`date -u "+%Y-%m-%d %H:%M:%S +00:00"`（`-u` 强制 UTC，跨平台一致，不依赖 tzdata）
- PowerShell（Windows）：`[DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm:ss") + " +00:00"`

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

### 归档约定（被取代的旧文档放哪）

凡是被新文件取代但仍有历史参考价值的旧文档（旧 PRD、过时架构说明、被推翻的规划等），统一放到 **`docs/archive/`** 目录下，不要与现役文档平级存放。

规则：

1. **归档目录**：`docs/archive/`（不存在就先 `mkdir -p` 创建）
2. **文件名加归档时间戳后缀**：`<原文件名>.<YYYY-MM-DDTHHMMSSZ>.<ext>`（UTC，文件名内不用冒号）
   - 例：`docs/old-PRD.md` → `docs/archive/old-PRD.2026-06-24T141806Z.md`
3. **用 `git mv` 移动**（保留版本历史）；不在 git 仓库才用普通 `mv`
4. **在归档文件顶部插入 HTML 注释块**，必须包含「归档时间」「归档来源 → 归档后路径」「与现役实现的出入点」三块信息
5. **更新引用**：CLAUDE.md 记忆索引或其他文档指向过旧路径的，改指到归档目录或去掉条目

### 以下情况不要记录

- 小 bug、typo、无需思考就能修的问题
- 事后看来显然的决策（"obvious in retrospect"）
- 可以直接从代码看出的事实
- 临时讨论、没落地的想法

### 会话状态不落盘

"当前在做什么 / 卡在哪 / 下一步做什么"是会话状态，不是项目记忆——留在对话里，不写进任何文件。

### 各文件的变更模式

- `product.md`：滚动更新。方向有较大调整时重写对应章节。
- `decisions.md`：**追加式，只增不改**。历史决策永远不修改；如被推翻，新建条目并在其中引用旧条目（如 "Supersedes 2026-01-15 06:30:45 +00:00 的条目"）。
- `lessons.md`：追加为主。坑被彻底修复后可剪枝对应条目；有长期警示价值的保留。

<!-- END: PROJECT MEMORY PROTOCOL -->
