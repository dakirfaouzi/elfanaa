import type { LocalizedString } from "@platform/catalog-schema";

/**
 * Deterministic slug derivation.
 *
 * # Why deterministic?
 *
 *   • M7 must support replay (same input → same artefact).
 *   • The slug is the storefront's URL — drift between two
 *     publishes of the same product would break inbound links.
 *   • The slug is also the file path under
 *     `.platform-data/products/<storeId>/`, so reproducible bytes
 *     hinge on it.
 *
 * # Strategy
 *
 *   1. Use `title.en` when available — Arabic-only titles would
 *      otherwise produce empty slugs in latin charsets.
 *   2. Strip diacritics, lowercase, ASCII-fold via NFKD, collapse
 *      every non-`[a-z0-9]` run into a single hyphen.
 *   3. Trim leading/trailing hyphens.
 *   4. Fallback to a stable hash of `title.ar` if `title.en` is empty.
 *
 * Slugs are NOT made globally unique here — uniqueness is the
 * storefront's concern (M9 wires a clash check). M7 produces the
 * canonical slug; the storefront / publisher rename it on collision.
 */
export function deriveSlug(title: LocalizedString): string {
  const en = (title.en ?? "").trim();
  if (en !== "") {
    const slug = latinSlugify(en);
    if (slug !== "") return slug;
  }
  const ar = (title.ar ?? "").trim();
  if (ar !== "") {
    return `product-${stableShortHash(ar)}`;
  }
  return "product";
}

function latinSlugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Tiny 6-char hex hash — stable, deterministic, non-cryptographic.
 * djb2-style; collision-tolerant since the storefront has the final
 * say on uniqueness.
 */
export function stableShortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6);
}

/**
 * Storefront-side numeric tail used by the SKU. Mirrors the algorithm
 * in `apps/fanaa/lib/sku.ts` so a UP id of `up_abc123_4` ends up as
 * `…-004` — the same way the existing storefront SKU derives its tail.
 *
 * NOTE: we MUST re-implement instead of import from `apps/fanaa/lib/`
 * — the publisher cannot depend on storefront runtime code
 * (PLATFORM.md M7 hard isolation rule).
 */
export function idToNumericTail(id: string): string {
  const m = id.match(/(\d+)\s*$/);
  if (!m) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return String(Math.abs(hash) % 1000).padStart(3, "0");
  }
  return m[1].padStart(3, "0");
}
