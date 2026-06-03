import { NextResponse } from "next/server";
import { loadPostPurchaseUpsell } from "@/lib/catalog/loader";

export const runtime = "nodejs";
// The offer depends on operator-edited `postPurchaseUpsellId`; never cache.
export const dynamic = "force-dynamic";

/**
 * GET /api/catalog/post-purchase-upsell — resolve the DEDICATED 99-SAR offer.
 *
 * # Why this route exists
 *
 * The post-purchase upsell screen is a client island that historically picked
 * its product synchronously from the build-time snapshot heuristic
 * (`strategy.ts::selectPostPurchaseUpsell`). Operators can now pin a specific
 * product via `CatalogMetadata.postPurchaseUpsellId`, which may point at an
 * AI-generated product (absent from the snapshot). This endpoint runs the same
 * hybrid-catalog resolution the server PDP uses so the configured pick — by
 * id, slug, or path — always resolves.
 *
 * # Query params
 *
 *   • `for` — comma-separated ids/slugs of the products in the order. Their
 *             `postPurchaseUpsellId` (first non-empty, in order) drives the
 *             offer. Required.
 *
 * # Response
 *
 *   200 `{ upsell: ResolvedPostPurchaseUpsell | null }` — `null` when nothing
 *   is configured/resolvable. The client treats `null` as "fall back to the
 *   legacy snapshot scoring heuristic", so behaviour never regresses.
 */
const MAX_REFS = 24;

function parseRefs(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_REFS);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const anchorRefs = parseRefs(url.searchParams.get("for"));

  if (anchorRefs.length === 0) {
    return NextResponse.json({ upsell: null });
  }

  try {
    const upsell = await loadPostPurchaseUpsell(anchorRefs);
    return NextResponse.json({ upsell });
  } catch (err) {
    // Never break the funnel on a resolution error — the client falls back to
    // its snapshot heuristic when we return null.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[api/catalog/post-purchase-upsell] resolve failed", err);
    }
    return NextResponse.json({ upsell: null });
  }
}
