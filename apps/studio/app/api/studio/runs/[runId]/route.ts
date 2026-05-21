import { NextResponse } from "next/server";
import { readRun } from "@/lib/studio/run-loader";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio/runs/[runId]
 *
 * Returns one RunRecord. Maps loader results to HTTP codes:
 *   • ok          → 200 { run }
 *   • not_found   → 404
 *   • corrupted   → 422 with the validation reason
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;
  const result = await readRun(runId);

  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found", runId }, { status: 404 });
  }
  if (result.status === "corrupted") {
    return NextResponse.json(
      {
        error: "corrupted",
        runId,
        reason: result.reason,
        details: result.details,
      },
      { status: 422 },
    );
  }
  return NextResponse.json({ run: result.run });
}
