import { apiStreamFetch } from "~/lib/api/client";
import { parseSseChunk } from "~/lib/sse/parser";
import type { Message, SessionStreamEvent } from "~/lib/types/api";

export type SubscribeArgs = {
  token: string;
  sessionId: string;
  sinceMessageId?: string;
  signal: AbortSignal;
  onMessage: (msg: Message) => void;
  onHeartbeat?: (ts: number) => void;
};

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15_000;

// 长连接订阅 /api/v1/sessions/events/stream。断线指数退避重连，重连用最后看到的 messageId 续传。
// 仅 signal.aborted 时退出循环。
export async function subscribeSessionEvents(
  args: SubscribeArgs,
): Promise<void> {
  let lastMessageId = args.sinceMessageId;
  let attempt = 0;

  while (!args.signal.aborted) {
    try {
      const res = await apiStreamFetch(
        "/api/v1/sessions/events/stream",
        {
          sessionId: args.sessionId,
          ...(lastMessageId ? { sinceMessageId: lastMessageId } : {}),
        },
        { token: args.token, signal: args.signal },
      );
      attempt = 0; // 连上后重置退避

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      try {
        while (!args.signal.aborted) {
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
            const evt = {
              type: frame.event,
              data: parsed,
            } as SessionStreamEvent;
            if (evt.type === "message") {
              lastMessageId = evt.data.id;
              args.onMessage(evt.data);
            } else if (evt.type === "heartbeat") {
              args.onHeartbeat?.(evt.data.ts);
            }
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
      }
    } catch (err) {
      if (args.signal.aborted) return;
      // 落到下面的退避；不抛
      void err;
    }

    if (args.signal.aborted) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
    attempt += 1;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delay);
      args.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
}
