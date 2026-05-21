import { idToNumericTail } from "./id-slug";

/**
 * SKU generator — mirrors `apps/fanaa/lib/sku.ts`.
 *
 * # Format
 *
 *   FN-<TOKEN>-<NNN>
 *
 *   • FN     → brand prefix
 *   • TOKEN  → 3–10 uppercase letters derived from the slug's first
 *              token, with curated overrides for known products to
 *              keep ops-friendly codes (`SUG` for `sugarbear-hair`).
 *   • NNN    → zero-padded numeric tail from the UP id.
 *
 * # Why re-implemented here
 *
 * The storefront's `apps/fanaa/lib/sku.ts` is a runtime module that
 * pulls in `@/lib/types` — importing it from a `@platform/*` package
 * would create a cycle (storefront → platform → storefront) and
 * violate the M7 isolation rule. We re-implement the algorithm
 * verbatim and pin parity via the `keeps_parity_with_apps_fanaa_sku`
 * test in this package.
 */

/**
 * Curated slug → SKU token overrides. Mirrors the same constant in
 * `apps/fanaa/lib/sku.ts`. KEEP IN SYNC.
 *
 * The agreement is: when a slug appears in this map, both this
 * publisher and the storefront produce the same token. New entries
 * added in the storefront sku.ts MUST be added here too; a CI
 * assertion will pin this in M10.
 */
const TOKEN_FROM_SLUG: Record<string, string> = {
  "glow-serum": "SERUM",
  "barrier-cream": "CREAM",
  "hair-mask": "HAIRMASK",
  "sugarbear-hair": "SUG",
};

const SLUG_TOKEN_FALLBACK_LEN = 10;

export function deriveSku(args: { id: string; slug: string }): string {
  const token = TOKEN_FROM_SLUG[args.slug] ?? slugToToken(args.slug);
  return `FN-${token}-${idToNumericTail(args.id)}`;
}

function slugToToken(slug: string): string {
  const cleaned = (slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .split("-")
    .filter(Boolean);

  if (cleaned.length === 0) return "ITEM";

  const head = cleaned[0];
  if (head.length >= 3) {
    return head.slice(0, SLUG_TOKEN_FALLBACK_LEN).toUpperCase();
  }
  return cleaned.join("").slice(0, SLUG_TOKEN_FALLBACK_LEN).toUpperCase();
}
