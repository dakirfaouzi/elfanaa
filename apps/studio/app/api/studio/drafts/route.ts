import { NextResponse } from "next/server";
import { z } from "zod";
import { createDraft, listDrafts } from "@/lib/studio/drafts-service";
import { respond } from "@/lib/studio/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio/drafts
 *
 * Lists every Studio draft (optionally filtered by `storeId`).
 *
 * # Response (200)
 *
 *   { ok: true, value: [DraftListItem, ...] }
 *
 * # Response (503)
 *
 *   { ok: false, code: "mode_unavailable", hint: "..." }
 *
 * # POST /api/studio/drafts
 *
 * Creates a new draft + seeds the blank DraftDocument payload.
 *
 *   Body: { slug: string, title: string, storeId?: string, template?: string }
 *
 *   201 → { ok: true, value: DraftDetail }
 *   409 → { ok: false, code: "conflict", message } when (storeId, slug) collides
 *   422 → { ok: false, code: "invalid_input", issues }
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId") ?? undefined;
  const result = await listDrafts({ storeId });
  return respond(result);
}

const CreateDraftBodySchema = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  storeId: z.string().min(1).max(64).optional(),
  template: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_input", issues: [{ message: "invalid_json_body" }] },
      { status: 400 },
    );
  }
  const parsed = CreateDraftBodySchema.safeParse(body);
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
  const result = await createDraft(parsed.data);
  return respond(result, 201);
}
