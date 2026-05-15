# CCS Shell 补全

CCS 命令、子命令、profiles 和 flags 的 Tab 补全。

补全脚本是隐藏的 `ccs __complete` 后端的轻量适配器，因此所有支持的 shell 都与同一命令图保持一致。

**支持的 Shell：** Bash、Zsh、Fish、PowerShell

## 功能

- 补全 profile 名称（基于 settings 的和基于 account 的）
- 补全根命令、帮助主题、provider 快捷方式和命令 flags
- 补全 `ccs auth` 和 `ccs api` 生命周期子命令
- 上下文感知：根据当前命令建议相关选项

## 快速安装（推荐）

```bash
ccs --shell-completion
```

这将：
- 自动检测你的 shell
- 将补全文件复制到 `~/.ccs/completions/`
- 使用正确的注释标记配置你的 shell profile
- 显示激活说明

**手动选择 shell：**
```bash
ccs --shell-completion --bash        # 强制 bash
ccs --shell-completion --zsh         # 强制 zsh
ccs --shell-completion --fish        # 强制 fish
ccs --shell-completion --powershell  # 强制 PowerShell
```

**帮助和验证：**
```bash
ccs help completion
ccs --shell-completion --force
```

## 手动安装

补全文件在 `npm install` 期间安装到 `~/.ccs/completions/`。

### Bash

添加到 `~/.bashrc` 或 `~/.bash_profile`：

```bash
# CCS shell completion
source ~/.ccs/completions/ccs.bash
```

然后重新加载：
```bash
source ~/.bashrc
```

### Zsh

1. 创建补全目录：
   ```zsh
   mkdir -p ~/.zsh/completion
   ```

2. 复制补全文件：
   ```zsh
   cp ~/.ccs/completions/ccs.zsh ~/.zsh/completion/_ccs
   ```

3. 添加到 `~/.zshrc`：
   ```zsh
   # CCS shell completion
   fpath=(~/.zsh/completion $fpath)
   autoload -Uz compinit && compinit
   ```

4. 重新加载：
   ```zsh
   source ~/.zshrc
   ```

### PowerShell

添加到你的 PowerShell profile（`$PROFILE`）：

```powershell
# CCS shell completion
. "$HOME\.ccs\completions\ccs.ps1"
```

然后重新加载：
```powershell
. $PROFILE
```

### Fish

**用户安装（推荐）**

Fish 自动从 `~/.config/fish/completions/` 加载补全：

```fish
# 创建补全目录（如果不存在）
mkdir -p ~/.config/fish/completions

# 复制补全脚本
cp scripts/completion/ccs.fish ~/.config/fish/completions/
```

就这样！Fish 将自动按需加载补全。无需 source 或重新加载。

**系统级安装（需要 sudo）**

```fish
sudo cp scripts/completion/ccs.fish /usr/share/fish/vendor_completions.d/
```

## 使用示例

### 基本补全

```bash
$ ccs <TAB>
auth      api       cliproxy  config    doctor    docker    help

$ ccs help <TAB>
profiles  providers  completion  targets
```

### 上下文补全

```bash
$ ccs auth show <TAB>
work      personal  team      --json

$ ccs api <TAB>
create    list      discover  copy    export  import  remove
```

### 后端契约

```bash
$ ccs __complete --shell bash --current do
doctor
docker
```

Shell 适配器现在调用共享的 CCS 补全后端，而非维护自己的命令图副本。这意味着：
- 顶级命令、帮助主题和 provider 快捷方式来自 CCS 本身
- 动态 profiles 和 CLIProxy 变体通过真实配置加载器解析
- bash、zsh、fish 和 PowerShell 与同一补全逻辑保持一致

## 故障排除

### Bash

1. 检查补全是否已加载：
   ```bash
   complete -p ccs
   ```
2. 直接验证后端：
   ```bash
   ccs __complete --shell bash --current "" -- help
   ```

### Zsh

1. 验证补全系统已启用：
   ```zsh
   autoload -Uz compinit && compinit
   ```
2. 必要时重建缓存：
   ```zsh
   rm ~/.zcompdump && compinit
   ```
3. 直接验证后端：
   ```zsh
   ccs __complete --shell zsh --current "" -- help
   ```

### PowerShell

1. 检查 profile 是否存在：
   ```powershell
   Test-Path $PROFILE
   ```
2. 直接验证后端：
   ```powershell
   ccs __complete --shell powershell --current "" -- help
   ```

### Fish

1. 验证补全文件位置：
   ```fish
   ls ~/.config/fish/completions/ccs.fish
   ```
2. 手动测试补全：
   ```fish
   complete -C'ccs '
   ```
3. 直接验证后端：
   ```fish
   ccs __complete --shell fish --current "" -- help
   ```

## 技术细节

- Bash 使用 `complete -F`
- Zsh 使用自定义 `_ccs` 补全函数
- Fish 使用 `complete -a` 和后端命令替换
- PowerShell 使用 `Register-ArgumentCompleter`
- 所有四个 shell 现在都将建议逻辑委托给 `ccs __complete`

## 贡献

添加或更改命令表面时：
1. 更新共享的 TypeScript 命令/补全目录
2. 运行 `bun run validate`
3. 至少在一个已安装的 shell 适配器加上直接后端进行冒烟测试

## 另见

- [CCS Documentation](https://github.com/kaitranntt/ccs)
- [Bash Programmable Completion](https://www.gnu.org/software/bash/manual/html_node/Programmable-Completion.html)
- [Zsh Completion System](http://zsh.sourceforge.net/Doc/Release/Completion-System.html)
- [Fish Completion Tutorial](https://fishshell.com/docs/current/completions.html)
- [PowerShell Argument Completers](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/register-argumentcompleter)
