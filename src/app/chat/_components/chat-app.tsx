"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";
import { streamChat } from "~/lib/api/chat-stream";
import { clearCurrentSessionId, readCurrentSessionId } from "~/lib/api/session";
import { subscribeSessionEvents } from "~/lib/api/session-events";
import { qk } from "~/lib/query/keys";
import {
  useAppendMessages,
  useCreateSession,
  useMessages,
  useSession,
  useVisitor,
} from "~/lib/query/hooks";
import type { ChatStreamEvent, SessionStatus } from "~/lib/types/api";
import { Composer } from "./composer";
import { HandoverBanner } from "./handover-banner";
import { MessageList, type DraftItem } from "./message-list";
import type { ToolCallView } from "./tool-call-card";

type StreamState = {
  status: "idle" | "streaming" | "error";
  draftItems: DraftItem[];
  optimisticUser: { content: string } | null;
  error: string | null;
};

type Action =
  | { type: "send"; content: string }
  | { type: "delta"; text: string }
  | { type: "tool_start"; id: string; name: string }
  | { type: "tool_running"; id: string; name: string; args: unknown }
  | {
      type: "tool_succeeded";
      id: string;
      display: string | null;
      latencyMs: number;
    }
  | { type: "tool_failed"; id: string; error: string; latencyMs: number }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "reset" };

const initial: StreamState = {
  status: "idle",
  draftItems: [],
  optimisticUser: null,
  error: null,
};

function pushDelta(items: DraftItem[], text: string): DraftItem[] {
  const last = items[items.length - 1];
  if (last?.kind === "text") {
    return [...items.slice(0, -1), { kind: "text", text: last.text + text }];
  }
  return [...items, { kind: "text", text }];
}

function patchTool(
  items: DraftItem[],
  id: string,
  patch: Partial<ToolCallView>,
): DraftItem[] {
  return items.map((item) =>
    item.kind === "tool" && item.call.id === id
      ? { kind: "tool", call: { ...item.call, ...patch } }
      : item,
  );
}

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "send":
      return {
        status: "streaming",
        draftItems: [],
        optimisticUser: { content: action.content },
        error: null,
      };
    case "delta":
      return { ...state, draftItems: pushDelta(state.draftItems, action.text) };
    case "tool_start":
      return {
        ...state,
        draftItems: [
          ...state.draftItems,
          {
            kind: "tool",
            call: { id: action.id, name: action.name, status: "started" },
          },
        ],
      };
    case "tool_running":
      return {
        ...state,
        draftItems: patchTool(state.draftItems, action.id, {
          name: action.name,
          status: "running",
        }),
      };
    case "tool_succeeded":
      return {
        ...state,
        draftItems: patchTool(state.draftItems, action.id, {
          status: "succeeded",
          display: action.display,
          latencyMs: action.latencyMs,
        }),
      };
    case "tool_failed":
      return {
        ...state,
        draftItems: patchTool(state.draftItems, action.id, {
          status: "failed",
          error: action.error,
          latencyMs: action.latencyMs,
        }),
      };
    case "done":
      return initial;
    case "error":
      return { ...state, status: "error", error: action.message };
    case "reset":
      return initial;
  }
}

const HANDOVER_STATES: SessionStatus[] = ["pending_human", "assigned"];

