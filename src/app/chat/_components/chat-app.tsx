"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";
import { streamChat } from "~/lib/api/chat-stream";
import { clearCurrentSessionId, readCurrentSessionId } from "~/lib/api/session";
import { qk } from "~/lib/query/keys";
import {
  useCreateSession,
  useMessages,
  useSession,
  useVisitor,
} from "~/lib/query/hooks";
import type { ChatStreamEvent } from "~/lib/types/api";
import { Composer } from "./composer";
import { MessageList } from "./message-list";

type StreamState = {
  status: "idle" | "streaming" | "error";
  draft: string;
  optimisticUser: { content: string } | null;
  error: string | null;
};

type Action =
  | { type: "send"; content: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "reset" };

const initial: StreamState = {
  status: "idle",
  draft: "",
  optimisticUser: null,
  error: null,
};

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "send":
      return {
        status: "streaming",
        draft: "",
        optimisticUser: { content: action.content },
        error: null,
      };
    case "delta":
      return { ...state, draft: state.draft + action.text };
    case "done":
      return initial;
    case "error":
      return { ...state, status: "error", error: action.message };
    case "reset":
      return initial;
  }
}

export function ChatApp() {
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(reducer, initial);
  const abortRef = useRef<AbortController | null>(null);

  const visitor = useVisitor();
  const token = visitor.data?.token;

  // 选定当前 sessionId：localStorage 优先；没有就走 createSession mutation
  const currentSessionId = useCurrentSessionId(token);
  const session = useSession(token, currentSessionId);
  const messagesQuery = useMessages(token, currentSessionId);

  // 卸载时取消 in-flight stream
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

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
          if (evt.type === "delta") {
            dispatch({ type: "delta", text: evt.data.text });
          } else if (evt.type === "error") {
            dispatch({ type: "error", message: evt.data.message });
          } else if (evt.type === "done") {
            // 拉一次最新历史，让缓存与服务端对齐；reducer 紧跟着 reset
            void qc.invalidateQueries({
              queryKey: qk.messages(currentSessionId),
            });
            dispatch({ type: "done" });
          }
          // tool_* / step / handover_active / meta —— PR3 处理
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

  return (
    <>
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-base font-semibold text-zinc-900">AI 客服</h1>
          <span className="text-xs text-zinc-500">
            {session.data?.session.status === "open"
              ? "在线"
              : (session.data?.session.status ?? "")}
          </span>
        </div>
      </header>

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
            assistantDraft={isStreaming ? state.draft : null}
            isStreaming={isStreaming}
          />
        )}
      </div>

      <Composer
        disabled={!token || !currentSessionId || isStreaming}
        onSend={onSend}
      />
    </>
  );
}

// 解决 "首次进页没有 sessionId 时自动建一个，建好后稳定下来" 这件事
function useCurrentSessionId(token: string | undefined): string | null {
  const create = useCreateSession(token);
  const ranRef = useRef(false);

  // 客户端挂载后先读 localStorage 里的旧 sessionId
  const stored = typeof window === "undefined" ? null : readCurrentSessionId();

  useEffect(() => {
    if (!token || stored || ranRef.current || create.isPending) return;
    ranRef.current = true;
    create.mutate(undefined, {
      onError: () => {
        ranRef.current = false; // 失败允许下一次重试
      },
    });
    // create.mutate / create.isPending 引用稳定，不入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, stored]);

  // 失效的 sessionId（404）由调用方决定是否清；MVP 不处理
  return stored ?? create.data?.id ?? null;
}

// 暴露给将来"重置会话"功能用
export function resetChatSession() {
  clearCurrentSessionId();
}
