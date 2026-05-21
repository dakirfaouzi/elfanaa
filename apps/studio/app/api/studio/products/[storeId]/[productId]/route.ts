import { NextResponse } from "next/server";
import { readProduct } from "@/lib/studio/product-loader";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio/products/[storeId]/[productId]
 *
 * Returns one PublishedProductBundle. Differentiates clearly between
 * the three failure modes the product loader can produce so the UI
 * picks the right behaviour:
 *
 *   • not_found     → 404
 *   • corrupted     → 422 with the validation reason
 *   • ok            → 200 { bundle }
 *
 * The middleware enforces JWT auth.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ storeId: string; productId: string }> },
) {
  const { storeId, productId } = await ctx.params;
  const result = await readProduct(storeId, productId);

  if (result.status === "not_found") {
    return NextResponse.json(
      { error: "not_found", storeId, productId },
      { status: 404 },
    );
  }
  if (result.status === "corrupted") {
    return NextResponse.json(
      {
        error: "corrupted",
        storeId,
        productId,
        reason: result.reason,
        details: result.details,
      },
      { status: 422 },
    );
  }
  return NextResponse.json({ bundle: result.bundle });
}
