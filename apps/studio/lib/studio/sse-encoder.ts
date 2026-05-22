/**
 * Server-Sent Events encoder.
 *
 * # Wire format (per spec §9.2 of HTML Living Standard)
 *
 *   • Each event is a sequence of `field: value` lines terminated by
 *     `\n\n` (two newlines).
 *   • Multi-line `data:` is split on `\n` and emitted as one `data:`
 *     line each — the spec re-joins them on the client.
 *   • `event:` is optional; when absent, browsers emit `"message"`.
 *   • `id:` is optional; we set it to the step index so a reconnecting
 *     client can resume past the last seen step via `Last-Event-ID`.
 *   • Comments (`: …`) are used for keepalive pings.
 *
 * Why a hand-rolled encoder?
 *
 * The SSE protocol is tiny (a few lines) and the alternatives drag in
 * heavy event-source libraries that double-encode JSON. Keeping it in
 * a single ~30-line module makes the wire format auditable and lets us
 * unit-test the encoded bytes exactly.
 */
export interface SseEvent<T = unknown> {
  /** Event name (becomes `EventSource.addEventListener(name, …)`). */
  event?: string;
  /** Optional stable id; reconnecting clients send it as `Last-Event-ID`. */
  id?: string | number;
  /** Payload. Strings are emitted as-is; objects are JSON.stringified. */
  data: T;
  /** Browser reconnection backoff (ms). Default ~3000 if omitted. */
  retry?: number;
}

const ENCODER = new TextEncoder();

/** Encode one SseEvent into a Uint8Array ready to enqueue into a stream. */
export function encodeSseEvent<T>(ev: SseEvent<T>): Uint8Array {
  return ENCODER.encode(formatSseEvent(ev));
}

/** Encode one SseEvent into a UTF-8 string. Useful for tests. */
export function formatSseEvent<T>(ev: SseEvent<T>): string {
  const lines: string[] = [];
  if (ev.event !== undefined) lines.push(`event: ${ev.event}`);
  if (ev.id !== undefined) lines.push(`id: ${ev.id}`);
  if (ev.retry !== undefined) lines.push(`retry: ${Math.floor(ev.retry)}`);

  const dataPayload =
    typeof ev.data === "string" ? ev.data : JSON.stringify(ev.data);
  // Split multi-line payloads so each line becomes a `data:` field
  // (per spec). Lone "\n\n" inside payload becomes "data:\ndata:" —
  // EventSource on the client re-joins them with newlines.
  for (const line of dataPayload.split("\n")) {
    lines.push(`data: ${line}`);
  }
  return `${lines.join("\n")}\n\n`;
}

/** Encode a comment-line keepalive ping. Clients silently ignore it
 *  but the server gets a write-failure if the connection is dead. */
export function encodeSseKeepalive(): Uint8Array {
  return ENCODER.encode(`: ping ${new Date().toISOString()}\n\n`);
}

/** SSE response headers — set on the Response when constructing the
 *  stream. `text/event-stream` is the discriminator browsers use to
 *  switch into `EventSource` parsing mode. */
export const SSE_RESPONSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disable proxy buffering (nginx, Cloudflare Workers in some modes)
  // so events flush to the client immediately.
  "X-Accel-Buffering": "no",
};
