import { NextResponse } from "next/server";
import { runReplayAction } from "@/lib/studio/replay-action";

export const dynamic = "force-dynamic";

/**
 * POST /api/studio/runs/[runId]/replay
 *
 * Triggers a deterministic pipeline replay against the persisted
 * RunRecord. Runs synchronously inside the request — M8 has no
 * background daemon (PLATFORM.md M8 row mentions Inngest, but the
 * user-specified M8 scope explicitly defers daemon work).
 *
 * Body (JSON, optional):
 *   { "fromStage": "copy" }   ← optional explicit resume point
 *
 * Maps ReplayActionResult → HTTP:
 *   • ok                    → 200 { ... }
 *   • not_found             → 404
 *   • providers_unavailable → 503 { reason }   ← env var missing
 *   • replay_failed         → 500 { reason }   ← runtime error
 *
 * Headers are JWT-gated by the existing Studio middleware; only
 * authenticated operators can replay.
 *
 * # Why the outer try/catch
 *
 * `runReplayAction` is contractually obligated to never throw — every
 * failure maps to a typed `ReplayActionResult`. But cosmic-ray bugs
 * (an unexpected throw from a transitively-imported module on first
 * call, a Next.js internals quirk under load, etc.) would otherwise
 * cause Next.js to render its default HTML 500 page. The client's
 * `res.json()` parse then fails and the UI shows a useless "non-JSON
 * response" message instead of the actual cause.
 *
 * The outer catch normalises every escape into a JSON 500 carrying
 * the raw error message + stack, and logs to stderr (visible in the
 * Studio container logs). Defense in depth — the inner action
 * should always be the path that fires.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  let runId = "<unknown>";
  try {
    const params = await ctx.params;
    runId = params.runId;

    let body: { fromStage?: string } = {};
    try {
      const text = await req.text();
      if (text.trim() !== "") body = JSON.parse(text) as { fromStage?: string };
    } catch {
      // Ignore — empty body means "resume from first non-success".
    }

    const result = await runReplayAction({ runId, fromStage: body.fromStage });

    switch (result.status) {
      case "ok":
        return NextResponse.json(result);
      case "not_found":
        return NextResponse.json(result, { status: 404 });
      case "providers_unavailable":
        return NextResponse.json(result, { status: 503 });
      case "replay_failed":
        return NextResponse.json(result, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    // eslint-disable-next-line no-console
    console.error(
      `[replay-route] uncaught throw for run ${runId}: ${message}\n${stack ?? ""}`,
    );
    return NextResponse.json(
      {
        status: "replay_failed",
        runId,
        reason: `route_handler_throw: ${message}`,
      },
      { status: 500 },
    );
  }
}
