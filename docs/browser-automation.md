# 浏览器自动化

最后更新：2026-04-19

CCS 提供两种独立的运行时路径实现浏览器自动化：

- **Claude Browser Attach**：通过 CCS 管理的本地 `ccs-browser` MCP runtime 重用运行中的 Chrome/Chromium 会话
- **Codex Browser Tools**：将 Playwright MCP tooling 注入到 Codex 目标的启动中

这些功能相关但不是同一实现，也不承诺共享浏览器会话。
在新安装以及尚未有明确浏览器设置的升级版本中，两条路径都默认为**禁用**和**手动**，因此浏览器工具不会自动暴露，需要用户主动选择。

## 浏览器自动化工作原理

### Claude Browser Attach

Claude 目标的 CCS 启动可以配置一个名为 `ccs-browser` 的托管本地 MCP 服务器。
该路径适用于需要 Claude 与已有认证状态的浏览器会话交互的工作流。

Claude Browser Attach 需要一个以 attach 模式启动的浏览器，并启用远程调试。
仅更新 Chrome 版本是不够的。

### Codex Browser Tools

Codex 目标的 CCS 启动使用独立的托管路径：CCS 为 `ccs_browser` runtime 配置注入 Playwright MCP overrides。

这从同一个 Browser 设置界面配置，但与 Claude Browser Attach 是分开的。

## 配置

### 通过 Dashboard

打开 `ccs config` -> `Settings` -> `Browser`。

Browser 界面暴露两个部分：

- **Claude Browser Attach**
  - 启用/禁用 Claude attach 路径
  - 选择 Chrome user-data 目录
  - 设置预期的 DevTools 端口
  - 查看就绪状态和后续步骤指导
  - 复制生成的浏览器启动命令
- **Codex Browser Tools**
  - 启用/禁用 Codex 目标启动的 CCS 托管浏览器工具
  - 查看检测到的 Codex 构建是否支持托管浏览器 overrides

浏览器策略控制在当前版本中是 CLI 优先的。Dashboard 仍然是共享的设置和状态界面，而 `ccs browser policy` 是决定浏览器工具是自动暴露还是保持手动的权威位置。新安装以及没有现有浏览器部分的升级版本会将两条路径都显示为关闭/手动，直到用户明确启用它们。

### 通过 CLI

```bash
ccs help browser
ccs browser setup
ccs browser status
ccs browser doctor
ccs browser policy
ccs browser policy --all manual
```

使用 `ccs browser setup` 作为主要的一键设置路径。使用 `ccs browser status` 查看当前状态，`ccs browser doctor` 获取只读故障排除指导，以及 `ccs browser policy` 控制默认浏览器暴露。如果只想在一次启动中使用浏览器，请保持 policy 为 manual 并在该启动中添加 `--browser`。

### 通过配置文件

编辑 `~/.ccs/config.yaml`：

```yaml
browser:
  claude:
    enabled: false
    policy: manual
    user_data_dir: "~/.ccs/browser/chrome-user-data"
    devtools_port: 9222
  codex:
    enabled: false
    policy: manual
```

注意事项：

- `claude.policy` 和 `codex.policy` 接受 `auto` 或 `manual`
- `claude.user_data_dir` 是 **Chrome user-data 目录**，不是显示名称的浏览器 profile
- `claude.devtools_port` 是 attach 模式的预期远程调试端口
- `codex.enabled` 控制 CCS 是否将浏览器工具注入到 Codex 目标的启动中
- 新安装以及没有保存浏览器设置的升级版本默认两条路径都是 `enabled: false` 和 `policy: manual`
- `manual` 保持路径已配置但隐藏，直到启动时明确使用 `--browser` 选择加入

## 运行时策略控制

CCS 现在将**路径启用**与**默认暴露策略**分离：

- `enabled: false`
  - 该路径关闭；这是新安装和没有保存浏览器设置的升级版本的默认值
- `enabled: true` + `policy: auto`
  - 该路径在匹配的启动上自动暴露
- `enabled: true` + `policy: manual`
  - 该路径保持配置，但 CCS 保持浏览器工具隐藏，除非当前启动使用 `--browser`

单次启动覆盖：

```bash
ccs browser policy --all manual
ccs glm --browser "inspect the page"
ccs glm --no-browser "summarize the docs"
ccs default --target codex --browser "use the browser tools for this run"
```

- `--browser` 在当前启动中强制启用浏览器工具（当该路径已启用时）
- `--no-browser` 即使策略是 `auto` 也抑制当前启动的浏览器工具

## 环境变量覆盖

CCS 仍然支持环境变量覆盖以保持向后兼容。

| 变量 | 描述 |
|----------|-------------|
| `CCS_BROWSER_USER_DATA_DIR` | Claude Browser Attach user-data dir 的首选覆盖 |
| `CCS_BROWSER_PROFILE_DIR` | 同一 attach 目录的旧别名 |
| `CCS_BROWSER_DEVTOOLS_PORT` | 明确的 DevTools 端口覆盖 |

