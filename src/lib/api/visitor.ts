import { apiFetch } from "~/lib/api/client";
import type { Visitor } from "~/lib/types/api";

const STORAGE_KEY = "ai-cs-web:visitor";
// 提前 5 分钟视为过期，留出网络抖动余量
const EXPIRY_SAFETY_WINDOW_S = 5 * 60;

type StoredVisitor = {
  id: string;
  externalId: string;
  token: string;
  expiresAt: number; // unix seconds
};

function readStored(): StoredVisitor | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredVisitor;
    if (
      typeof parsed.token === "string" &&
      typeof parsed.expiresAt === "number"
    ) {
      return parsed;
    }
  } catch {
    // 损坏的存储值，下面会清掉
  }
  window.localStorage.removeItem(STORAGE_KEY);
  return null;
}

function writeStored(v: StoredVisitor): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
}

function isFresh(v: StoredVisitor): boolean {
  return v.expiresAt - EXPIRY_SAFETY_WINDOW_S > Math.floor(Date.now() / 1000);
}

export async function bootstrapVisitor(
  signal?: AbortSignal,
): Promise<StoredVisitor> {
  const cached = readStored();
  if (cached && isFresh(cached)) return cached;

  const fresh = await apiFetch<Visitor>("/api/v1/visitors", {}, { signal });
  const stored: StoredVisitor = {
    id: fresh.id,
    externalId: fresh.externalId,
    token: fresh.token,
    expiresAt: Math.floor(Date.now() / 1000) + fresh.expiresIn,
  };
  writeStored(stored);
  return stored;
}

export function clearVisitor(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
