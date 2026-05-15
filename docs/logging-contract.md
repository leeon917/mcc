# 日志契约

CCS CLI 结构化后端日志的单一真实来源。GitHub issues #1138（伞式）和 #1141（后端检测）的配套文档。

## 概述

CCS 为后端行为（代理 daemons、OAuth 流程、目标生成生命周期、执行器错误等）发出结构化 JSONL 日志条目。本文档定义了规范 schema、请求关联模式、生命周期阶段和重定向策略。

> CLI 文本输出（`src/utils/ui.ts` 中的 `ok / info / warn / fail`）**不受此契约影响**。日志是一个单独的通道——永远不要打印到 stdout/stderr。

## Schema（`LogEntry`）

定义在 `src/services/logging/log-types.ts`。

| 字段 | 类型 | 必需 | 备注 |
|-------|------|----------|-------|
| `id` | `string` | 是 | 每个条目的 UUID。 |
| `timestamp` | `string` | 是 | ISO 8601。 |
| `level` | `'error'\|'warn'\|'info'\|'debug'` | 是 | |
| `source` | `string` | 是 | 模块范围的标识符（例如 `proxy:openai-compat:messages`）。 |
| `event` | `string` | 是 | 点分隔的机器可读事件名称（例如 `request.received`）。 |
| `message` | `string` | 是 | 人类可读摘要。 |
| `processId` | `number` | 是 | `process.pid`。 |
| `runId` | `string` | 是 | 每个进程稳定的 id。 |
| `context` | `object` | 否 | 自由形式的结构化字段（已重定向）。 |
| `requestId` | `string` | 否 | 关联属于一个入站请求跨阶段的条目。 |
| `stage` | `LogStage` | 否 | 生命周期阶段标签。 |
| `latencyMs` | `number` | 否 | 经过的毫秒数（通常在 `respond` / `cleanup` 上）。 |
| `error` | `{name, message, code?, stack?}` | 否 | 结构化错误元数据；绝不是原始 token 字符串。 |

旧的自由形式条目（无 `requestId` / `stage`）仍然有效；新字段是添加性的。

### 示例

```jsonl
{"id":"...","timestamp":"2026-04-30T12:34:56.000Z","level":"info","source":"proxy:openai-compat:messages","event":"request.received","message":"Proxy /v1/messages request received","processId":42,"runId":"r1","requestId":"a1b2...","stage":"intake","context":{"method":"POST"}}
```

## 生命周期阶段

`LogStage` 是以下之一：

| 阶段 | 何时发出 |
|-------|--------------|
| `intake` | 在入口边缘接收入站请求（HTTP 处理器、CLI 调度）。 |
| `route` | 目标/profile/目标解析。 |
| `auth` | 认证/授权（token 交换、profile 认证）。 |
| `dispatch` | 出站请求已准备/子进程已生成。 |
| `upstream` | 上游调用进行中（provider HTTP / 生成的子进程运行中）。 |
| `transform` | Payload 转换（请求/响应形状转换）。 |
| `respond` | 响应已写入/已分派（`latencyMs` 通常已填充）。 |
| `cleanup` | 错误路径、中止、拆卸。 |

阶段可以跳过或重复。流式响应仅在开始/结束时标记 `upstream`（不是每个 chunk）。

## RequestId 传播（AsyncLocalStorage）

`requestId` 通过 Node `AsyncLocalStorage` 隐式传播。入口边缘将其处理器包装在 `withRequestContext` 中；内部 `createLogger` 发出的每个条目从活动存储自动合并 `requestId`。

```ts
import { withRequestContext, createLogger } from './services/logging';

const logger = createLogger('proxy:my-edge');

http.createServer((req, res) => {
  const requestId = req.headers['x-ccs-request-id'] ?? randomUUID();
  res.setHeader('x-ccs-request-id', requestId);
  withRequestContext({ requestId }, async () => {
    logger.stage('intake', 'request.received', 'inbound');
    // ... 下游工作发出相同的 requestId
  });
});
```

### 跨 daemon 头

`x-ccs-request-id` 在代理边缘往返：
- 入站：如果头存在且匹配 UUID-ish guard（`/^[A-Za-z0-9._-]{8,128}$/`），则重用；否则生成新的 UUID。
- 出站（响应）：解析的 id 通过 `res.setHeader('x-ccs-request-id', ...)` 回显。
- 当 CCS 调用另一个 daemon（copilot、cursor、glmt）时，在同一头中转发活动 id，以便该 daemon 可以关联。

