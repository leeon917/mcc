# CCS 代码规范

最后更新：2026-04-07

CCS 代码库的代码标准、模块化模式和约定。

---

## 核心原则

### YAGNI (You Aren't Gonna Need It)
- 不要"以防万一"地添加功能
- 只实现当前需要的功能
- 删除未使用的代码而不是注释掉

### KISS (Keep It Simple, Stupid)
- 优先选择简单解决方案而不是聪明的方案
- 随时降低复杂性
- 使用成熟模式而不是自定义实现

### DRY (Don't Repeat Yourself)
- 配置只有一个真实来源
- 将通用逻辑提取到共享工具库
- 使用 barrel exports 集中导入

---

## 文件组织

### 目录结构规则

1. **按领域组织**：按业务领域分组文件，而不是按文件类型
2. **Barrel exports 必需**：每个目录必须有聚合导出的 `index.ts`
3. **深度扁平化**：最多保持 3 层嵌套
4. **就近放置**：将相关文件放在一起（component + hooks + utils）

### 文件命名约定

| 约定 | 示例 | 使用时机 |
|------------|---------|-------------|
| kebab-case | `cliproxy-executor.ts` | 所有 TypeScript/TSX 文件 |
| kebab-case | `profile-detector.ts` | 多词文件名 |
| *-adapter.ts | `claude-adapter.ts`, `droid-adapter.ts` | TargetAdapter 实现 |
| *-detector.ts | `droid-detector.ts` | 二进制检测逻辑 |
| *-manager.ts | `droid-config-manager.ts` | 配置/状态管理 |
| PascalCase | `BinaryManager` | 仅类导出 |
| camelCase | `detectProfile` | 函数导出 |

**文件名应该具有描述性**：LLM 应该能从文件名本身理解文件的用途，而无需阅读内容。

### 正确示例

```
src/cliproxy/binary-manager.ts      # 二进制管理逻辑
src/commands/doctor-command.ts      # Doctor CLI 命令处理器
ui/src/components/cliproxy/provider-editor/index.tsx
```

### 错误示例

```
src/utils/helper.ts                 # 太模糊
src/cliproxy/manager.ts             # 哪个 manager？
ui/src/components/Editor.tsx        # 不是 kebab-case
```

---

## 文件大小限制：200 行

**目标**：所有代码文件应少于 200 行。

**例外**（需要说明理由）：
- 数据文件（model-pricing.ts, model-catalog.ts）
- 具有路由逻辑的入口点（ccs.ts）
- 无法有意义拆分的大型转换逻辑

### 为什么是 200 行？

1. **上下文效率**：LLM 处理小文件更快
2. **单一职责**：强制模块专注、可测试
3. **导航**：更容易扫描和理解
4. **可维护性**：减少合并冲突

### 当文件超过 200 行时

如果文件增长超过 200 行：

1. **识别可提取的候选**：
   - 可以作为工具的辅助函数
   - 常量和类型定义
   - React 组件中的子组件
   - 形成内聚单元的相关逻辑

2. **创建子目录结构**：
   ```
   # 之前
   provider-editor.tsx (921 lines)

   # 之后
   provider-editor/
   ├── index.tsx           # 主组件 (200 lines)
   ├── model-mapping-form.tsx
   ├── endpoint-config.tsx
   ├── auth-section.tsx
   ├── hooks.ts
   ├── types.ts
   └── utils.ts
   ```

3. **保留公共 API**：通过 barrel 导出保持主导出不变

---

## Barrel Export 模式

### 什么是 Barrel Export？

聚合和重新导出模块内容的 `index.ts` 文件：

```typescript
// src/cliproxy/index.ts

// 类型（使用明确的 type 关键字）
export type { PlatformInfo, BinaryInfo } from './types';

// 函数
export { detectPlatform } from './platform-detector';
export { BinaryManager } from './binary-manager';

// 从子目录
export * from './auth';
export * from './services';
```

### Barrel Export 规则

1. **每个领域目录必须有 `index.ts`**
2. **使用 `export type` 导出类型以支持 tree-shaking**
3. **重新导出子目录以支持深度访问**
4. **保持 barrel exports 扁平** - 无逻辑，只有导出

