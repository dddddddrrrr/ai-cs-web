"use client";

import { useState, type KeyboardEvent } from "react";

type Props = {
  disabled: boolean;
  onSend: (content: string) => void;
};

export function Composer({ disabled, onSend }: Props) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-zinc-200 bg-white p-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={
            disabled ? "请稍候…" : "输入消息，Enter 发送 / Shift+Enter 换行"
          }
          className="max-h-40 min-h-[40px] flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm leading-relaxed text-zinc-900 transition outline-none focus:border-emerald-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="h-10 shrink-0 rounded-full bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
