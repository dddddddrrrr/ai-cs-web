"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createSession,
  getSession,
  listMessages,
  listSessions,
  writeCurrentSessionId,
} from "~/lib/api/session";
import { bootstrapVisitor } from "~/lib/api/visitor";
import { qk } from "~/lib/query/keys";
import type { Message, Session } from "~/lib/types/api";

export function useVisitor() {
  return useQuery({
    queryKey: qk.visitor(),
    queryFn: ({ signal }) => bootstrapVisitor(signal),
    staleTime: Infinity, // token 自身有过期判断
  });
}

export function useSessions(token: string | undefined) {
  return useQuery({
    queryKey: qk.sessions(),
    queryFn: ({ signal }) => listSessions(token!, signal),
    enabled: !!token,
  });
}

export function useSession(
  token: string | undefined,
  sessionId: string | null,
) {
  return useQuery({
    queryKey: sessionId ? qk.session(sessionId) : ["session", "none"],
    queryFn: ({ signal }) => getSession(token!, sessionId!, signal),
    enabled: !!token && !!sessionId,
  });
}

export function useMessages(
  token: string | undefined,
  sessionId: string | null,
) {
  return useQuery({
    queryKey: sessionId ? qk.messages(sessionId) : ["messages", "none"],
    queryFn: async ({ signal }) => {
      const { messages } = await listMessages(
        token!,
        { sessionId: sessionId! },
        signal,
      );
      return messages;
    },
    enabled: !!token && !!sessionId,
    placeholderData: keepPreviousData,
  });
}

export function useCreateSession(token: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) =>
      createSession(token!, title ? { title } : {}),
    onSuccess: (session: Session) => {
      writeCurrentSessionId(session.id);
      qc.setQueryData(qk.session(session.id), { session, messages: [] });
      void qc.invalidateQueries({ queryKey: qk.sessions() });
    },
  });
}

// 在 chat-stream 完成后把最终 assistant message 合入 messages cache，按 id 去重。
export function useAppendMessages() {
  const qc = useQueryClient();
  return (sessionId: string, incoming: Message[]) => {
    qc.setQueryData<Message[]>(qk.messages(sessionId), (prev) => {
      const base = prev ?? [];
      const seen = new Set(base.map((m) => m.id));
      const next = [...base];
      for (const m of incoming) {
        if (!seen.has(m.id)) {
          next.push(m);
          seen.add(m.id);
        }
      }
      return next;
    });
  };
}