### 导入模式

```typescript
// 正确：从领域 barrel 导入
import { execClaudeWithCLIProxy, CLIProxyProvider } from '../cliproxy';
import { Config, Settings } from '../types';

// 错误：从特定文件导入（绕过 barrel）
import { execClaudeWithCLIProxy } from '../cliproxy/cliproxy-executor';
```

### 深度导入例外

允许的情况：
- 导入 barrel 中未暴露的私有工具
- 避免循环依赖
- 性能关键的 tree-shaking

---

## Target Adapter 模式

target adapter 模式支持多种 CLI 实现（Claude Code、Factory Droid、Codex CLI 等）的可插拔支持，同时保持统一的 profile 系统。

### 模式概述

**每个 CLI 目标实现 `TargetAdapter` 接口：**

```typescript
interface TargetAdapter {
  readonly type: TargetType;                                    // 'claude' | 'droid' | 'codex'
  readonly displayName: string;                                 // Human-readable name

  detectBinary(): TargetBinaryInfo | null;                      // Find CLI on system
  prepareCredentials(creds: TargetCredentials): Promise<void>;  // Deliver credentials
  buildArgs(profile: string, userArgs: string[]): string[];    // Build CLI args
  buildEnv(creds: TargetCredentials, type: string): Env;       // Build env vars
  exec(args: string[], env: Env): void;                        // Spawn CLI process
  supportsProfileType(type: string): boolean;                  // Validate profile
}
```

### 各目标关键差异

| 方面 | Claude | Droid | Codex |
|--------|--------|-------|-------|
| **凭证传递** | 环境变量 | 配置文件 (~/.factory/settings.json) | 瞬态 `-c` overrides + `CCS_CODEX_API_KEY` |
| **启动参数** | `claude <args>` | `droid -m custom:ccs-<profile> <args>` | `codex <args>` 或 `codex -c ... <args>` |
| **配置写入** | 无（使用 env） | `upsertCcsModel()` 写入 settings | 运行时无；dashboard 仅编辑用户拥有的 `~/.codex/config.toml` |
| **二进制检测** | `detectClaudeCli()` | `detectDroidCli()` 带版本检查 | `detectCodexCli()` 加上 `--config` 能力探测 |

### 目标解析优先级

通过 `resolveTargetType()` 解析使用哪个 adapter：

```
1. --target <name> 标志（最高优先级）
   ↓
2. 明确的运行时入口点（`CCS_INTERNAL_ENTRY_TARGET`）：
   - ccs-droid / ccsd → droid
   - ccs-codex / ccsx → codex
   - ccsxp → codex（原生的 cliproxy 快捷方式）
   ↓
3. argv[0] 检测（运行时别名模式 / 自定义别名映射）：
   - ccs-droid → droid
   - ccsd → droid
   - ccs-codex → codex
   - ccsx → codex
   - ccs → default
   ↓
4. Profile 配置：profileConfig.target 字段
   ↓
5. 回退：'claude'（最低优先级）
```

### 注册模式

在启动时，adapters 自行注册到运行时注册表：

```typescript
// 在 ccs.ts 或初始化中
registerTarget(new ClaudeAdapter());
registerTarget(new DroidAdapter());
registerTarget(new CodexAdapter());

// 稍后执行时
const targetType = resolveTargetType(args, profileConfig);
const adapter = getTarget(targetType);

await adapter.prepareCredentials(credentials);
const spawnArgs = adapter.buildArgs(profile, userArgs);
adapter.exec(spawnArgs, adapter.buildEnv(credentials, profileType));
```

### 添加新目标

要添加对新 CLI（例如 `newcli`）的支持：

1. 创建实现 `TargetAdapter` 的 `src/targets/newcli-adapter.ts`
2. 实现每个必需方法（检测、凭证传递、生成）
3. 创建 `src/targets/newcli-detector.ts` 用于二进制检测逻辑
4. 从 `src/targets/index.ts` 导出
5. 在 `ccs.ts` 中注册：`registerTarget(new NewCliAdapter())`
6. 更新 `TargetType` 联合类型以包含 `'newcli'`

