export const qk = {
  visitor: () => ["visitor"] as const,
  sessions: () => ["sessions"] as const,
  session: (sessionId: string) => ["session", sessionId] as const,
  messages: (sessionId: string) => ["messages", sessionId] as const,
};
