# ai-cs-web

电商场景 AI 客服 agent 的 Web 前端。后端在 `/Users/david/ai-cs/`（Go 单体），本仓库只做 Web，不写后端逻辑。

## Stack

- Next.js 15（App Router, Turbopack）+ React 19
- TypeScript 严格模式
- Tailwind CSS v4
- `@tanstack/react-query` 管服务端状态（visitor / session / messages 缓存）
- `@t3-oss/env-nextjs` + Zod 校验环境变量
- pnpm 10
- **没有** tRPC / Prisma / NextAuth — 后端走 REST + SSE，前端直连

## 后端契约

字段全部 **camelCase**。所有受保护端点走 `Authorization: Bearer <token>` 头（visitor JWT 或 agent/admin JWT）。

### HTTP 端点（访客侧）

| Method + Path | Auth | Body | 说明 |
|---|---|---|---|
| `POST /api/v1/visitors` | 匿名 | `{externalId?, metadata?}` | 返回 `{id, externalId, token, expiresIn}`，`token` 是访客 JWT |
| `POST /api/v1/sessions` | visitor JWT | `{title?}` | 返回 `Session` |
| `POST /api/v1/sessions/list` | visitor JWT | `{}` | 返回 `Session[]` |
| `POST /api/v1/sessions/get` | visitor / agent JWT | `{sessionId}` | 返回 `{session, messages}` |
| `POST /api/v1/sessions/messages/list` | visitor / agent JWT | `{sessionId, sinceMessageId?, limit?}` | 增量拉取，返回 `{messages}` |
| `POST /api/v1/chat/stream` | visitor / agent JWT | `{sessionId, content, model?}` | 单次请求-响应 SSE |
| `POST /api/v1/sessions/events/stream` | visitor / agent JWT | `{sessionId, sinceMessageId?}` | 长连接 SSE，含 15s 心跳；用来收坐席消息 |
| `POST /api/v1/tool-actions/confirm` | visitor / agent JWT | 见后端 `internal/handler/tool_action.go` | 工具人审通过 |
| `POST /api/v1/tool-actions/cancel` | 同上 | 同上 | 工具人审取消 |

`/admin/*` 是坐席/管理员端点，本仓库不调。

### SSE 事件 — `/api/v1/chat/stream`

```
meta              {model, sessionId}
delta             {text}
tool_call_start   {id, name, status:"started"}
tool_call         {id, name, status:"running", args}
tool_result       {id, name, status:"succeeded", ok:true, display, data, latencyMs}
tool_error        {id, name, status:"failed", ok:false, error, latencyMs}
step              {n, stopReason}
error             {message}
handover_active   {status, message}
done              {steps, usage:{promptTokens,completionTokens,totalTokens},
                   stopReason, finalMessage}
                  // stopReason ∈ {stop, tool_use, length, max_steps, handover, error}
```

约定：

- `tool_result.display` — 一行摘要，**给 UI 渲染**
- `tool_result.data` — 结构化原始 payload，**只给 LLM / 调试用，不要直接展示给用户**
- `done(stopReason: "handover")` 或 `handover_active` — 已转人工，UI 切到"人工接管"态，关闭 LLM 输入入口，去订阅 `/sessions/events/stream`
- 没有 `sources` 事件（RAG 引用走子 agent，下一版另议）

### SSE 事件 — `/api/v1/sessions/events/stream`

```
message    Message            // 含 backlog + 实时下发；带 id，前端按 id 去重
heartbeat  {ts}               // 每 15s 一次
```

### 数据模型相关字段

- `Session.status`：`open | pending_human | assigned | closed`
- `Message.role`：`system | user | assistant | tool | agent`
  - `agent` = 人工坐席消息（不喂给 LLM，但前端要显示为第三种气泡）
- `Message.toolCalls`：`assistant` 角色才有，`[{id, name, arguments}]`
- `Message.toolCallId` / `Message.toolName`：`tool` 角色专用
- `Message.meta`：jsonb，含 `{model, tokens, toolCalls, agentRunId}`

### 工程约束

- Session 必须先 `POST /sessions` 创建，再 `POST /chat/stream`，**没有 auto-create**
- POST 不能用 `EventSource`（它只支持 GET），必须 `fetch` + `ReadableStream` 手动解析 SSE 帧
- CORS：后端默认 `corsOrigins: *` + `allowCredentials: true`，浏览器互斥，本地需在后端 `config.yaml` 把 `corsOrigins` 显式写成 `http://localhost:3000`

## 工作偏好

- **最小改动**：修 bug 只动相关代码，不做顺手的重构 / 重命名。三段相似代码先重复，不急着抽。
- **服务端状态走 react-query**：visitor / session / messages 这类 REST 缓存默认用 `@tanstack/react-query`；SSE 流式部分仍走 raw `fetch` + `useReducer`。
- **不预设未来**：除了已选定的依赖外，别为"未来可能用到"再引 UI 库 / 状态管理 / 数据获取库。
- **不暴露上游 provider**：UI 不出现 OpenAI / Anthropic / 模型名 / 后端工具名；对用户统一叫 "AI 客服"。
- **SSE 协议是对外契约**：后端那边多个渠道（tg bot / 微信 / web）共用，不要在前端给字段起别名 / 改 case。
- **本地 dev / 浏览器验证由用户自己跑**：agent 改完代码跑 `pnpm check` 就够，不要主动 `pnpm dev` 或调浏览器 MCP。
- **环境变量走 `src/env.js`**：加变量同时声明 schema；禁止直接 `process.env.X`。客户端变量必须 `NEXT_PUBLIC_` 前缀。

## 命令

- `pnpm dev` — 本地开发（用户自己跑）
- `pnpm check` — `next lint && tsc --noEmit`，**agent 验证用这个**
- `pnpm build` — 生产构建
- `pnpm format:write` — Prettier 格式化

## 目录约定

- `src/app/` — App Router 路由
- `src/app/chat/` — 访客对话窗口
- `src/lib/api/` — REST 客户端（纯函数）+ SSE 消费器
- `src/lib/query/` — react-query Provider / keys / hooks
- `src/lib/sse/` — 极简 SSE 帧解析器
- `src/lib/types/` — 后端契约 TS 类型
- `src/env.js` — 环境变量 schema
- `src/styles/globals.css` — Tailwind v4 入口

## 不要做

- 不要在本仓库写后端逻辑或代理后端 API；需要新接口去 `/Users/david/ai-cs/` 加。
- 不要把 visitor JWT / 坐席 token 硬编码；走 env / localStorage / 后端下发。
- 不要新建 README 之外的文档文件，除非用户明说。
- 不要在文档 / 代码里用 emoji，除非用户明说。
- 不要 `git push` / 改 git config / 跳过 hook，除非用户明说。