export function ChatApp() {
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(reducer, initial);
  const abortRef = useRef<AbortController | null>(null);

  const visitor = useVisitor();
  const token = visitor.data?.token;

  const currentSessionId = useCurrentSessionId(token);
  const session = useSession(token, currentSessionId);
  const messagesQuery = useMessages(token, currentSessionId);
  const appendMessages = useAppendMessages();

  const sessionStatus = session.data?.session.status ?? null;
  const isHandover = sessionStatus
    ? HANDOVER_STATES.includes(sessionStatus)
    : false;

  // 卸载时取消 in-flight chat stream
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // 处于人工接管态时订阅 session events，断线指数退避重连
  useEffect(() => {
    if (!token || !currentSessionId || !isHandover) return;
    const ctrl = new AbortController();
    const messages = messagesQuery.data ?? [];
    const lastId = messages[messages.length - 1]?.id;
    void subscribeSessionEvents({
      token,
      sessionId: currentSessionId,
      sinceMessageId: lastId,
      signal: ctrl.signal,
      onMessage: (msg) => appendMessages(currentSessionId, [msg]),
    });
    return () => ctrl.abort();
    // messagesQuery.data 变化不重启订阅 —— 只用初始值定 sinceMessageId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentSessionId, isHandover]);

  const onSend = async (content: string) => {
    if (!token || !currentSessionId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    dispatch({ type: "send", content });

    try {
      await streamChat({
        token,
        sessionId: currentSessionId,
        content,
        signal: ctrl.signal,
        onEvent: (evt: ChatStreamEvent) => {
          switch (evt.type) {
            case "delta":
              dispatch({ type: "delta", text: evt.data.text });
              break;
            case "tool_call_start":
              dispatch({
                type: "tool_start",
                id: evt.data.id,
                name: evt.data.name,
              });
              break;
            case "tool_call":
              dispatch({
                type: "tool_running",
                id: evt.data.id,
                name: evt.data.name,
                args: evt.data.args,
              });
              break;
            case "tool_result":
              dispatch({
                type: "tool_succeeded",
                id: evt.data.id,
                display: evt.data.display,
                latencyMs: evt.data.latencyMs,
              });
              break;
            case "tool_error":
              dispatch({
                type: "tool_failed",
                id: evt.data.id,
                error: evt.data.error,
                latencyMs: evt.data.latencyMs,
              });
              break;
            case "error":
              dispatch({ type: "error", message: evt.data.message });
              break;
            case "handover_active":
              // session 入口直接判定为已转人工 —— 后端不再调 LLM
              void qc.invalidateQueries({
                queryKey: qk.session(currentSessionId),
              });
              dispatch({ type: "done" });
              break;
            case "done":
              if (evt.data.stopReason === "handover") {
                void qc.invalidateQueries({
                  queryKey: qk.session(currentSessionId),
                });
              }
              void qc.invalidateQueries({
                queryKey: qk.messages(currentSessionId),
              });
              dispatch({ type: "done" });
              break;
            // meta / step —— 暂不处理
          }
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "网络错误";
      dispatch({ type: "error", message });
    }
  };

  const isBootstrapping =
    visitor.isLoading || !currentSessionId || messagesQuery.isLoading;
  const isStreaming = state.status === "streaming";
  const isClosed = sessionStatus === "closed";

  return (
    <>
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-base font-semibold text-zinc-900">AI 客服</h1>
          <span className="text-xs text-zinc-500">
            {sessionStatus === "open"
              ? "在线"
              : sessionStatus === "pending_human"
                ? "等待人工"
                : sessionStatus === "assigned"
                  ? "人工接管中"
                  : sessionStatus === "closed"
                    ? "会话已关闭"
                    : ""}
          </span>
        </div>
      </header>

      {isHandover ? <HandoverBanner /> : null}

      {state.error ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-center text-xs text-rose-700">
          {state.error}
          <button
            type="button"
            onClick={() => dispatch({ type: "reset" })}
            className="ml-2 underline"
          >
            关闭
          </button>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto">
        {isBootstrapping ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            正在连接客服…
          </div>
        ) : (
          <MessageList
            messages={messagesQuery.data ?? []}
            optimisticUser={state.optimisticUser}
            draftItems={state.draftItems}
            isStreaming={isStreaming}
          />
        )}
      </div>

      <Composer
        disabled={
          !token || !currentSessionId || isStreaming || isHandover || isClosed
        }
        onSend={onSend}
      />
    </>
  );
}

// 首次进页没有 sessionId 时自动建一个，建好后稳定下来
function useCurrentSessionId(token: string | undefined): string | null {
  const create = useCreateSession(token);
  const ranRef = useRef(false);

  const stored = typeof window === "undefined" ? null : readCurrentSessionId();

  useEffect(() => {
    if (!token || stored || ranRef.current || create.isPending) return;
    ranRef.current = true;
    create.mutate(undefined, {
      onError: () => {
        ranRef.current = false;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, stored]);

  return stored ?? create.data?.id ?? null;
}

export function resetChatSession() {
  clearCurrentSessionId();
}
