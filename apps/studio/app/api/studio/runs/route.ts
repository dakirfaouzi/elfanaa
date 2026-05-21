import { NextResponse } from "next/server";
import { listRuns } from "@/lib/studio/run-loader";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio/runs
 *
 * Returns every RunRecord under `.platform-data/runs/`, newest first.
 * Corrupted records surface with `corrupted: { reason }` so the
 * operator can spot drift without the listing crashing.
 *
 * The middleware enforces JWT auth.
 */
export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({ runs });
}
