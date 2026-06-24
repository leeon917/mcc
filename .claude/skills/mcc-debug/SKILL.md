---
name: mcc-debug
description: 分析 MCC 运行时 bug——读取 session 日志和 proxy 日志，定位错误根因并给出修复建议。当用户说「有 bug」「报错了」「看一下日志」「debug 一下」「为什么报 4xx」「mcc 出错了」「proxy 报错」「glm/qwen/deepseek 用不了」「分析一下这个问题」等时触发。
---

# mcc-debug

读取 MCC 的运行时日志，分析错误根因，给出具体修复建议。

## 日志结构

```
~/.mcc/logs/<profile>/
├── sessions/<YYYY-MM-DD_HH-MM-SS>/mcc.log   ← 每次 mcc launch 的主进程日志
└── proxy/<YYYY-MM-DD>/mcc.log                ← proxy daemon 日志（OpenAI 兼容 profile 才有）
```

**功能分区先于时间分区**：session 和 proxy 是两个独立的 actor，分开存放。

## 工作流

### 1. 确认 profile

从上下文判断用户在说哪个 profile。如果上下文不明确，先运行：

```bash
cat ~/.mcc/profiles.json | python3 -m json.tool
```

列出所有 profile 的 name、protocol、baseUrl、model，让用户确认出问题的是哪个。

### 2. 找最新日志

```bash
# 最新 session 日志
ls -t ~/.mcc/logs/<profile>/sessions/ | head -3

# 最新 proxy 日志（openai 协议 profile 才有）
ls -t ~/.mcc/logs/<profile>/proxy/ | head -3
```

读取最新的日志目录下的 `mcc.log`。

### 3. 区分错误类型

根据日志内容，优先判断是哪个层出的问题：

| 错误特征 | 所在层 | 日志位置 |
|---------|--------|---------|
| `upstream error: 4xx` | 上游 API | proxy 日志 |
| `authentication_error` | API Key 无效 | proxy 日志 |
| `request failed: AbortError` | 超时 | proxy 日志 |
| `server error:` | proxy 进程崩溃 | proxy 日志 |
| `Failed to start translation proxy` | proxy 启动失败 | session 日志 |
| profile/key 相关报错 | 本地配置 | session 日志 |

### 4. 常见错误的诊断路径

#### 上游 API 4xx（最常见）

proxy 日志里有完整的错误 body：
```
ERROR [PROXY] ← 400 upstream error: {"error":{"code":"...","message":"..."}}
```

检查：
- **400 code=1210（GLM）**：参数错误，通常是模型名不支持或 API 字段不兼容
- **401**：API Key 无效或过期 → `cat ~/.mcc/profiles/<profile>/.key` 确认 key 存在；检查 profile 的 baseUrl 和 key 是否匹配
- **403**：权限不足，联系 provider 确认账户状态
- **429**：限速，等待或换 profile
- **500/502**：上游服务故障，等待或换 provider

#### proxy 未启动 / 连接失败

session 日志里有 `Failed to start translation proxy`。检查：
```bash
cat ~/.mcc/proxy/<profile>.session.json   # proxy session 状态
cat ~/.mcc/proxy/<profile>.daemon.pid     # PID
kill -0 <pid>                             # 进程是否存活
```

#### API Key 相关

```bash
cat ~/.mcc/profiles/<profile>/.key        # 检查 key 内容（小心别打印到 terminal）
cat ~/.mcc/profiles.json                  # 检查 baseUrl、model 字段
```

#### 请求参数问题（debug 级别）

若需要看完整的 upstream 请求体：
```bash
MCC_LOG_LEVEL=debug mcc <profile>
```

然后在 proxy 日志里找 `DEBUG [PROXY] upstream body:` 行，能看到实际发给上游 API 的 JSON。

### 5. 汇报

给出：
1. **根因**：一句话说清楚出了什么问题
2. **证据**：引用日志里的关键行
3. **修复**：具体操作步骤（不是泛泛建议）

## 常见坑（从 lessons.md 学来的）

- **GLM error 1210**：OpenAI 兼容 API 不接受 `metadata` 字段，MCC 已在 proxy-server.ts 中剔除；若仍报错，检查 `lib/proxy/transformers/request-transformer.js` 是否有其他不兼容字段
- **proxy 有日志但 session 没有**：proxy 是 detached daemon，跨 session 存活，日志在 `proxy/<date>/` 而不在 `sessions/`
- **当天 proxy 日志空**：proxy 可能复用了昨天启动的进程，日志在昨天的日期目录里