如果覆盖处于激活状态，Browser status 界面应报告当前会话正由环境变量外部管理。

保存的浏览器策略仍然控制默认暴露。环境覆盖改变当前 shell 的有效 attach 路径/端口；它们不绕过 `policy: manual`。

覆盖优先级：

1. `CCS_BROWSER_USER_DATA_DIR`
2. `CCS_BROWSER_PROFILE_DIR`
3. 持久化的 `browser.claude.user_data_dir` 配置值

基于配置的 Browser Attach 总是向 runtime 传递明确的 DevTools 端口，即使有效值是默认的 `9222`。仅当 `CCS_BROWSER_DEVTOOLS_PORT` 未设置时，才为旧 `CCS_BROWSER_PROFILE_DIR` 流程保留基于元数据的端口发现。

## 托管 Runtime 文件

- `~/.claude.json` -> CCS 管理 `mcpServers.ccs-browser` 用于 Claude Browser Attach
- `~/.ccs/mcp/ccs-browser-server.cjs` -> 本地 Claude Browser Attach MCP runtime
- `Codex runtime config overrides` -> CCS 管理 `ccs_browser` MCP 条目用于 Codex 目标启动

不要将通用的 Codex MCP 编辑器作为主要的浏览器设置路径。CCS 托管的浏览器条目应从 `Settings -> Browser` 配置。

## 主要设置流程

最短的支持设置路径：

```bash
ccs browser setup
```

该流程：

1. 在保存的 CCS 浏览器配置中启用 Claude Browser Attach
2. 保持启动暴露在保存的策略下，因此 `policy: manual` 仍需要 `--browser`
3. 保持配置的 DevTools 端口标准化
4. 在需要时创建配置的浏览器 user-data 目录
5. 打印当前平台的确切浏览器启动命令
6. 重新检查就绪状态，如果 Chrome 仍需要手动操作则报告后续步骤

## 为 Claude Attach 启动 Chrome

Claude Browser Attach 需要一个以远程调试模式启动的浏览器。

典型示例：

```bash
# macOS
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.ccs/browser/chrome-user-data"

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.ccs/browser/chrome-user-data"

# Windows
chrome.exe --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\\.ccs\\browser\\chrome-user-data"
```

建议使用专用 CCS 浏览器数据目录。它可以避免 profile 锁定问题，并使自动化状态与日常浏览器 profile 分离。

当 Claude Browser Attach 使用推荐的托管路径（`~/.ccs/browser/chrome-user-data`）时，CCS 现在在首次需要时自动创建该目录。在该引导步骤之后，剩余需求是使用 `--remote-debugging-port` 启动的运行中的 Chrome 会话。

## 故障排除

### Browser status 显示 Claude Browser Attach 已禁用

运行 `ccs browser setup`，在 `Settings -> Browser` 中启用 Claude Browser Attach，或编辑 `~/.ccs/config.yaml` 中的浏览器配置块。

### Browser status 显示路径缺失

配置的 Chrome user-data 目录尚不存在。

1. 运行 `ccs browser setup`
2. 如果 Chrome 仍未就绪，使用生成的启动命令
3. 重新运行 `ccs browser doctor`

如果您使用的是 CCS 托管的默认路径，这通常意味着路径无法自动创建，现在需要手动处理。

### Browser status 显示未找到运行中的浏览器会话

CCS 无法为配置的 user-data 目录找到可用的 DevTools attach 元数据。

1. 运行 `ccs browser setup`
2. 如有需要，确保 Chrome 已使用 `--remote-debugging-port=<port>` 启动
3. 确保它使用的是 CCS 中配置的相同 `user_data_dir`
4. 重新运行 `ccs browser doctor`

对于 CCS 托管的默认路径，这是 CCS 为您引导目录后的正常首次运行状态。

### Browser status 显示 DevTools 端点无法访问

CCS 找到了 attach 元数据，但端点未成功响应。

1. 运行 `ccs browser setup`
2. 如有需要，重启 attach 浏览器会话
3. 确认预期端口与实际远程调试端口匹配
4. 重新运行 `ccs browser status`

### Codex Browser Tools 不可用

Codex 浏览器工具依赖于支持 `--config` overrides 的 Codex 构建。

如果 CCS 报告 `unsupported_build`，请升级 Codex 并重新运行 `ccs browser status`。

## 安全注意事项

- 浏览器自动化可能在已认证的浏览器会话内操作
- 更喜欢使用专用自动化 user-data dir 而不是日常浏览器 profile
- 不要将浏览器路径、密钥或生成的会话状态提交到版本控制
- 将 `~/.ccs/config.yaml`、`~/.claude.json` 和浏览器 user-data 目录视为本地机器状态
