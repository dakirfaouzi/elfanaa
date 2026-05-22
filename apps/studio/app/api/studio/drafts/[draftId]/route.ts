import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getDraft,
  renameDraft,
  updateDraftDocument,
} from "@/lib/studio/drafts-service";
import { respond } from "@/lib/studio/api-response";

export const dynamic = "force-dynamic";

/**
 * GET   /api/studio/drafts/[draftId]   — fetch a single draft (with payload).
 * PATCH /api/studio/drafts/[draftId]   — update the draft payload OR title.
 *
 * # PATCH body shapes
 *
 *   { document: DraftDocument, expectedPayloadVersion?: number, title?: string }
 *
 * or
 *
 *   { title: string }     — rename only.
 *
 * `expectedPayloadVersion` enables optimistic concurrency. The server
 * rejects the write with `409 conflict` when the persisted version is
 * ahead of what the client expected.
 */

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await ctx.params;
  const result = await getDraft(draftId);
  return respond(result);
}

const PatchBodySchema = z.union([
  z.object({
    document: z.unknown(),
    expectedPayloadVersion: z.number().int().nonnegative().optional(),
    title: z.string().max(200).optional(),
  }),
  z.object({
    title: z.string().min(1).max(200),
  }),
]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_input", issues: [{ message: "invalid_json_body" }] },
      { status: 400 },
    );
  }
  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_input",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }
  const data = parsed.data;
  if ("document" in data) {
    const result = await updateDraftDocument({
      draftId,
      document: data.document,
      expectedPayloadVersion: data.expectedPayloadVersion,
      title: data.title,
    });
    return respond(result);
  }
  if (typeof data.title !== "string" || data.title.trim().length === 0) {
    return NextResponse.json(
      { ok: false, code: "invalid_input", issues: [{ path: "title", message: "title_required" }] },
      { status: 422 },
    );
  }
  const result = await renameDraft({ draftId, title: data.title });
  return respond(result);
}
