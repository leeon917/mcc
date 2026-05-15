# CCS Test Suite

## 组织结构

```
tests/
├── unit/              # 模块单元测试（Mocha）
│   ├── glmt/          # 遗留 GLMT 转换器/内部兼容性测试
│   └── delegation/    # 委托模块测试
├── npm/               # npm 包测试（Mocha）
├── native/            # 本地安装测试（bash/PowerShell）
│   ├── unix/          # Unix/Linux/macOS 测试
│   └── windows/       # Windows PowerShell 测试
├── integration/       # 集成 + 冒烟测试
└── shared/            # 共享工具
    ├── fixtures/      # 测试配置和环境
    ├── unit/          # 辅助函数测试
    ├── helpers.sh     # Bash 测试工具
    └── test-data.js   # npm 测试的测试数据
```

## 运行测试

```bash
bun run test           # 所有自动化测试（unit + integration + npm）
bun run test:unit      # 仅单元测试
bun run test:npm       # npm 包测试
bun run test:native    # 本地 Unix 测试（bash）
```

## 测试类别

### 单元测试（`unit/`）
使用 Mocha 框架的模块级测试：
- `unit/glmt/` - 为 Cursor 翻译兼容性保留的遗留转换器内部结构
- `unit/delegation/` - 权限模式、会话管理器、结果格式化器

### npm 测试（`npm/`）
使用 Mocha 的 npm 包功能测试：
- `postinstall.test.js` - Postinstall 行为
- `cli.test.js` - CLI 参数解析
- `cross-platform.test.js` - 跨平台兼容性
- `special-commands.test.js` - 集成测试

### 本地测试（`native/`）
curl|bash（Unix）和 irm|iex（Windows）的安装测试：
- `native/unix/edge-cases.sh` - Unix 边界情况测试
- `native/windows/edge-cases.ps1` - Windows 边界情况测试

### 集成测试（`integration/`）
跨多层场景的集成和冒烟覆盖：
- 作为 `bun run test:all` 和 CI 的一部分运行的自动化 `*.test.ts` 文件
- Shell 和独立探针脚本保留用于按需调试
- `cursor-daemon-lifecycle.test.ts` - 本地 daemon 进程 + HTTP 冒烟覆盖
- `image-analyzer-hook.test.ts` - hook 集成覆盖
- `glmt-integration-test.sh` - 遗留 GLMT 兼容性冒烟探针
- `symlink-chain-test.sh` - Symlink 链处理
- `ux-integration-test.sh` - CLI UX 集成

## 添加新测试

- **单元测试**：添加到 `unit/<module>/` 用于隔离模块行为
- **npm 测试**：添加到 `npm/` 用于包行为
- **本地测试**：添加到 `native/unix/` 或 `native/windows/`
- **集成测试**：将自动化跨层冒烟覆盖添加到 `integration/*.test.ts`
