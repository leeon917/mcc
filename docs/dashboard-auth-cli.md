# Dashboard 认证 CLI

最后更新：2026-05-05

用于管理 CCS dashboard 认证的 CLI 命令。

## 概述

CCS dashboard（`ccs config`）可以用用户名/密码认证保护。当 dashboard 可从另一台设备访问时，这很有用，包括运行时默认绑定是网络可访问的，或者当您使用 `ccs config --host 0.0.0.0` 明确绑定到回环之外时。

认证**默认禁用**以保持向后兼容性。使用 CLI 配置和启用它。

CCS **不提供默认的 dashboard 用户名或密码**。当某人从非回环/IP 地址打开 dashboard 且认证未启用时，UI 现在显示设置状态而不是模糊的登录表单。主机所有者必须运行 `ccs config auth setup`，或者如果用户在同一台机器上则应切换回 localhost URL。

Docker 注意：集成的 `ccs docker` 堆栈将其配置存储在运行中的容器卷内，而不是在外层 shell 的 `~/.ccs` 中。对于 Docker 部署，在容器内运行认证设置：

```bash
docker exec -it ccs-cliproxy ccs config auth setup
```

当认证保持禁用时，CCS 现在对敏感管理端点应用 localhost 仅限回环的回退。远程设备仍可以在有意绑定到回环之外时打开 dashboard UI，但写能力路由（如 AI Provider 管理和 CLIProxy 认证/状态辅助）在您启用 dashboard 认证之前拒绝非回环请求。

## 账户上下文模式（相关功能）

Dashboard 认证和账户上下文元数据是分开的：

- `dashboard_auth`：用用户名/密码保护 dashboard 访问
- `accounts.<name>.context_mode/context_group`：控制隔离与共享账户上下文
- `accounts.<name>.shared_resource_mode`：控制 plugins/commands/skills/agents/settings.json 共享

账户上下文是隔离优先的。推荐的双账户路径是：

```bash
ccs auth create work
ccs auth create personal

ccs work
ccs personal
```

仅在两个账户应共享本地连续性而 token 保持分开时启用历史同步：

| 模式 | 默认 | 要求 |
|------|---------|-------------|
| `isolated` | 是 | 不需要 `context_group` |
| `shared` | 否（可选加入） | 有效非空 `context_group` |

共享连续性深度：

- `standard`（默认）：仅共享项目工作区上下文
- `deeper`（高级可选加入）：还同步 `session-env`、`file-history`、`shell-snapshots`、`todos`

`ccs auth show <profile>` 报告凭证隔离、共享资源模式、设置同步状态、历史通道，以及 plain `ccs` 当前是否使用相同的恢复通道。

非裸账户 profiles 与原生 Claude 共享 Claude 本地资源：

```text
~/.ccs/instances/<profile>/settings.json -> ~/.ccs/shared/settings.json -> ~/.claude/settings.json
```

这使普通 Claude Code 设置、plugins、commands、skills 和 agents 无需复制 account tokens 即可同步。现有账户可以退出或重新加入：

```bash
ccs auth resources work --mode profile-local
ccs auth resources work --mode shared
```

本地历史是分开的：如果用户希望未来的 plain `ccs` 和 `ccs ck` 会话从同一账户通道恢复，使用 `ccs auth backup default` 备份当前原生通道后运行 `ccs auth default ck`。

`context_group` 规范化和验证：

- trim + 小写 + 内部空白折叠为 `-`
- 允许的字符：小写字母、数字、`_`、`-`
- 必须以字母开头
- 最大长度：64
- shared 模式需要规范化后非空值
- `continuity_mode` 仅在模式为 `shared` 时有效

`PUT /api/config` 对账户上下文的行为：

- 拒绝无效的统一 payload
- 拒绝带有无效/空 `context_group` 的显式 `context_mode: shared`
- 拒绝无效的 `continuity_mode` 值
- 保存前规范化有效的共享 `context_group`
- 缺失的共享 `continuity_mode` 默认为 `standard`
- 当模式不是 `shared` 时拒绝 `context_group`
- 当模式不是 `shared` 时拒绝 `continuity_mode`

Dashboard 账户上下文编辑：

- `PUT /api/accounts/:name/context` 更新现有认证账户的上下文模式/组/连续性
- 为此路由拒绝 CLIProxy OAuth 账户密钥
- 应用上述规范化/验证规则

共享资源编辑：

- `PUT /api/accounts/:name/shared-resources` 更新现有认证账户的 `shared_resource_mode`
- 仅接受 `shared` 或 `profile-local`
- 为此路由拒绝 CLIProxy OAuth 账户密钥
- 元数据更新后协调账户实例
- Dashboard -> Accounts 将此作为单独的资源操作公开，因此不会与历史同步混淆
- Dashboard -> Shared Resources 显示 commands、skills、agents、plugins 和 `settings.json` 的共享中心清单
- Plugins 选项卡是注册表方向的：已安装的 plugin 条目来自 `installed_plugins.json`，而内部缓存/数据/市场文件夹保持隐藏，除非存在真实的 plugin 条目
- 共享 `settings.json` 在 Shared Resources 页面中是只读的，仍通过拥有这些值的设置界面编辑

