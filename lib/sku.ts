import type { Product } from "@/lib/types";

/**
 * Global, deterministic SKU system for the ELFANAA storefront.
 *
 * Format
 * ─────────
 *   FN-<TOKEN>-<NNN>
 *
 *   • FN          → brand prefix (Fanaa)
 *   • TOKEN       → 3–10 uppercase letters derived from the product slug
 *   • NNN         → zero-padded numeric tail derived from the product `id`
 *                   (e.g. `p_004` → `004`)
 *
 * Examples
 * ─────────
 *   p_001  glow-serum        → FN-SERUM-001
 *   p_002  barrier-cream     → FN-CREAM-002
 *   p_003  hair-mask         → FN-HAIRMASK-003
 *   p_004  sugarbear-hair    → FN-SUG-004
 *
 * Persistence
 * ───────────
 * If a product carries an explicit `sku` field, it wins — the resolver is
 * fully deterministic so the same product always yields the same SKU across
 * deploys, processes, and backends (Next.js + FastAPI). When you add a new
 * product to `data/products.ts`, the auto-fallback gives you a workable SKU
 * for free. Pin it to the product record (`sku: "FN-…"`) the moment ops
 * needs to depend on it externally.
 *
 * Multi-product orders
 * ────────────────────
 * Ops sheets accept multiple SKUs separated by "/":
 *   `joinSkus(["FN-SUG-004", "FN-MASK-003"])` → `"FN-SUG-004/FN-MASK-003"`
 */

const TOKEN_FROM_SLUG: Record<string, string> = {
  "glow-serum": "SERUM",
  "barrier-cream": "CREAM",
  "hair-mask": "HAIRMASK",
  "sugarbear-hair": "SUG",
};

const SLUG_TOKEN_FALLBACK_LEN = 10;

export function getProductSku(product: Pick<Product, "id" | "slug" | "sku">): string {
  if (product.sku && product.sku.trim()) return product.sku.trim();
  return generateFallbackSku(product.id, product.slug);
}

export function generateFallbackSku(id: string, slug: string): string {
  const token = TOKEN_FROM_SLUG[slug] ?? slugToToken(slug);
  return `FN-${token}-${idToNumericTail(id)}`;
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

function idToNumericTail(id: string): string {
  const m = (id || "").match(/(\d+)\s*$/);
  if (!m) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return String(Math.abs(hash) % 1000).padStart(3, "0");
  }
  return m[1].padStart(3, "0");
}

export function joinSkus(skus: string[]): string {
  return skus.filter(Boolean).join("/");
}
