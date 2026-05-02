"use client";

import { useEffect, useRef } from "react";
import type { Message } from "~/lib/types/api";
import { MessageBubble } from "./message-bubble";

type Props = {
  messages: Message[];
  optimisticUser: { content: string } | null;
  assistantDraft: string | null;
  isStreaming: boolean;
};

export function MessageList({
  messages,
  optimisticUser,
  assistantDraft,
  isStreaming,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, assistantDraft, optimisticUser?.content]);

  if (
    messages.length === 0 &&
    !optimisticUser &&
    !assistantDraft &&
    !isStreaming
  ) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
        你好，我是 AI 客服。请描述你的问题，我会尽力帮你处理。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      {messages.map((m) => (
        <MessageBubble key={m.id} role={m.role} content={m.content} />
      ))}
      {optimisticUser ? (
        <MessageBubble role="user" content={optimisticUser.content} />
      ) : null}
      {assistantDraft !== null || isStreaming ? (
        <MessageBubble
          role="assistant"
          content={assistantDraft ?? ""}
          pending={isStreaming && !assistantDraft}
        />
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
