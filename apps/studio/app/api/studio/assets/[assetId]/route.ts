import { NextResponse } from "next/server";
import { getStudioPersistence } from "@/lib/studio/persistence";
import { PersistenceError } from "@platform/persistence";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/studio/assets/[assetId]
 *
 * Removes an asset row + deletes the underlying R2 object.
 *
 * # Order of operations
 *
 *   1. Look up the row (404 when missing).
 *   2. Best-effort delete the R2 object (logged on failure; the row
 *      delete still proceeds — orphan blobs are reclaimed by R2's
 *      lifecycle policy).
 *   3. Delete the row.
 *   4. Append `asset.deleted` event for the audit log.
 *
 * The operator UI prompts before calling this endpoint.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await ctx.params;
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return NextResponse.json(
      {
        ok: false,
        code: "mode_unavailable",
        hint: "Set STUDIO_PERSISTENCE_MODE=dual to manage assets.",
      },
      { status: 503 },
    );
  }
  const row = await persistence.repositories.asset.findById(assetId);
  if (!row) {
    return NextResponse.json(
      { ok: false, code: "not_found", assetId },
      { status: 404 },
    );
  }

  try {
    await persistence.mediaStore.delete(row.r2Bucket, row.r2Key);
  } catch (err) {
    // Continue — the row is the source-of-truth for "exists".
    // eslint-disable-next-line no-console
    console.warn(
      `[asset_delete] r2_delete_failed key=${row.r2Key} error=${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  try {
    await persistence.repositories.asset.delete(assetId);
    await persistence.repositories.event.append({
      draftId: row.draftId,
      kind: "asset.deleted",
      actor: "studio_ui",
      payload: { assetId: row.id, key: row.r2Key },
    });
    return NextResponse.json({ ok: true, value: { assetId } });
  } catch (err) {
    if (err instanceof PersistenceError && err.kind === "not_found") {
      return NextResponse.json(
        { ok: false, code: "not_found", assetId },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        code: "internal",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
