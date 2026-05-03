"use client";

import { useState, type KeyboardEvent } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

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
    <div className="border-border bg-background border-t p-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={
            disabled ? "请稍候…" : "输入消息，Enter 发送 / Shift+Enter 换行"
          }
          className="[field-sizing:fixed] max-h-40 min-h-[40px] flex-1 resize-none rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-2 text-sm leading-relaxed focus-visible:border-emerald-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/15"
        />
        <Button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="h-10 shrink-0 rounded-full px-5"
        >
          发送
        </Button>
      </div>
    </div>
  );
}
