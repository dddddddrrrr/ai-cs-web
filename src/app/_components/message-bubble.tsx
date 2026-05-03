"use client";

import type { Message } from "~/lib/types/api";

const ROLE_LABEL: Record<Message["role"], string> = {
  user: "我",
  assistant: "AI 客服",
  agent: "人工客服",
  tool: "工具",
  system: "系统",
};

export function MessageBubble({
  role,
  content,
  pending,
}: {
  role: Message["role"];
  content: string;
  pending?: boolean;
}) {
  if (role === "system" || role === "tool") return null;

  const isUser = role === "user";
  const isAgent = role === "agent";
  const align = isUser ? "items-end" : "items-start";
  const bubble = isUser
    ? "bg-primary text-primary-foreground"
    : isAgent
      ? "border border-amber-300 bg-amber-50 text-zinc-900"
      : "border bg-card text-card-foreground";

  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      <span className="text-muted-foreground px-1 text-xs">
        {ROLE_LABEL[role]}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${bubble}`}
      >
        {content || (pending ? "…" : "")}
      </div>
    </div>
  );
}
