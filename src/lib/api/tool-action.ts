import { apiFetch } from "~/lib/api/client";
import type { PendingToolAction } from "~/lib/types/api";

export function confirmToolAction(
  token: string,
  actionId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<PendingToolAction> {
  return apiFetch<PendingToolAction>(
    "/api/v1/tool-actions/confirm",
    { actionId, idempotencyKey },
    { token, signal },
  );
}

export function cancelToolAction(
  token: string,
  actionId: string,
  signal?: AbortSignal,
): Promise<PendingToolAction> {
  return apiFetch<PendingToolAction>(
    "/api/v1/tool-actions/cancel",
    { actionId },
    { token, signal },
  );
}

// 调用方在第一次点击 Confirm 时调，存到组件状态里；网络重试用同一把 key 保证幂等。
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // 降级：时间戳 + 随机；MVP 场景不严格
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
