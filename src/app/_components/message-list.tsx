"use client";

import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import type { Message } from "~/lib/types/api";
import { MessageBubble } from "./message-bubble";
import { ToolCallCard, type ToolCallView } from "./tool-call-card";

export type DraftItem =
  | { kind: "text"; text: string }
  | { kind: "tool"; call: ToolCallView };

type Props = {
  messages: Message[];
  optimisticUser: { content: string } | null;
  draftItems: DraftItem[];
  isStreaming: boolean;
  onConfirmAction?: (actionId: string) => void;
  onCancelAction?: (actionId: string) => void;
};

export function MessageList({
  messages,
  optimisticUser,
  draftItems,
  isStreaming,
  onConfirmAction,
  onCancelAction,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, draftItems.length, optimisticUser?.content]);

  if (
    messages.length === 0 &&
    !optimisticUser &&
    draftItems.length === 0 &&
    !isStreaming
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <Avatar size="lg" className="shadow-sm">
          <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-semibold text-white">
            AI
          </AvatarFallback>
        </Avatar>
        <div className="text-foreground text-base font-medium">
          你好，有什么可以帮你的？
        </div>
        <div className="text-muted-foreground max-w-xs text-sm">
          可以问订单状态、物流、退换货等问题
        </div>
      </div>
    );
  }

  // 流式中没有任何 draft item 时，给个 typing 占位
  const showTypingPlaceholder = isStreaming && draftItems.length === 0;

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      {messages.map((m) => (
        <MessageBubble key={m.id} role={m.role} content={m.content} />
      ))}
      {optimisticUser ? (
        <MessageBubble role="user" content={optimisticUser.content} />
      ) : null}
      {draftItems.map((item, idx) =>
        item.kind === "text" ? (
          <MessageBubble
            key={`draft-text-${idx}`}
            role="assistant"
            content={item.text}
          />
        ) : (
          <ToolCallCard
            key={`draft-tool-${item.call.id}`}
            call={item.call}
            onConfirm={onConfirmAction}
            onCancel={onCancelAction}
          />
        ),
      )}
      {showTypingPlaceholder ? (
        <MessageBubble role="assistant" content="" pending />
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