---

## 大文件拆分方法论

拆分大文件（500+ 行）时，遵循此流程：

### 步骤 1：分析结构

识别逻辑边界：
- React 组件中的渲染部分
- 路由文件中的处理器组
- 相关工具函数
- 常量和类型

### 步骤 2：先提取类型

```typescript
// types.ts
export interface ProviderEditorProps {
  providerId: string;
  onSave: (config: ProviderConfig) => void;
}

export interface ModelMappingValues {
  model: string;
  endpoint: string;
}
```

### 步骤 3：提取工具

```typescript
// utils.ts
export function validateEndpoint(url: string): boolean { ... }
export function formatModelName(name: string): string { ... }
```

### 步骤 4：提取 Hooks

```typescript
// hooks.ts
export function useProviderConfig(providerId: string) { ... }
export function useModelValidation() { ... }
```

### 步骤 5：提取子组件

```typescript
// model-mapping-form.tsx
export function ModelMappingForm({ values, onChange }: Props) { ... }
```

### 步骤 6：在 Index 中组合

```typescript
// index.tsx
import { ModelMappingForm } from './model-mapping-form';
import { useProviderConfig } from './hooks';
import type { ProviderEditorProps } from './types';

export function ProviderEditor({ providerId, onSave }: ProviderEditorProps) {
  const config = useProviderConfig(providerId);
  return (
    <div>
      <ModelMappingForm values={config.mapping} onChange={...} />
    </div>
  );
}

// Re-export types for consumers
export type { ProviderEditorProps, ModelMappingValues } from './types';
```

---

## TypeScript 标准

### 严格模式必需

所有项目使用 TypeScript 严格模式：

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 类型注解

```typescript
// 正确：公共函数的明确返回类型
export function detectProfile(args: string[]): DetectedProfile { ... }

// 正确：内部函数的推断类型
const formatName = (name: string) => name.trim().toLowerCase();

// 错误：any 类型
function processData(data: any) { ... }  // 使用 unknown 或适当类型
```

### 类型导出

```typescript
// 正确：使用 type 关键字进行仅类型导出
export type { Config, Settings } from './config';

// 正确：在 barrel 中分组类型导出
export type {
  PlatformInfo,
  BinaryInfo,
  DownloadProgress,
} from './types';
```

---

## ESLint 规则（强制执行）

| 规则 | 级别 | 备注 |
|------|-------|-------|
| `@typescript-eslint/no-unused-vars` | error | 忽略 `_` 前缀 |
| `@typescript-eslint/no-explicit-any` | error | 使用适当类型 |
| `@typescript-eslint/no-non-null-assertion` | error | 不使用 `!` 断言 |
| `prefer-const` | error | 默认不可变 |
| `no-var` | error | 使用 const/let |
| `eqeqeq` | error | 严格相等 |
| `react-hooks/*` | recommended | （仅 UI） |

---

## 终端输出标准

### CCS 日志标准

- 使用 `src/services/logging/` 中的共享 logger 进行 CCS 自有运行时诊断、请求跟踪和结构化事件
- 保持 `utils/ui` 和刻意的 `console.log`/`console.error` 输出仅用于面向用户的 CLI UX
- 在持久化之前清除 secrets；永远不要将原始 tokens、cookies、API keys 或密码哈希写入 CCS 自有日志
- 仅在 `getCcsDir()/logs` 下持久化 CCS 自有日志；不要为每个功能日志创建根目录
- 添加 dashboard 轮询或诊断路由时，防止它们递归记录日志查看器本身

### 仅 ASCII

```typescript
// 正确
console.log('[OK] Operation successful');
console.log('[!] Warning message');
console.log('[X] Error occurred');
console.log('[i] Information');

// 错误 - 不要使用 EMOJIS
console.log('Operation successful');  // NO
console.log('Warning message');       // NO
```

### 颜色处理

```typescript
import { colors } from '../utils/ui';

// 颜色支持 TTY 检测并尊重 NO_COLOR
console.log(colors.green('[OK]') + ' Operation successful');
```

### 边框

