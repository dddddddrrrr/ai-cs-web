"use client";

export type ToolCallView = {
  id: string;
  name: string;
  status: "started" | "running" | "succeeded" | "failed";
  display?: string | null;
  error?: string;
  latencyMs?: number;
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

export function ToolCallCard({ call }: { call: ToolCallView }) {
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
