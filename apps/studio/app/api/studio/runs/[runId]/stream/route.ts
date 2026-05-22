import {
  SSE_RESPONSE_HEADERS,
  encodeSseEvent,
  encodeSseKeepalive,
} from "@/lib/studio/sse-encoder";
import { watchRun } from "@/lib/studio/run-watcher";

export const dynamic = "force-dynamic";
// Edge runtime can't easily call `fs.promises.readFile` for our
// `.platform-data/` polling — pin Node so the run-watcher works.
export const runtime = "nodejs";

/**
 * GET /api/studio/runs/[runId]/stream
 *
 * Server-Sent Events stream of RunWatcherEvents for a single runId.
 *
 * # Event schedule
 *
 *   • Immediate `snapshot` event on first successful read.
 *   • One `step` event for every new StepRecord appended.
 *   • One `status` event when the run flips status without a new step.
 *   • Final `terminal` event when status reaches completed/failed/
 *     cancelled, then the stream closes.
 *   • A `: ping` keepalive every 15s so reverse proxies and idle
 *     CDN frames don't time the connection out.
 *
 * # Client cancellation
 *
 * The watcher honours `request.signal` so closing the EventSource on
 * the browser side terminates the polling loop and stops the
 * ReadableStream within one poll cycle.
 *
 * # Auth
 *
 * JWT-gated by the Studio middleware. Unauthenticated callers receive
 * a 401 JSON response before this handler ever runs.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Immediate event so the client knows the connection is open
      // even before the watcher's first successful poll.
      controller.enqueue(
        encodeSseEvent({
          event: "open",
          data: { runId, openedAt: new Date().toISOString() },
        }),
      );

      const keepaliveTimer = setInterval(() => {
        try {
          controller.enqueue(encodeSseKeepalive());
        } catch {
          // Stream already closed.
          clearInterval(keepaliveTimer);
        }
      }, 15_000);

      try {
        for await (const event of watchRun({ runId, signal: req.signal })) {
          controller.enqueue(
            encodeSseEvent({
              event: event.type,
              id: event.seq,
              data: event,
            }),
          );
          if (event.type === "terminal" || event.type === "not_found" || event.type === "corrupted") {
            break;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "watch_error";
        controller.enqueue(
          encodeSseEvent({
            event: "error",
            data: { runId, message },
          }),
        );
      } finally {
        clearInterval(keepaliveTimer);
        controller.close();
      }
    },
    cancel() {
      // Browser closed the EventSource. The watcher already
      // observes `req.signal`; nothing else to do here.
    },
  });

  return new Response(stream, { headers: SSE_RESPONSE_HEADERS });
}
