import { NextResponse } from "next/server";
import { loadConfiguredCrossSells } from "@/lib/catalog/loader";

export const runtime = "nodejs";
// Cross-sells depend on operator-edited `upsellIds`; never serve a stale cache.
export const dynamic = "force-dynamic";

/**
 * GET /api/catalog/cross-sells — resolve operator-configured cross-sells.
 *
 * # Why this route exists
 *
 * The cart drawer and thank-you cross-sell surfaces are client islands. Their
 * legacy resolver (`data/upsells.ts::resolveCartCrossSells`) is snapshot-only,
 * so operator-edited `upsellIds` pointing at AI-generated products (or entered
 * as slugs/paths) never resolved. This endpoint runs the SAME hybrid-catalog
 * resolution the server PDP uses, so `upsellIds` is the single source of truth
 * on every surface.
 *
 * # Query params
 *
 *   • `for`     — comma-separated ids/slugs of the products in the cart/order
 *                 (their `upsellIds` drive the suggestions). Required.
 *   • `exclude` — comma-separated ids/slugs to suppress (e.g. items already in
 *                 the cart). Optional. The `for` anchors are always excluded.
 *   • `max`     — cap the result count (1..12). Optional; defaults to 6.
 *
 * # Response
 *
 *   200 `{ products: Product[] }` — possibly empty when nothing is configured
 *   or resolvable. The client treats `[]` as "fall back to the legacy
 *   snapshot heuristic", so an empty result never breaks the surface.
 */
const MAX_REFS = 24;
const DEFAULT_MAX = 6;
const HARD_MAX = 12;

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
  const excludeIds = parseRefs(url.searchParams.get("exclude"));

  if (anchorRefs.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const maxParam = Number(url.searchParams.get("max"));
  const max =
    Number.isFinite(maxParam) && maxParam > 0
      ? Math.min(Math.floor(maxParam), HARD_MAX)
      : DEFAULT_MAX;

  try {
    const products = await loadConfiguredCrossSells(anchorRefs, {
      excludeIds,
      max,
    });
    return NextResponse.json({ products });
  } catch (err) {
    // Never break the storefront on a resolution error — the client falls back
    // to its snapshot heuristic when we return an empty set.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[api/catalog/cross-sells] resolve failed", err);
    }
    return NextResponse.json({ products: [] });
  }
}
