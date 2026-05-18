import type { Product } from "@/lib/types";

/**
 * Canonical URL for a product across the entire storefront.
 *
 * Single source of truth used by:
 *   • `<ProductCard>` (homepage, related products, search, recommendations)
 *   • Menu / mega-nav surfaces that link straight to a specific SKU
 *   • Any future `router.push(productHref(product))` call site
 *
 * Resolution rule:
 *   1. If the product declares a bespoke `landingPath` (e.g. Sugarbear's
 *      `/sugarbear` premium landing page), return it verbatim. These
 *      pages are the canonical buying surface — the generic PDP must
 *      never be linked for them.
 *   2. Otherwise fall back to the generic `/products/[slug]` route.
 *
 * Keeping this logic in a one-line helper means new bespoke landings
 * are wired up by setting `landingPath` on the product alone — no
 * grep-and-replace through every Link in the codebase.
 */
export function productHref(
  product: Pick<Product, "slug" | "landingPath">
): string {
  return product.landingPath ?? `/products/${product.slug}`;
}
