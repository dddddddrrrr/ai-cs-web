"use client";

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";

export type PendingActionView = {
  actionId: string;
  expiresAt: string;
  uiStatus:
    | "pending"
    | "confirming"
    | "cancelling"
    | "confirmed"
    | "cancelled"
    | "expired"
    | "failed";
  resultDisplay?: string | null;
  resultError?: string;
};

export type ToolCallView = {
  id: string;
  name: string;
  status: "started" | "running" | "succeeded" | "failed";
  args?: unknown;
  display?: string | null;
  error?: string;
  latencyMs?: number;
  pendingAction?: PendingActionView;
};

const STATUS_LABEL: Record<ToolCallView["status"], string> = {
  started: "准备中",
  running: "处理中",
  succeeded: "已完成",
  failed: "失败",
};

const STATUS_DOT: Record<ToolCallView["status"], string> = {
  started: "bg-zinc-300",
  running: "animate-pulse bg-emerald-500",
  succeeded: "bg-emerald-500",
  failed: "bg-rose-500",
};

type Props = {
  call: ToolCallView;
  onConfirm?: (actionId: string) => void;
  onCancel?: (actionId: string) => void;
};

export function ToolCallCard({ call, onConfirm, onCancel }: Props) {
  if (call.pendingAction) {
    return (
      <PendingActionCard
        name={call.name}
        args={call.args}
        pending={call.pendingAction}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }

  const isRunning = call.status === "started" || call.status === "running";
  const isFailed = call.status === "failed";

  return (
    <div className="max-w-[85%] self-start">
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 shadow-sm">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[call.status]}`}
        />
        <span className="font-medium text-zinc-900">{call.name}</span>
        <span className="text-zinc-500">·</span>
        <span className={isFailed ? "text-rose-600" : "text-zinc-500"}>
          {STATUS_LABEL[call.status]}
        </span>
        {call.status === "succeeded" && call.display ? (
          <>
            <span className="text-zinc-300">·</span>
            <span className="truncate">{call.display}</span>
          </>
        ) : null}
        {isFailed && call.error ? (
          <>
            <span className="text-zinc-300">·</span>
            <span className="truncate text-rose-600">{call.error}</span>
          </>
        ) : null}
        {!isRunning && typeof call.latencyMs === "number" ? (
          <span className="ml-auto pl-2 text-zinc-400">
            {Math.round(call.latencyMs)}ms
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PendingActionCard({
  name,
  args,
  pending,
  onConfirm,
  onCancel,
}: {
  name: string;
  args: unknown;
  pending: PendingActionView;
  onConfirm?: (actionId: string) => void;
  onCancel?: (actionId: string) => void;
}) {
  const remaining = useCountdown(pending.expiresAt);
  const expiredByTime = remaining <= 0;
  const status =
    pending.uiStatus === "pending" && expiredByTime
      ? "expired"
      : pending.uiStatus;
  const isAwaiting = status === "pending";
  const isInFlight = status === "confirming" || status === "cancelling";
  const isResolved =
    status === "confirmed" ||
    status === "cancelled" ||
    status === "expired" ||
    status === "failed";

  return (
    <div className="w-full max-w-[85%] self-start rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-900">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span className="font-medium">需要您确认</span>
          <span className="text-xs text-amber-700">· {name}</span>
        </div>
        {isAwaiting ? (
          <span className="text-xs text-amber-700">
            {formatRemaining(remaining)} 后过期
          </span>
        ) : null}
      </div>

      {args !== undefined && args !== null ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-white/70 p-2 text-xs text-zinc-700">
          {prettyArgs(args)}
        </pre>
      ) : null}

      {status === "confirmed" && pending.resultDisplay ? (
        <div className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
          已确认 · {pending.resultDisplay}
        </div>
      ) : null}
      {status === "confirmed" && !pending.resultDisplay ? (
        <div className="mt-2 text-xs text-emerald-800">已确认</div>
      ) : null}
      {status === "cancelled" ? (
        <div className="mt-2 text-xs text-zinc-600">已取消</div>
      ) : null}
      {status === "expired" ? (
        <div className="mt-2 text-xs text-zinc-500">操作已过期，未执行</div>
      ) : null}
      {status === "failed" && pending.resultError ? (
        <div className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
          执行失败 · {pending.resultError}
        </div>
      ) : null}

      {!isResolved ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCancel?.(pending.actionId)}
            disabled={isInFlight || !onCancel}
            className="h-auto rounded-full border-zinc-300 px-4 py-1 text-xs font-medium text-zinc-700"
          >
            {status === "cancelling" ? "取消中…" : "取消"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onConfirm?.(pending.actionId)}
            disabled={isInFlight || !onConfirm}
            className="h-auto rounded-full px-4 py-1 text-xs font-medium"
          >
            {status === "confirming" ? "确认中…" : "确认执行"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function useCountdown(expiresAt: string): number {
  const expiresMs = Date.parse(expiresAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Number.isNaN(expiresMs)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresMs]);
  if (Number.isNaN(expiresMs)) return 0;
  return Math.max(0, expiresMs - now);
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m}m${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function prettyArgs(args: unknown): string {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}
