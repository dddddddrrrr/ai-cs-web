import { apiStreamFetch } from "~/lib/api/client";
import { parseSseChunk } from "~/lib/sse/parser";
import type { ChatStreamEvent } from "~/lib/types/api";

export type StreamChatArgs = {
  token: string;
  sessionId: string;
  content: string;
  model?: string;
  signal?: AbortSignal;
  onEvent: (evt: ChatStreamEvent) => void;
};

// 消费 POST /api/v1/chat/stream。每收到一个 SSE 帧就回调；流自然结束或被 abort 时返回。
// 不抛 AbortError —— 上层取消是预期行为。其它错误向上抛。
export async function streamChat(args: StreamChatArgs): Promise<void> {
  const { token, sessionId, content, model, signal, onEvent } = args;

  let res: Response;
  try {
    res = await apiStreamFetch(
      "/api/v1/chat/stream",
      { sessionId, content, ...(model ? { model } : {}) },
      { token, signal },
    );
  } catch (err) {
    if (signal?.aborted) return;
    throw err;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseChunk(buf);
      buf = rest;
      for (const frame of events) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(frame.data);
        } catch {
          continue;
        }
        onEvent({
          type: frame.event,
          data: parsed,
        } as ChatStreamEvent);
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    throw err;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // 已释放或中断，忽略
    }
  }
}