## 命令

### `ccs config auth setup`

配置 dashboard 登录的交互向导。

```bash
$ ccs config auth setup

╭─────────────────────────────────╮
│  Dashboard Auth Setup           │
╰─────────────────────────────────╯

[i] Configure username and password for dashboard access.
    Password will be hashed with bcrypt before storage.

Username
Enter username: admin

Password
    Minimum 8 characters
Enter password: ********
Confirm password: ********

[i] Hashing password...

[OK] Dashboard authentication configured

[i] Settings saved to ~/.ccs/config.yaml
[i] Username: admin
[i] Session timeout: 24 hours

    Start dashboard: ccs config
    Show status: ccs config auth show
    Disable auth: ccs config auth disable
```

### `ccs config auth show`

显示当前认证状态。

```bash
$ ccs config auth show

╭─────────────────────────────────╮
│  Dashboard Auth Status          │
╰─────────────────────────────────╯

Configuration
[OK] Authentication: Enabled
[OK] Username: admin
[i] Session timeout: 24 hours

Commands
  ccs config auth setup     Configure authentication
  ccs config auth disable   Disable authentication
  ccs config                Open dashboard
```

### `ccs config auth disable`

禁用 dashboard 认证并确认。

```bash
$ ccs config auth disable

╭─────────────────────────────────╮
│  Disable Dashboard Auth         │
╰─────────────────────────────────╯

[!] This will disable login protection for the dashboard.
[i] Anyone with network access will be able to view the dashboard.

Disable authentication? [y/N]: y

[OK] Dashboard authentication disabled

[i] Credentials preserved - re-enable with: ccs config auth setup
```

### `ccs config auth --help`

显示使用信息。

## 环境变量

环境变量覆盖 `config.yaml` 值：

| 变量 | 描述 |
|----------|-------------|
| `CCS_DASHBOARD_AUTH_ENABLED` | 启用/禁用认证（`true`/`false`） |
| `CCS_DASHBOARD_USERNAME` | 用户名 |
| `CCS_DASHBOARD_PASSWORD_HASH` | Bcrypt 密码哈希 |

### 生成密码哈希

使用 bcrypt 生成哈希：

```bash
# Using Node.js
node -e "console.log(require('bcrypt').hashSync('your-password', 10))"

# Using npx
npx bcrypt-cli hash "your-password"
```

## 配置

设置存储在 `~/.ccs/config.yaml`：

```yaml
# Dashboard Auth: Optional login protection for CCS dashboard
# Generate password hash: npx bcrypt-cli hash "your-password"
# ENV override: CCS_DASHBOARD_AUTH_ENABLED, CCS_DASHBOARD_USERNAME, CCS_DASHBOARD_PASSWORD_HASH
dashboard_auth:
  enabled: true
  username: "admin"
  password_hash: "$2b$10$..."
  session_timeout_hours: 24
```

## 安全注意事项

1. **Bcrypt 哈希**：密码在存储前用 bcrypt（10 轮）哈希
2. **Session cookies**：Sessions 使用 HTTP-only cookies（JavaScript 无法访问）
3. **速率限制**：登录尝试被速率限制（每 15 分钟 5 次）
4. **失败关闭的远程写入**：当认证禁用时，敏感管理路由仅允许 localhost
5. **文件权限**：配置文件以 0o600 权限创建

## 故障排除

### "Authentication not configured"

运行 `ccs config auth setup` 配置凭证。

如果您使用的是集成的 Docker 堆栈，在 ccs-cliproxy 内部运行该命令。在外层 host shell 上运行它会更新不同的配置目录，不会解锁运行的 dashboard。

### 忘记密码

再次运行 `ccs config auth setup` 设置新密码。

### ENV 覆盖不生效

确保变量已导出：

```bash
export CCS_DASHBOARD_AUTH_ENABLED=true
export CCS_DASHBOARD_USERNAME=admin
export CCS_DASHBOARD_PASSWORD_HASH='$2b$10$...'
```

### Session 立即过期

检查配置中的 `session_timeout_hours`。默认是 24 小时。

### "Invalid ... context_group ..."

此错误来自 `PUT /api/config`，当账户明确设置共享模式但组无效时。使用规范组值（例如：`team-alpha`）。

## 另见

- [Dashboard Auth Feature](https://ccs.kaitran.ca/features/dashboard-auth) - 完整文档
- [Config Schema](https://ccs.kaitran.ca/reference/config-schema) - 所有配置选项
