import { env } from "~/env";

function extractMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "message" in body) {
    const m = body.message;
    if (typeof m === "string") return m;
  }
  return null;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type ApiFetchOpts = {
  token?: string | null;
  signal?: AbortSignal;
};

export async function apiFetch<T>(
  path: string,
  body: unknown,
  opts: ApiFetchOpts = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${env.NEXT_PUBLIC_AI_CS_API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
    signal: opts.signal,
  });

  if (!res.ok) {
    let parsed: unknown = undefined;
    let message = `HTTP ${res.status}`;
    try {
      parsed = await res.json();
      const fromBody = extractMessage(parsed);
      if (fromBody) message = fromBody;
    } catch {
      // 非 JSON 错误，保留原 message
    }
    throw new ApiError(res.status, message, parsed);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// SSE 端点用，只发请求不解析 body；body 由调用方读 ReadableStream。
export async function apiStreamFetch(
  path: string,
  body: unknown,
  opts: ApiFetchOpts = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${env.NEXT_PUBLIC_AI_CS_API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    let parsed: unknown = undefined;
    const message = `HTTP ${res.status}`;
    try {
      parsed = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message, parsed);
  }
  return res;
}
