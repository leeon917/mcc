# 硬化清单报告

范围：`src/**/*.{ts,tsx,js,jsx,mjs,cjs}`

## 摘要

| 指标 | 值 |
|---|---:|
| 同步 fs 出现次数（全部） | 835 |
| 受影响的同步 fs 文件（全部） | 100 |
| 同步 fs 出现次数（运行时热路径） | 724 |
| 受影响的同步 fs 文件（运行时热路径） | 89 |
| 旧版 shim 标记 | 131 |
| 受影响的旧版 shim 文件 | 56 |

## 顶级运行时热路径同步 fs 文件

| 文件 | 同步调用数 | API 名称 |
|---|---:|---|
| `src/management/shared-manager.ts` | 60 | copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync |
| `src/utils/claude-symlink-manager.ts` | 27 | copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync |
| `src/utils/shell-completion.ts` | 23 | appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync |
| `src/web-server/routes/settings-routes.ts` | 23 | copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync |
| `src/utils/claude-dir-installer.ts` | 21 | copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync |
| `src/cliproxy/binary/version-cache.ts` | 20 | existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync |
| `src/management/recovery-manager.ts` | 20 | copyFileSync, existsSync, mkdirSync, renameSync, writeFileSync |
| `src/web-server/routes/cliproxy-stats-routes.ts` | 20 | closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, statSync, writeFileSync |
| `src/web-server/routes/misc-routes.ts` | 20 | copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync |
| `src/web-server/routes/persist-routes.ts` | 17 | closeSync, copyFileSync, existsSync, lstatSync, openSync, readdirSync, readSync, renameSync, unlinkSync, writeFileSync |

## 顶级旧版 Shim 标记文件

| 文件 | 标记计数 |
|---|---:|
| `src/utils/config-manager.ts` | 13 |
| `src/auth/profile-detector.ts` | 11 |
| `src/config/unified-config-loader.ts` | 9 |
| `src/commands/setup-command.ts` | 7 |
| `src/management/checks/config-check.ts` | 6 |
| `src/web-server/routes/account-routes.ts` | 6 |
| `src/config/migration-manager.ts` | 5 |
| `src/api/services/profile-writer.ts` | 4 |
| `src/cliproxy/quota-fetcher-gemini-cli.ts` | 4 |
| `src/auth/profile-registry.ts` | 3 |

## 显式 Shim/重新导出文件

- `src/cliproxy/openai-compat-manager.ts`
