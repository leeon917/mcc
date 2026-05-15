# npm 包测试

CCS npm 安装方式的测试。

## 文件

- `postinstall.test.js` - Postinstall 行为和配置创建
- `cli.test.js` - CLI 参数解析和 profile 处理
- `cross-platform.test.js` - 跨平台兼容性测试

## 运行

```bash
# 仅运行 npm 测试
npm run test:npm

# 带详细输出运行
npm run test:npm -- --reporter spec

# 运行特定测试文件
npx mocha tests/npm/postinstall.test.js
```

## 测试覆盖

这些测试涵盖：
- Postinstall 脚本行为（来自原始 edge-cases.sh 的第 10 节）
- npm 包的 CLI 参数解析
- 跨平台路径处理
- 配置文件创建和管理
- Profile 系统功能
