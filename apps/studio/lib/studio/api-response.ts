import { NextResponse } from "next/server";
import type { DraftServiceResult } from "./drafts-service";

/**
 * Map a typed `DraftServiceResult` to a NextResponse with a stable
 * status code.
 *
 * Centralising the mapping ensures every route surfaces the same
 * status code for the same failure mode (e.g. `mode_unavailable` →
 * 503 with hint), and frees route handlers from rebuilding the
 * payload shape per route.
 */
export function respond<T>(
  result: DraftServiceResult<T>,
  okStatus = 200,
): NextResponse {
  if (result.ok) {
    return NextResponse.json({ ok: true, value: result.value }, { status: okStatus });
  }
  switch (result.code) {
    case "mode_unavailable":
      return NextResponse.json(
        {
          ok: false,
          code: "mode_unavailable",
          hint:
            "Set STUDIO_PERSISTENCE_MODE=dual + ADMIN_DATABASE_URL to enable the builder.",
        },
        { status: 503 },
      );
    case "not_found":
      return NextResponse.json(
        { ok: false, code: "not_found", draftId: result.draftId },
        { status: 404 },
      );
    case "conflict":
      return NextResponse.json(
        { ok: false, code: "conflict", message: result.message },
        { status: 409 },
      );
    case "invalid_input":
      return NextResponse.json(
        { ok: false, code: "invalid_input", issues: result.issues },
        { status: 422 },
      );
    case "publish_blocked":
      return NextResponse.json(
        { ok: false, code: "publish_blocked", issues: result.issues },
        { status: 422 },
      );
    case "internal":
      return NextResponse.json(
        { ok: false, code: "internal", message: result.message },
        { status: 500 },
      );
  }
}
