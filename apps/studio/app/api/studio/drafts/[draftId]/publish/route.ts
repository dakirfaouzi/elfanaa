import { NextResponse } from "next/server";
import { publishDraft } from "@/lib/studio/drafts-service";
import { respond } from "@/lib/studio/api-response";

export const dynamic = "force-dynamic";

/**
 * POST /api/studio/drafts/[draftId]/publish
 *
 * Materialises an immutable `studio_published_product` snapshot
 * from the current draft payload. Subsequent publishes against the
 * same slug bump the version + flip the prior `isCurrent` to false.
 *
 * # Responses
 *
 *   200 → { ok: true, value: { record, warnings } }
 *   404 → draft not found
 *   422 → publish_blocked with `issues[]` (errors must be resolved
 *         before publish can proceed; warnings are non-blocking
 *         signal returned alongside `ok: true`).
 *   503 → mode_unavailable (file-only mode)
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await ctx.params;
  const result = await publishDraft({ draftId });
  return respond(result);
}