错误显示使用 ASCII 框绘制：

```
+=====================================+
|  [X] ERROR: Configuration failed    |
|                                     |
|  Details: Unable to parse config    |
+=====================================+
```

### 跨平台 Adapter 生成

实现 target adapters 时，处理二进制生成的平台差异：

```typescript
// Windows shell 检测（.cmd、.bat、.ps1 需要 shell）
const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(binaryPath);

if (needsShell) {
  // 转义参数并使用 shell: true
  const cmdString = [binaryPath, ...args].map(escapeShellArg).join(' ');
  spawn(cmdString, { shell: true, stdio: 'inherit' });
} else {
  // 直接生成（Unix 类、不带 shell 的 Windows 可执行文件）
  spawn(binaryPath, args, { stdio: 'inherit' });
}
```

此模式在 `ClaudeAdapter` 和 `DroidAdapter` 中使用以确保跨平台一致性。

对于所有 Claude 子进程启动（delegation、adapters、proxies、helper 生成器），在生成前清理 env：

```typescript
const cleanEnv = stripClaudeCodeEnv(mergedEnv); // 不区分大小写地移除 CLAUDECODE
spawn(binaryPath, args, { env: cleanEnv, stdio: 'inherit' });
```

这可以防止 CCS 在父 Claude 会话中运行时出现 Claude Code 嵌套会话保护失败。

---

## React 组件标准（UI）

### 组件结构

```typescript
// component-name.tsx

// 1. 导入（分组：react、外部、内部、相对）
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useProfiles } from '@/hooks';
import { formatName } from './utils';
import type { ComponentProps } from './types';

// 2. 类型（如果不在单独文件中）
interface Props {
  id: string;
  onSave: () => void;
}

// 3. 组件
export function ComponentName({ id, onSave }: Props) {
  // Hooks 优先
  const profiles = useProfiles();
  const [state, setState] = useState(null);

  // 处理器
  const handleClick = () => { ... };

  // 渲染
  return ( ... );
}
```

### 命名约定

| 项目 | 约定 | 示例 |
|------|------------|---------|
| 组件文件 | kebab-case.tsx | `provider-editor.tsx` |
| 组件导出 | PascalCase | `ProviderEditor` |
| Hook 文件 | use-*.ts | `use-profiles.ts` |
| Hook 导出 | useCamelCase | `useProfiles` |
| 工具文件 | kebab-case.ts | `path-utils.ts` |
| 工具导出 | camelCase | `formatPath` |

---

## 输入状态持久化模式

构建允许用户进行更改的表单和编辑器时，遵循这些模式以防止数据丢失。

### 模式 1：基于 Key 的重新挂载

**使用时机**：组件有应在 prop 更改时重置的复杂本地状态。

```typescript
// 父组件
<ProfileEditor
  key={profileId}  // 当 profile 更改时强制重新挂载
  profileId={profileId}
  onSave={handleSave}
/>
```

**原因**：没有 `key`，React 重用组件实例。本地 `useState` 值即使在 prop 更改时也会保留，导致过期数据 bug。

### 模式 2：未保存更改确认

**使用时机**：用户可能在编辑时导航离开。

```typescript
// 父组件跟踪 dirty 状态
const [editorHasChanges, setEditorHasChanges] = useState(false);
const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);

// 子组件通知父组件 dirty 状态
useEffect(() => {
  onHasChangesUpdate?.(computedHasChanges);
}, [computedHasChanges, onHasChangesUpdate]);

// 拦截导航
const handleSelect = (id: string) => {
  if (editorHasChanges && currentId !== id) {
    setPendingSwitch(id);  // 显示确认对话框
  } else {
    setCurrentId(id);
  }
};
```

**流程**：
1. 子组件从本地状态与已保存数据计算 `hasChanges`
2. 子组件通过回调通知父组件
3. 当 dirty 时父组件拦截导航
4. 显示确认对话框："Discard & Switch" 或 "Cancel"
5. 确认后：重置 dirty 状态，然后切换

### 模式 3：带视觉反馈的自动保存

**使用时机**：应立即保存的简单输入。

