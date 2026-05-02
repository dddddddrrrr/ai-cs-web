import { apiFetch } from "~/lib/api/client";
import type { Message, Session } from "~/lib/types/api";

const SESSION_STORAGE_KEY = "ai-cs-web:current-session";

export function readCurrentSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

export function writeCurrentSessionId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, id);
}

export function clearCurrentSessionId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function createSession(
  token: string,
  body: { title?: string } = {},
  signal?: AbortSignal,
): Promise<Session> {
  return apiFetch<Session>("/api/v1/sessions", body, { token, signal });
}

export function listSessions(
  token: string,
  signal?: AbortSignal,
): Promise<Session[]> {
  return apiFetch<Session[]>("/api/v1/sessions/list", {}, { token, signal });
}

export function getSession(
  token: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<{ session: Session; messages: Message[] }> {
  return apiFetch<{ session: Session; messages: Message[] }>(
    "/api/v1/sessions/get",
    { sessionId },
    { token, signal },
  );
}

export function listMessages(
  token: string,
  body: { sessionId: string; sinceMessageId?: string; limit?: number },
  signal?: AbortSignal,
): Promise<{ messages: Message[] }> {
  return apiFetch<{ messages: Message[] }>(
    "/api/v1/sessions/messages/list",
    body,
    { token, signal },
  );
}
