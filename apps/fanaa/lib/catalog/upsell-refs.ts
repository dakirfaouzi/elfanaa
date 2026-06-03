/**
 * Upsell-ref normalization + resolution — the single place that turns the
 * operator-entered "Upsell Product IDs" values into real catalog products.
 *
 * # Why this exists
 *
 * The Studio "Upsell Product IDs" field (`CatalogMetadata.upsellIds`) is meant
 * to be the single source of truth for PDP recommendations, cart-drawer
 * cross-sells, and thank-you cross-sells. Before this module, those surfaces
 * either ignored the field entirely (PDP `loadRelatedCatalogProducts` returned
 * a catalog-order slice) or resolved it against the SNAPSHOT only
 * (`resolveCartCrossSells` → `getProductById`), so AI-generated targets and any
 * slug/path value never resolved.
 *
 * # What an operator may type
 *
 * The UI hint says "ids / slugs" but operators paste whatever they have:
 *   • a bare id/slug      — `barrier-cream`, `run_mpxd8ywc_a77to0pq`
 *   • a storefront path   — `/products/run_mpxd8ywc_a77to0pq`, `/sugarbear`
 *   • a Studio path       — `/p/<slug>`
 *   • a full URL          — `https://elfanaa.com/products/<slug>`
 *
 * `normalizeUpsellRef` reduces all of these to a bare `id-or-slug` token, and
 * `resolveUpsellRefs` matches that token against a catalog by **id OR slug**.
 * Unresolvable / self references are silently skipped (operator intent: the
 * field lists what *should* appear; junk simply doesn't).
 */

/**
 * Reduce an operator-entered upsell reference to a bare `id-or-slug` token.
 *
 * Returns `""` for empty / unusable input (the caller skips empties).
 */
export function normalizeUpsellRef(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";

  // Absolute URL → keep only the path so `https://host/products/x` → `/products/x`.
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).pathname;
    } catch {
      // Malformed URL — fall through and treat the raw string as a path.
    }
  }

  // Drop any query string / hash fragment.
  s = s.replace(/[?#].*$/, "");
  // Strip leading + trailing slashes.
  s = s.replace(/^\/+/, "").replace(/\/+$/, "");
  // Strip a known storefront/studio path prefix (`products/…`, `p/…`).
  s = s.replace(/^(?:products|p)\//i, "");
  // Whatever remains may still be nested (`products/x` already handled, but a
  // future `collections/x/y` would leave `x/y`); the product token is the last
  // non-empty segment.
  const segments = s.split("/").filter(Boolean);
  const token = segments.length > 0 ? segments[segments.length - 1] : "";
  return token.trim();
}

/**
 * Resolve a list of upsell refs to catalog entries, matching by id OR slug.
 *
 * Generic over `{ id, slug }` so it works for full `Product`s (server loaders,
 * API route) and stays unit-testable without constructing a whole Product.
 *
 *   • Order follows `refs` (operator merchandising intent is preserved).
 *   • Deduped by `id`.
 *   • Refs in `opts.excludeIds`, and self-references, are skipped.
 *   • Unresolvable refs are silently dropped.
 */
export function resolveUpsellRefs<T extends { id: string; slug: string }>(
  refs: ReadonlyArray<string>,
  catalog: ReadonlyArray<T>,
  opts?: { excludeIds?: ReadonlyArray<string> },
): T[] {
  if (refs.length === 0) return [];

  const byId = new Map<string, T>();
  const bySlug = new Map<string, T>();
  for (const p of catalog) {
    byId.set(p.id, p);
    bySlug.set(p.slug, p);
  }

  const excluded = new Set(opts?.excludeIds ?? []);
  const seen = new Set<string>();
  const out: T[] = [];

  for (const ref of refs) {
    const token = normalizeUpsellRef(ref);
    if (!token) continue;
    const match = byId.get(token) ?? bySlug.get(token);
    if (!match) continue;
    if (excluded.has(match.id) || seen.has(match.id)) continue;
    seen.add(match.id);
    out.push(match);
  }

  return out;
}
