import { describe, expect, it } from "vitest";
import {
  encodeSseEvent,
  encodeSseKeepalive,
  formatSseEvent,
  SSE_RESPONSE_HEADERS,
} from "../lib/studio/sse-encoder";

/**
 * Tests for the SSE encoder.
 *
 * The encoder is the trust boundary between our event types and the
 * SSE wire format. Wrong framing → silent EventSource disconnect, so
 * we pin the exact bytes.
 *
 * Coverage:
 *   1. Single-line data + JSON payload formatting.
 *   2. Event name + id + retry fields are serialised correctly.
 *   3. Multi-line payloads split into multiple `data:` lines.
 *   4. String payloads pass through unchanged (not JSON-stringified).
 *   5. Keepalive ping is a valid SSE comment.
 *   6. Response headers include text/event-stream + no-cache.
 */
describe("formatSseEvent", () => {
  it("formats a minimal event with no event/id/retry", () => {
    const out = formatSseEvent({ data: { hello: 1 } });
    expect(out).toBe("data: {\"hello\":1}\n\n");
  });

  it("includes event, id, and retry fields when present", () => {
    const out = formatSseEvent({
      event: "snapshot",
      id: 7,
      retry: 4000,
      data: { ok: true },
    });
    expect(out).toBe(
      "event: snapshot\nid: 7\nretry: 4000\ndata: {\"ok\":true}\n\n",
    );
  });

  it("emits one `data:` line per newline in a multi-line string payload", () => {
    const out = formatSseEvent({ data: "alpha\nbeta\ngamma" });
    expect(out).toBe("data: alpha\ndata: beta\ndata: gamma\n\n");
  });

  it("passes through string payloads without JSON.stringify", () => {
    const out = formatSseEvent({ data: "raw" });
    expect(out).toBe("data: raw\n\n");
  });

  it("retry is floored to an integer", () => {
    const out = formatSseEvent({ retry: 3333.7, data: "x" });
    expect(out).toBe("retry: 3333\ndata: x\n\n");
  });

  it("terminates EVERY event with an empty line (\\n\\n)", () => {
    const out = formatSseEvent({ data: { a: 1 } });
    expect(out.endsWith("\n\n")).toBe(true);
    expect(out.split("\n\n")).toHaveLength(2); // one event + empty terminator
  });
});

describe("encodeSseEvent", () => {
  it("encodes to UTF-8 bytes equivalent to formatSseEvent", () => {
    const ev = { event: "step", id: 1, data: { stage: "research" } };
    const bytes = encodeSseEvent(ev);
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toBe(formatSseEvent(ev));
  });
});

describe("encodeSseKeepalive", () => {
  it("emits a comment line that browsers silently ignore", () => {
    const bytes = encodeSseKeepalive();
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded.startsWith(": ping ")).toBe(true);
    expect(decoded.endsWith("\n\n")).toBe(true);
  });
});

describe("SSE_RESPONSE_HEADERS", () => {
  it("declares the content-type as text/event-stream", () => {
    const headers = SSE_RESPONSE_HEADERS as Record<string, string>;
    expect(headers["Content-Type"]).toMatch(/^text\/event-stream/);
    expect(headers["Cache-Control"]).toContain("no-cache");
    expect(headers["X-Accel-Buffering"]).toBe("no");
  });
});
