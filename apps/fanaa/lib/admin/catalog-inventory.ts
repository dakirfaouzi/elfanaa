import "server-only";

import { products as snapshotProducts } from "@/data/products";
import { isAdminDbConfigured, prisma, adminDbConfigError } from "@/lib/admin/db";
import { getPrimaryImage, isPlaceholderImage } from "@/lib/product-image";
import { mergeCatalogProduct, synthesiseProductFromRow } from "@/lib/catalog/merge";
import { resolveUpsellRefs } from "@/lib/catalog/upsell-refs";
import { explain } from "@/lib/admin/safe";
import type { CatalogRow } from "@/lib/catalog/types";
import type { Product } from "@/lib/types";

/**
 * Read-only catalog inventory for the Admin "Catalog" area (PR A).
 *
 * This is the operator-facing *view* over the hybrid catalog — it unifies the
 * two product sources into one list so an operator can SEE everything and tell
 * AI products from legacy ones, with status and lightweight usage signals.
 *
 * It is deliberately READ-ONLY: no archive / restore / delete here. Those land
 * in later PRs (B/C/D) once the data model gains an explicit lifecycle.
 *
 * Sources unified:
 *   • Legacy / curated snapshot — `data/products.ts` (always present, code).
 *   • AI-generated + curated mirror rows — `storefront_catalog_product` (DB).
 *
 * Status semantics today (no archive column yet):
 *   • Legacy snapshot products are ALWAYS effectively live on the storefront
 *     (the merge re-applies the code snapshot regardless of any DB flag), so
 *     they report `live`.
 *   • DB-only (AI) rows report `live` when `isLive=true`, else `unlisted`.
 */

const STORE_ID = "fanaa";

export type CatalogInventoryItem = {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  /** Provenance — drives the AI vs Legacy badge. */
  source: "ai" | "legacy";
  /** Storefront visibility today (archive arrives later). */
  status: "live" | "unlisted";
  priceMinor: number;
  priceCurrency: string;
  collection: string | null;
  /** True when a DB row backs this product (commerce metadata overlay). */
  hasDbRow: boolean;
  /** Bespoke landing route (e.g. Sugarbear), when present. */
  landingPath: string | null;
  /** Primary image src (may be the inline placeholder data URL). */
  imageSrc: string;
  placeholderImage: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  /** All-time order line-items referencing this product; null when unknown. */
  orders: number | null;
  /** How many OTHER products list this one as an upsell / post-purchase pick. */
  inboundUpsellRefs: number;
};

export type CatalogInventory = {
  items: CatalogInventoryItem[];
  _errors?: Array<{ label: string; error: string }>;
};

export async function getCatalogInventory(): Promise<CatalogInventory> {
  const errors: Array<{ label: string; error: string }> = [];

  // 1. Pull every DB row (live AND unlisted) so operators see the full picture.
  let dbRows: CatalogRow[] = [];
  if (isAdminDbConfigured) {
    try {
      dbRows = (await prisma.storefrontCatalogProduct.findMany({
        where: { storeId: STORE_ID },
        orderBy: { updatedAt: "desc" },
      })) as unknown as CatalogRow[];
    } catch (err) {
      errors.push({ label: "catalog.rows", error: explain(err) });
    }
  } else {
    errors.push({
      label: "db.config",
      error:
        adminDbConfigError() ??
        "ADMIN_DATABASE_URL is not set — showing legacy snapshot products only.",
    });
  }

  const bySlug = new Map<string, CatalogRow>();
  for (const r of dbRows) bySlug.set(r.slug, r);
  const snapshotSlugs = new Set(snapshotProducts.map((p) => p.slug));

  const items: CatalogInventoryItem[] = [];
  const productList: Product[] = [];

  // 2. Legacy / curated snapshot products first (stable merchandising order).
  for (const p of snapshotProducts) {
    const row = bySlug.get(p.slug) ?? null;
    // Mirror the storefront: only a LIVE DB row overlays a curated product.
    const liveRow = row && row.isLive ? row : null;
    const merged = mergeCatalogProduct(p, liveRow);
    const img = getPrimaryImage(merged);
    productList.push(merged);
    items.push({
      id: merged.id,
      slug: merged.slug,
      titleEn: p.title.en || p.slug,
      titleAr: p.title.ar || p.slug,
      source: "legacy",
      status: "live",
      priceMinor: merged.price.amount,
      priceCurrency: merged.price.currency,
      collection: merged.collection ?? null,
      hasDbRow: Boolean(row),
      landingPath: merged.landingPath ?? null,
      imageSrc: img.src,
      placeholderImage: isPlaceholderImage(img.src),
      createdAt: row ? row.createdAt.toISOString() : null,
      updatedAt: row ? row.updatedAt.toISOString() : null,
      orders: null,
      inboundUpsellRefs: 0,
    });
  }

  // 3. DB-only (AI-generated) products appended.
  for (const row of dbRows) {
    if (snapshotSlugs.has(row.slug)) continue;
    const product = synthesiseProductFromRow(row);
    const img = getPrimaryImage(product);
    productList.push(product);
    items.push({
      id: product.id,
      slug: product.slug,
      titleEn: product.title.en || product.slug,
      titleAr: product.title.ar || product.slug,
      source: row.source === "ai_generated" ? "ai" : "legacy",
      status: row.isLive ? "live" : "unlisted",
      priceMinor: product.price.amount,
      priceCurrency: product.price.currency,
      collection: product.collection ?? null,
      hasDbRow: true,
      landingPath: product.landingPath ?? null,
      imageSrc: img.src,
      placeholderImage: isPlaceholderImage(img.src),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      orders: null,
      inboundUpsellRefs: 0,
    });
  }

  // 4. Inbound upsell references — pure, computed from the assembled list.
  const refCount = new Map<string, number>();
  for (const p of productList) {
    const refs = [
      ...(p.upsellIds ?? []),
      ...(p.postPurchaseUpsellId ? [p.postPurchaseUpsellId] : []),
    ];
    if (refs.length === 0) continue;
    const resolved = resolveUpsellRefs(refs, productList, { excludeIds: [p.id] });
    for (const t of resolved) refCount.set(t.id, (refCount.get(t.id) ?? 0) + 1);
  }
  for (const item of items) item.inboundUpsellRefs = refCount.get(item.id) ?? 0;

  // 5. Order references (all-time line items) — guarded so a missing table
  //    degrades to "unknown" (null) rather than failing the whole inventory.
  if (isAdminDbConfigured) {
    try {
      const orderRows = await prisma.orderMirrorItem.groupBy({
        by: ["productId", "productSlug"],
        _count: { _all: true },
      });
      const byId = new Map<string, number>();
      const bySlugCount = new Map<string, number>();
      for (const r of orderRows) {
        const c = r._count._all;
        if (r.productId) byId.set(r.productId, (byId.get(r.productId) ?? 0) + c);
        if (r.productSlug)
          bySlugCount.set(r.productSlug, (bySlugCount.get(r.productSlug) ?? 0) + c);
      }
      for (const item of items) {
        item.orders = byId.get(item.id) ?? bySlugCount.get(item.slug) ?? 0;
      }
    } catch (err) {
      errors.push({ label: "catalog.orders", error: explain(err) });
    }
  }

  return { items, ...(errors.length ? { _errors: errors } : {}) };
}
