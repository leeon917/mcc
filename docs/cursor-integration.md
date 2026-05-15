# Cursor IDE 集成

本指南涵盖已弃用的 CCS 所有 Cursor IDE 桥接，包括认证导入、本地 daemon 生命周期、实时探测检查和 dashboard 控制。

`ccs cursor` 现在属于 CLIProxy 支持的 Cursor provider 路径。
使用 `ccs legacy cursor` 访问此处记录的传统本地桥接。

## 它提供什么

- 由 Cursor 凭证驱动的 OpenAI 兼容本地端点。
- 用于 Claude 原生客户端的 `/v1/messages` 上的 Anthropic 兼容本地端点。
- 通过本地 CCS daemon 的 Cursor 模型列表和聊天补全。
- 专用 dashboard 页面：`ccs config` -> `Deprecated` -> `Cursor IDE (Legacy)`。

## 此运行时实际做什么

`ccs legacy cursor` 不会启动 Cursor IDE 本身。

当前工作流程是：
1. 从本地 SQLite 或手动输入导入 Cursor 凭证
2. 在 `127.0.0.1:<port>` 上运行本地 CCS daemon
3. 针对该 daemon 启动 Claude Code
4. 让 CCS 将请求转换到 Cursor 上游

将其视为 CCS 管理的 Cursor 桥接，而不是通用的 CLIProxy 支持的 provider 路径。

## 前置条件

- Cursor IDE 已安装并登录。
- CCS 已安装并配置（`ccs config` 可用）。
- 对于 macOS/Linux 上的自动检测认证：PATH 中可用的 `sqlite3`。

## CLI 工作流程

### 1) 启用集成

```bash
ccs legacy cursor enable
```

### 2) 导入凭证

从 Cursor 本地 SQLite 状态自动检测：

```bash
ccs legacy cursor auth
```

手动回退：

```bash
ccs legacy cursor auth --manual --token <token> --machine-id <machine-id>
```

### 3) 启动 daemon

```bash
ccs legacy cursor start
```

### 4) 运行实时探测

```bash
ccs legacy cursor probe
```

使用此命令验证当前构建可以通过本地 daemon 完成一个真实的已认证请求。

### 5) 运行基于 Cursor 的 Claude

```bash
ccs legacy cursor "explain this repo"
```

### 6) 验证状态

```bash
ccs legacy cursor status
```

使用 `ccs legacy cursor` 和裸或普通 Claude 参数通过本地 Cursor 代理运行。
管理命名空间仍然可用于设置和检查：

```bash
ccs legacy cursor help
```

### 7) 停止 daemon

```bash
ccs legacy cursor stop
```

## 支持的 Cursor Provider 路径

对于支持的 CLIProxy 支持的 Cursor provider，使用：

```bash
ccs cursor --auth
ccs cursor --accounts
ccs cursor --config
ccs cursor "task"
```

## 运行时默认值

- 默认端口：`20129`
- `ghost_mode`：启用
- `auto_start`：禁用
- 模型列表解析：可用时通过已认证的实时获取，带缓存/默认回退。
- 请求模型验证：如果请求的模型不在可用的 Cursor 模型目录中，daemon 回退到解析的默认模型。
- Daemon API 表面：`POST /v1/chat/completions`、`POST /v1/messages` 和 `GET /v1/models`。
- 实时验证：`ccs legacy cursor probe` 或 `POST /api/cursor/probe`

这些值在统一配置中管理，可从 CLI 或 dashboard 更新。

## Dashboard 使用

打开 dashboard：

```bash
ccs config
```

然后导航到 `Deprecated` 部分中的 `Cursor IDE (Legacy)`。

可用控制：

- 集成开关（`enabled`）
- 认证操作（自动检测、手动导入）
- Daemon 操作（启动/停止）
- 运行时配置（端口、自动启动、ghost 模式）
- 模型列表，带大目录的可搜索组合框过滤
- `~/.ccs/cursor.settings.json` 的原始编辑器

## 原始设置和统一配置同步

原始设置存储在：

`~/.ccs/cursor.settings.json`

当原始设置包含本地 `ANTHROPIC_BASE_URL` 端口覆盖时，CCS 将该端口同步回统一配置，以便 CLI 和 dashboard 保持一致。

## 故障排除

### `ccs cursor status` 中显示 `Not authenticated` 或 `expired`

- 重新运行 `ccs legacy cursor auth`（或手动认证命令）。

### 即使状态为绿色，`ccs legacy cursor probe` 失败

- `status` 仅证明本地配置/认证/daemon 就绪。
- `probe` 证明实时运行时路径。
- 如果 `probe` 因上游协议错误而失败，首先检查当前 CCS 构建，而不是假设本地 daemon 是健康的。

### 自动检测失败

- 确保 Cursor 已登录。
- 确认 `sqlite3` 已安装或使用手动导入。
- 如有需要，使用手动认证导入。

### Daemon 启动失败

- 检查端口 `20129` 是否被占用。
- 在 dashboard 配置选项卡中更改端口，然后重试 `ccs legacy cursor start`。
