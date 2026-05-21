import { NextResponse } from "next/server";
import { readProduct } from "@/lib/studio/product-loader";
import { readRun } from "@/lib/studio/run-loader";
import { publishPreview } from "@/lib/studio/publish-preview";

export const dynamic = "force-dynamic";

/**
 * POST /api/studio/products/[storeId]/[productId]/publish-preview
 *
 * Dry-run publish — never writes to disk. Materialises the
 * FanaaProductExtension + BeautyWellnessExtension in memory and
 * returns the bundle the operator WOULD commit.
 *
 * # Source selection
 *
 * The handler prefers, in order:
 *   1. The already-published bundle on disk (`.platform-data/products/`).
 *      This is the canonical "what got published" view.
 *   2. The `finalProduct` on a completed RunRecord — used when the
 *      operator wants to preview a product that hasn't been published
 *      yet (the M7 worker CLI hasn't run for this run).
 *
 * Body (JSON, optional):
 *   { "runId": "run_xyz" }   ← if provided, source #2 is used
 *
 * # Returns
 *
 *   200 { result: PublishResult, bundle?: PublishedProductBundle, source: "stored" | "run" }
 *   404 { error: "not_found" }                                    ← neither source resolved
 *   422 { error: "validation_failed", issues: [...] }             ← from FanaaPublisher
 *
 * The body is parsed defensively — clients may POST an empty body
 * (most common path: "show me the dry-run for this stored product").
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ storeId: string; productId: string }> },
) {
  const { storeId, productId } = await ctx.params;

  // Defensive body parse — empty body is the common path.
  let body: { runId?: string } = {};
  try {
    const text = await req.text();
    if (text.trim() !== "") body = JSON.parse(text) as { runId?: string };
  } catch {
    // Ignore malformed body; treat as empty.
  }

  // Source #2 — load from RunRecord.
  if (body.runId) {
    const runResult = await readRun(body.runId);
    if (runResult.status === "ok" && runResult.run.finalProduct) {
      const preview = await publishPreview({
        universalProduct: runResult.run.finalProduct,
        runId: runResult.run.runId,
      });
      return shape(preview, "run", storeId, productId);
    }
    if (runResult.status === "not_found") {
      return NextResponse.json(
        { error: "not_found", runId: body.runId },
        { status: 404 },
      );
    }
  }

  // Source #1 — load already-published bundle, re-materialise its UP.
  const stored = await readProduct(storeId, productId);
  if (stored.status === "ok") {
    const preview = await publishPreview({
      universalProduct: stored.bundle.universalProduct,
      runId: stored.bundle.runId,
      actor: stored.bundle.actor,
    });
    return shape(preview, "stored", storeId, productId);
  }
  if (stored.status === "corrupted") {
    return NextResponse.json(
      {
        error: "corrupted",
        storeId,
        productId,
        reason: stored.reason,
        details: stored.details,
      },
      { status: 422 },
    );
  }
  return NextResponse.json(
    { error: "not_found", storeId, productId },
    { status: 404 },
  );
}

function shape(
  preview: Awaited<ReturnType<typeof publishPreview>>,
  source: "stored" | "run",
  storeId: string,
  productId: string,
) {
  if (preview.result.status === "validation_failed") {
    return NextResponse.json(
      {
        error: "validation_failed",
        storeId,
        productId,
        source,
        issues: preview.result.issues,
      },
      { status: 422 },
    );
  }
  return NextResponse.json({
    result: preview.result,
    bundle: preview.bundle,
    source,
  });
}
