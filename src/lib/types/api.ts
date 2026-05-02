// 后端契约类型，对齐 /Users/david/ai-cs/internal/domain/* 的 Go struct + JSON tag。
// 字段命名与后端 JSON marshaling 一致（camelCase）。

export type SessionStatus = "open" | "pending_human" | "assigned" | "closed";

export type MessageRole = "system" | "user" | "assistant" | "tool" | "agent";

export type Visitor = {
  id: string;
  externalId: string;
  token: string;
  expiresIn: number;
};

export type Session = {
  id: string;
  visitorId: string;
  agentId: string | null;
  status: SessionStatus;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: unknown;
};

export type Message = {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string | null;
  toolName?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
};

// /api/v1/chat/stream 的 SSE 事件 discriminated union
export type SseUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type ChatStreamEvent =
  | { type: "meta"; data: { model: string; sessionId: string } }
  | { type: "delta"; data: { text: string } }
  | {
      type: "tool_call_start";
      data: { id: string; name: string; status: "started" };
    }
  | {
      type: "tool_call";
      data: { id: string; name: string; status: "running"; args: unknown };
    }
  | {
      type: "tool_result";
      data: {
        id: string;
        name: string;
        status: "succeeded";
        ok: true;
        display: string | null;
        data: unknown;
        latencyMs: number;
      };
    }
  | {
      type: "tool_error";
      data: {
        id: string;
        name: string;
        status: "failed";
        ok: false;
        error: string;
        latencyMs: number;
      };
    }
  | { type: "step"; data: { n: number; stopReason: string } }
  | { type: "error"; data: { message: string } }
  | { type: "handover_active"; data: { status: string; message: string } }
  | {
      type: "done";
      data: {
        steps: number;
        usage: SseUsage;
        stopReason:
          | "stop"
          | "tool_use"
          | "length"
          | "max_steps"
          | "handover"
          | "error";
        finalMessage: string;
      };
    };

// /api/v1/sessions/events/stream 的 SSE 事件
export type SessionStreamEvent =
  | { type: "message"; data: Message }
  | { type: "heartbeat"; data: { ts: number } };

// 通用：解析后还没分发到具体 union 的中间形态
export type RawSseFrame = {
  event: string;
  data: string; // 原始 JSON 字符串，未 parse
};
