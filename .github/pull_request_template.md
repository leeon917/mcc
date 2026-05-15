## 概述

-

## 测试

使用相关选项。如果跳过了某项，请添加简短说明而不是强行填写。

- [ ] `bun run format && bun run lint:fix && bun run validate`
- [ ] 请求 review 前运行 `bun run validate:ci-parity`
- [ ] 如果此 PR 涉及命令路由、代理流程或工作流/发布逻辑，则运行 `bun run test:e2e`
- [ ] 如果 UI 有变化：`cd ui && bun run validate`
- [ ] 未运行

## 检查清单

勾选相关选项。并非每个 PR 都需要所有项目。

- [ ] 基础分支是 `dev`，除非是已批准的热修复
- [ ] 分支名遵循 `feat/*`、`fix/*`、`docs/*` 或已批准的热修复命名
- [ ] 如果 CLI 行为有变化，更新相应的 `--help` 输出
- [ ] 如果行为有变化，添加或更新测试
- [ ] 如果用户面向的行为有变化，更新 README 或本地文档
- [ ] 如果检查失败，PR 正文需说明失败原因和修复措施
- [ ] 不包含 secrets、tokens 或私人配置数据

## 文档影响

文档影响：`none | minor | major`

操作：`no update needed` 或描述更新的文档
