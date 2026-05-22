import { NextResponse } from "next/server";
import { dispatchIntake } from "@/lib/studio/dispatch-action";

export const dynamic = "force-dynamic";

/**
 * POST /api/studio/intake
 *
 * Intake endpoint — accepts a JSON body, validates as an IngestJob,
 * dispatches the pipeline asynchronously, and returns immediately
 * with the runId the client should poll/stream.
 *
 * # Status codes
 *
 *   • 202 Accepted   → dispatched; body { runId }
 *   • 422 Unprocess.  → validation failed; body { issues: [...] }
 *
 * JWT auth is enforced by the Studio root middleware before this
 * handler is reached.
 *
 * # Why 202 and not 201/200
 *
 * The pipeline runs in the background. 202 communicates "request
 * accepted, processing offline" per RFC 7231 §6.3.3 — semantically
 * correct and what reverse proxies + frontends expect from kick-off
 * endpoints.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json_body" },
      { status: 400 },
    );
  }

  const result = await dispatchIntake(body);
  if (result.status === "invalid") {
    return NextResponse.json(
      { error: "validation_failed", issues: result.issues },
      { status: 422 },
    );
  }

  return NextResponse.json(
    { runId: result.runId, draftId: result.draftId },
    { status: 202 },
  );
}