```typescript
const [saved, setSaved] = useState(false);

const handleBlur = async () => {
  if (value !== savedValue) {
    await saveToBackend(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
};

return (
  <div className="flex items-center gap-2">
    <Input value={value} onChange={...} onBlur={handleBlur} />
    {saved && (
      <span className="text-green-600 text-xs flex items-center gap-1">
        <Check className="w-3.5 h-3.5" /> Saved
      </span>
    )}
  </div>
);
```

**何时使用哪种**：
| 场景 | 模式 |
|----------|---------|
| 复杂多字段编辑器 | 模式 2（确认对话框） |
| 简单单输入 | 模式 3（自动保存 + 反馈） |
| 列表项选择 | 模式 1（基于 key 重新挂载）+ 模式 2 |

---

## 质量门禁

### 预提交序列

```bash
# 主项目
bun run format
bun run lint:fix
bun run validate
bun run validate:ci-parity

# UI 项目（如有更改）
cd ui
bun run format
bun run lint:fix
bun run validate
```

### Validate 运行

| 项目 | 命令 | 检查 |
|---------|---------|--------|
| Main | `bun run validate` | typecheck + lint + format:check + test:fast |
| UI | `bun run validate` | typecheck + lint + format:check |

---

## 常规提交

所有提交必须遵循常规提交格式：

```
<type>(<scope>): <description>
```

### 类型

| 类型 | 使用时机 | 版本升级 |
|------|-------------|--------------|
| `feat` | 新功能 | MINOR |
| `fix` | Bug 修复 | PATCH |
| `perf` | 性能 | PATCH |
| `docs` | 文档 | None |
| `style` | 格式化 | None |
| `refactor` | 代码重构 | None |
| `test` | 测试 | None |
| `chore` | 维护 | None |

### 示例

```bash
# 正确
git commit -m "feat(cliproxy): add OAuth token refresh"
git commit -m "fix(doctor): handle missing config gracefully"
git commit -m "refactor(ui): split provider-editor into modules"

# 错误 - 拒绝
git commit -m "added new feature"
git commit -m "Fixed bug"
```

---

## 应避免的反模式

### 1. 上帝文件

```typescript
// 不好：一个文件做所有事情
// src/utils.ts (2000 行混合关注点)

// 好：按领域拆分
// src/utils/ui/colors.ts
// src/utils/ui/boxes.ts
// src/utils/shell-executor.ts
// src/utils/config-manager.ts
```

### 2. Barrel 导入绕过

```typescript
// 不好：直接导入绕过 barrel
import { detectPlatform } from '../cliproxy/platform-detector';

// 好：从领域 barrel 导入
import { detectPlatform } from '../cliproxy';
```

### 3. 内联一切

```typescript
// 不好：组件中巨大的内联函数
function Component() {
  const handleComplexOperation = () => {
    // 100 行逻辑...
  };
}

// 好：提取到 hooks 或工具
function Component() {
  const { handleComplexOperation } = useComplexOperation();
}
```

### 4. 类型重复

```typescript
// 不好：同一类型在多个文件中定义
// file1.ts
interface Config { ... }
// file2.ts
interface Config { ... }

// 好：单一真实来源
// types/config.ts
export interface Config { ... }
```

### 5. 配置优先级模式

从多个来源解析配置时，遵循此优先级顺序：

```typescript
// proxy-config-resolver.ts 模式
// 优先级：CLI 标志 > 环境变量 > config.yaml > 默认值

const resolved = {
  ...DEFAULT_CONFIG,                    // 4. 默认值（最低）
  ...yamlConfig,                        // 3. config.yaml
  ...envConfig,                         // 2. 环境变量
  ...cliFlags,                          // 1. CLI 标志（最高）
};
```

此模式用于：
- `src/cliproxy/proxy-config-resolver.ts` - 远程代理配置
- `src/config/unified-config-loader.ts` - 主配置加载

---

## 相关文档

- [Codebase Summary](./codebase-summary.md) - 完整目录结构
- [System Architecture](./system-architecture/index.md) - 架构图
- [CLAUDE.md](../CLAUDE.md) - AI 面向的开发指导
