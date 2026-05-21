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
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;

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
}
