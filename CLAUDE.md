@AGENTS.md

## Claude-specific

- 回复保持简洁；不要末尾总结"我做了什么"，diff 自己会说话。
- skill 只在用户明确触发或明显匹配时跑，不要每条消息都先过一遍 skill。
- UI 验证由用户自己看；不要自己开 dev server / 浏览器 MCP 来"确认效果"。
- 跨仓库引用后端时直接读 `/Users/david/ai-cs/` 源码，不要靠记忆推断 API 形状。

## 源码地图

```
src/
├── env.js                          # 唯一的环境变量入口（@t3-oss/env-nextjs + Zod）
├── styles/globals.css              # Tailwind CSS v4 + oklch 主题变量
├── lib/
│   ├── types/api.ts                # 所有后端契约 TS 类型（单一来源）
│   ├── sse/parser.ts               # SSE 帧解析器（parseSseChunk）
│   ├── utils.ts                    # cn() = clsx + tailwind-merge
│   ├── api/
│   │   ├── client.ts               # apiFetch / apiStreamFetch / ApiError
│   │   ├── visitor.ts              # bootstrapVisitor（创建/复用 localStorage JWT）
│   │   ├── session.ts              # createSession / listSessions / getSession / listMessages
│   │   ├── chat-stream.ts          # streamChat（POST SSE /api/v1/chat/stream）
│   │   ├── session-events.ts       # subscribeSessionEvents（长连 SSE + 指数退避重连）
│   │   └── tool-action.ts          # confirmToolAction / cancelToolAction / newIdempotencyKey
│   └── query/
│       ├── provider.tsx            # QueryClientProvider（staleTime 30s，1 retry，不聚焦刷新）
│       ├── keys.ts                 # qk.visitor / .sessions / .session / .messages
│       └── hooks.ts                # useVisitor / useSessions / useSession / useMessages
│                                   # useCreateSession / useAppendMessages
├── components/ui/                  # shadcn/ui 基础组件（button / textarea / card / alert / avatar）
└── app/
    ├── layout.tsx                  # Root layout：Geist 字体 + QueryProvider
    ├── page.tsx                    # 首页，直接渲染 <ChatApp>
    └── _components/
        ├── chat-app.tsx            # 主容器（见下方）
        ├── message-list.tsx        # 消息列表 + 自动滚底 + 空态
        ├── message-bubble.tsx      # 单条气泡（user/assistant/agent；过滤 system/tool）
        ├── composer.tsx            # 输入框 + 发送按钮（Enter 发送，Shift+Enter 换行）
        ├── handover-banner.tsx     # 转人工提示横幅
        └── tool-call-card.tsx      # 工具执行卡片 + 待确认操作卡片（含倒计时）
```

## 组件架构与数据流

```
ChatApp
 ├─ [react-query] useVisitor        → 访客 JWT（staleTime: Infinity，localStorage 缓存）
 ├─ [react-query] useSession        → Session 状态（open/pending_human/assigned/closed）
 ├─ [react-query] useMessages       → 历史消息列表
 ├─ [react-query] useCreateSession  → 建 Session mutation
 ├─ [useReducer]  streamState       → 流式中间状态（见下方）
 ├─ [useRef]      abortRef          → 取消正在进行的 fetch
 ├─ [useRef]      ranRef            → 防重复建 Session
 ├─ [useRef]      idemKeysRef       → 工具确认幂等键
 │
 ├── subscribeSessionEvents()  ─── 仅 isHandover 时激活，长连 SSE，追加坐席消息到缓存
 │
 ├── MessageList
 │    ├── MessageBubble              ← 历史消息（react-query 缓存）
 │    ├── MessageBubble (optimistic) ← 乐观用户消息
 │    ├── ToolCallCard               ← 流式工具调用
 │    ├── MessageBubble (draft text) ← 流式 AI 文本
 │    └── typing indicator
 ├── HandoverBanner
 ├── Composer                        ← disabled 条件：streaming / handover / closed
 └── error banner
```

## StreamState（useReducer）

```typescript
type StreamStatus = "idle" | "streaming" | "error";

type DraftItem =
  | { kind: "text"; text: string }
  | { kind: "tool"; call: LiveToolCall };

type StreamState = {
  status: StreamStatus;
  draftItems: DraftItem[];
  optimisticUser: { content: string } | null;
  error: string | null;
};
```

主要 action：`send` → `delta` / `tool_start` / `tool_running` / `tool_succeeded` / `tool_failed` / `attach_pending` → `done` / `error`

工具确认 action：`action_in_flight` / `action_resolved` / `action_expired` / `action_failed` / `reset`

`done` 触发时将 draftItems 清空并调用 `useAppendMessages` 写入 react-query 缓存。

## 关键实现细节

**SSE 解析**：`parseSseChunk(buffer)` 返回 `{ events: RawSseFrame[]; rest: string }`；调用方做 JSON.parse。支持 `\r\n` 和 `\n`，按空行分帧。

**访客 JWT**：`bootstrapVisitor()` 优先读 localStorage，有效期剩余 >5min 则复用，否则重新 POST `/api/v1/visitors`。不要用 `clearVisitor()` 除非要重置身份。

**Session 生命周期**：`useCurrentSessionId` hook 在挂载时从 localStorage 读 id，无则调 `useCreateSession`。`writeCurrentSessionId` 写 localStorage；切 session 时调 `readCurrentSessionId`。

**工具确认流程**：
1. SSE `tool_call_start`（status: started）→ reducer `tool_start`
2. SSE `tool_call`（status: running）→ reducer `tool_running`，含 `pendingToolAction`
3. reducer `attach_pending` 把 PendingToolAction 附加到对应 LiveToolCall
4. `PendingActionCard` 渲染倒计时 + 确认/取消按钮
5. 点击 → `confirmToolAction` / `cancelToolAction` → reducer `action_in_flight`
6. 后端继续 stream，最终 `tool_result` 或 `tool_error` → reducer `tool_succeeded` / `tool_failed`

**转人工**：`done(stopReason: "handover")` 或 `handover_active` 事件到达后，Session status 变为 `pending_human` 或 `assigned`，Composer 禁用，`subscribeSessionEvents` 激活（通过 `isHandover` flag 触发 useEffect）。

**Session events 重连**：`subscribeSessionEvents` 内部指数退避（初始 1s，最大 15s），携带 `sinceMessageId` 做增量同步，收到 `message` 事件调用 `onMessage` 回调追加缓存。

## 类型速查（src/lib/types/api.ts）

```typescript
Session.status:   "open" | "pending_human" | "assigned" | "closed"
Message.role:     "system" | "user" | "assistant" | "tool" | "agent"
// "agent" = 人工坐席消息，不喂 LLM，气泡显示为第三种样式（琥珀色）
// "tool"  = tool result，不渲染气泡（message-bubble.tsx 过滤掉）

ChatStreamEvent:  meta | delta | tool_call_start | tool_call | tool_result |
                  tool_error | step | error | handover_active | done

SessionStreamEvent: message | heartbeat
```

## 环境变量

`src/env.js` 是唯一合法入口，禁止直接 `process.env.X`：

```typescript
// server-only
NODE_ENV: z.enum(["development", "test", "production"])

// client（需 NEXT_PUBLIC_ 前缀）
NEXT_PUBLIC_AI_CS_API_BASE: z.string().url()  // 后端 base URL，如 http://localhost:8080
```

加新变量时同时在 `env.js` 声明 schema 和 `runtimeEnv`。