### 排序保证

单个 `requestId` 内条目的发出时间排序是单调的——活动上下文相对于请求是单线程的，因此 `timestamp` 排序反映发出顺序。UI 层（#1142）消费此保证。

### 不要放在 context 中的内容

ALS context 对象混合到每个下游条目。永远不要存储：
- 原始 tokens、API keys、refresh tokens、OAuth codes
- 原始请求/响应体
- 用户提供的 secrets

只有良性关联元数据：`requestId`、`method`、`path`、`command`、`profile`。

### Worker 线程 / 生成的子进程

ALS context **不**由 worker 线程或 `child_process.spawn` stdio pipes 继承。在这些边界处，在子入口处生成新的 `requestId`，并通过 env var 或头显式传递父 id 以进行关联。

## 重定向

`src/services/logging/log-redaction.ts` 是单一真实来源。

### 敏感 key 匹配器

`SENSITIVE_KEY_PATTERN` 匹配（不区分大小写，带 `_` / `-` / camelCase 变体）：
`authorization`、`proxy-authorization`、`cookie`、`set-cookie`、`password`、`password_hash`、`secret`、`client_secret`、`token`、`auth_token`、`access_token`、`refresh_token`、`id_token`、`bearer`、`assertion`、`api_key`、`x-api-key`、`x-goog-api-key`、`management_key`、`copilot_token`、`cursor_session_key`、`oauth_code`、`auth_code`。

匹配 key 的字符串/对象值替换为 `[redacted]`。数字/布尔值通过（例如 `expires_at` 纪元数保持可读）。

### 认证方案值掩码

前缀匹配 `^(Bearer|Basic|Token)\s+\S+` 的原始字符串值被重写为 `<scheme> [redacted]`，即使嵌套在非敏感 key 下。

### Argv 重定向

`redactArgv(argv)` 重定向敏感标志（`--token`、`--api-key`、`--auth`、`--bearer`、`--secret`、`--client-secret`、`--access-token`、`--refresh-token`、`--id-token`、`--password`）后的值。

### 添加新的敏感 keys

1. 在 `src/services/logging/log-redaction.ts` 中扩展 `SENSITIVE_KEY_PATTERN`。
2. 在 `tests/unit/services/logging/log-redaction-extended.test.ts` 中添加单元测试。
3. 验证正则表达式保持每 key O(1)（无灾难性回溯）。

## 贡献者指南

### 何时使用 `logger.stage()` vs `logger.info()`

每当条目对应于规范生命周期阶段之一时使用 `stage()`——这是可观测性工具和 dashboard 依赖的。使用 `info()` / `warn()` / `error()` 处理不符合阶段的一次性事件。

### 不要记录的内容

- Token 值（使用元数据：`expires_at`、`scopes`、账户显示名称）。
- 请求/响应体（仅采样长度）。
- 授权头（记录存在的头*名称*，而不是值）。

### 级别指导

| 级别 | 用于 |
|-------|-------|
| `error` | 需要操作的失败（cleanup 阶段）。 |
| `warn` | 可恢复问题（认证拒绝、路由回退）。 |
| `info` | 默认的生命周期阶段条目。 |
| `debug` | 高容量细节（每个 chunk 流指标、锁获取/释放）。 |

### 级别配置

默认级别是 `info`。通过 `~/.ccs/config.yaml` 中的 `logging.level` 配置。流式 providers 必须将每个 chunk 指标关在 `debug` 后面。

## 向后兼容

- 所有新的 `LogEntry` 字段（`requestId`、`stage`、`latencyMs`、`error`）都是可选的。旧读者忽略它们。
- `src/commands/`、`src/utils/ui.ts` 和类似面向用户的路径中现有的 `console.*` UX 打印有意**不**转换为 logger。
- 本 PR 中 `/api/logs` 读取器未更改；新字段在 dashboard 上的公开由 #1142 跟踪。

## 未来工作

- 在 dashboard 中公开 `requestId` / `stage` / `latencyMs`（#1142）。
- `ccs logs` CLI 改进（按 `requestId` / `stage` 过滤）。
- 每个阶段性能预算（见 #1071）。
