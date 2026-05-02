import type { RawSseFrame } from "~/lib/types/api";

// 极简 SSE 帧解析。规范：https://html.spec.whatwg.org/multipage/server-sent-events.html
// 帧之间用空行分隔；行可以是 "field: value"（field=event/data/id/retry，其它忽略），
// 或以 ":" 开头的注释行。同一帧内多 data 行用 "\n" 拼接。
//
// 调用方式：把不断累积的字符串 buffer 传进来，返回已完整的 frames + 剩余未完成的 rest。
export function parseSseChunk(buffer: string): {
  events: RawSseFrame[];
  rest: string;
} {
  const events: RawSseFrame[] = [];
  // 兼容 \r\n / \n
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  // 最后一段可能是不完整帧，留给下次
  const rest = parts.pop() ?? "";

  for (const raw of parts) {
    if (raw.length === 0) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.length === 0 || line.startsWith(":")) continue;
      const colonIdx = line.indexOf(":");
      const field = colonIdx === -1 ? line : line.slice(0, colonIdx);
      let value = colonIdx === -1 ? "" : line.slice(colonIdx + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") dataLines.push(value);
    }
    if (dataLines.length === 0) continue;
    events.push({ event, data: dataLines.join("\n") });
  }

  return { events, rest };
}
