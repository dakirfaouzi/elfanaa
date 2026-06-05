import {
  PersistenceError,
  type PrismaLike,
  type ProductSourceValue,
  type StorefrontCatalogProductRow,
} from "../contracts";

/** Status filter for {@link StorefrontCatalogProductRepository.listAll}. */
export type CatalogListStatus = "all" | "live" | "archived";

/**
 * StorefrontCatalogProductRepository — typed wrapper around
 * `prisma.storefrontCatalogProduct` (M12 / Step 2).
 *
 * # Reads
 *
 *   • `findBySlug`        — single row by `(storeId, slug)`. Used by PDP
 *                            and the catalog-loader hot path.
 *   • `findManyBySlugs`   — batched variant. Loader uses it to avoid
 *                            N+1 against the home / shop / collection
 *                            pages, which all dereference many slugs at
 *                            once. Order of inputs is NOT preserved —
 *                            callers re-index by slug.
 *   • `listLive`          — every `isLive=true` row for a store, sorted
 *                            by `updatedAt DESC`. Powers `/shop`.
 *
 * # Writes
 *
 *   • `upsert`            — write-or-update by `(storeId, slug)`. Called
 *                            by the Studio publish flow (Phase 2.3) and
 *                            by the curated-row seed (Phase 2.2).
 *   • `markUnlisted`      — flips `isLive` to false WITHOUT deleting the
 *                            row. Soft-disable so an unpublished AI
 *                            product can be revived later without
 *                            re-running the pipeline.
 *   • `archive`           — lifecycle ARCHIVE (Catalog PR B). Sets
 *                            `archivedAt=now()` AND `isLive=false`. Upserts
 *                            so a curated product with no prior row gets a
 *                            TOMBSTONE (empty commerce + marker) the loader
 *                            can use to hide the code snapshot.
 *   • `restore`           — lifecycle RESTORE. Clears `archivedAt` and flips
 *                            `isLive=true`. Commerce fields are untouched, so
 *                            a restored AI row returns with its real price and
 *                            a restored curated tombstone falls back to the
 *                            snapshot (empty overlay).
 *   • `listAll`           — every row for a store (live + archived), for the
 *                            admin catalog view. Optional status/source filter.
 *   • `countUsage`        — read-only count of `order_mirror_item` rows that
 *                            reference a product (by id and/or slug). Powers
 *                            the future delete safety-gate; never mutates.
 *
 * # What this repository deliberately does NOT do
 *
 *   • No JOIN with `studio_published_product`. Pairing is via the
 *     loose `publishedProductId` column; consumers that need both must
 *     fetch the published row separately. Keeps this query simple and
 *     cacheable.
 *   • No commerce VALIDATION (price > 0, currency length, etc). The
 *     persistence layer trusts its callers; validation lives in
 *     `@platform/builder-schema/catalog-metadata` and Studio's UI.
 *   • No hard deletes (still). ARCHIVE is the reversible kill-switch.
 *     Hard deletes would orphan order_mirror_item rows that already
 *     reference the catalog row by `productId = catalogRow.id`; the
 *     guarded delete path lands in a later PR.
 */
export class StorefrontCatalogProductRepository {
  private readonly prisma: PrismaLike;

  constructor(opts: { prisma: PrismaLike }) {
    this.prisma = opts.prisma;
  }

  /**
   * Look up a single catalog row by `(storeId, slug)`.
   *
   * Returns `null` when the slug is absent — callers MUST handle that
   * branch. The storefront falls back to its build-time snapshot in
   * that case (loader.ts).
   */
  async findBySlug(args: {
    storeId: string;
    slug: string;
  }): Promise<StorefrontCatalogProductRow | null> {
    try {
      return await this.prisma.storefrontCatalogProduct.findFirst({
        where: { storeId: args.storeId, slug: args.slug },
      });
    } catch (err) {
      throw wrapDbError(err, "catalog_find_by_slug");
    }
  }

  /**
   * Batch lookup — used by the loader to dereference many slugs at
   * once (the homepage's `bestSellerIds`, collection pages, upsell
   * resolution). Returns at most `slugs.length` rows; missing slugs
   * are silently absent.
   *
   * When `slugs` is empty we short-circuit to avoid sending an
   * `IN ()` clause that some Postgres versions reject.
   */
  async findManyBySlugs(args: {
    storeId: string;
    slugs: ReadonlyArray<string>;
  }): Promise<StorefrontCatalogProductRow[]> {
    if (args.slugs.length === 0) return [];
    try {
      return await this.prisma.storefrontCatalogProduct.findMany({
        where: {
          storeId: args.storeId,
          slug: { in: Array.from(args.slugs) },
        },
      });
    } catch (err) {
      throw wrapDbError(err, "catalog_find_many_by_slugs");
    }
  }

  /**
   * List every live catalog row for a store, ordered by `updatedAt DESC`.
   *
   * `take` defaults to 500 (clamped to 1000) — far above the
   * single-storefront scale we ship today, but bounded to keep a
   * runaway query from materialising a multi-MB result.
   *
   * The optional `source` filter lets the dashboard render
   * "AI-generated only" / "Curated only" counts without a second query.
   */
  async listLive(args: {
    storeId: string;
    take?: number;
    source?: ProductSourceValue;
  }): Promise<StorefrontCatalogProductRow[]> {
    const take = Math.min(args.take ?? 500, 1000);
    try {
      return await this.prisma.storefrontCatalogProduct.findMany({
        where: {
          storeId: args.storeId,
          isLive: true,
          ...(args.source ? { source: args.source } : {}),
        },
        orderBy: { updatedAt: "desc" },
        take,
      });
    } catch (err) {
      throw wrapDbError(err, "catalog_list_live");
    }
  }

  /**
   * Create-or-update by `(storeId, slug)`. The unique index makes this
   * race-safe: two concurrent operators publishing the same slug
   * resolve to a single row.
   *
   * # Why this is the only write path
   *
   * A separate `create` method would invite split-brain (operator A
   * creates, operator B updates a "new" row with a typo'd slug). The
   * single `upsert` method funnels every write through the same
   * uniqueness contract.
   *
   * # Sentinel: `undefined` vs `null`
   *
   * Fields passed as `undefined` are LEFT AS-IS on update (Prisma's
   * standard semantic). Fields passed as `null` are CLEARED. Callers
   * use this to surgically clear a field without rewriting the row.
   */
  async upsert(args: {
    storeId: string;
    slug: string;
    source: ProductSourceValue;
    priceMinor: number;
    priceCurrency: string;
    publishedProductId?: string | null;
    sku?: string | null;
    offerTiers?: unknown;
    collection?: string | null;
    productType?: string | null;
    target?: string | null;
    problems?: ReadonlyArray<string>;
    badges?: unknown;
    rating?: unknown;
    stockLeft?: number | null;
    recentBuyers?: number | null;
    upsellIds?: ReadonlyArray<string>;
    postPurchaseUpsellId?: string | null;
    landingPath?: string | null;
    heroImageUrl?: string | null;
    croContent?: unknown;
    isLive?: boolean;
  }): Promise<StorefrontCatalogProductRow> {
    const writable = {
      source: args.source,
      publishedProductId: args.publishedProductId,
      sku: args.sku,
      priceMinor: args.priceMinor,
      priceCurrency: args.priceCurrency,
      offerTiers: args.offerTiers,
      collection: args.collection,
      productType: args.productType,
      target: args.target,
      problems: args.problems ? Array.from(args.problems) : undefined,
      badges: args.badges,
      rating: args.rating,
      stockLeft: args.stockLeft,
      recentBuyers: args.recentBuyers,
      upsellIds: args.upsellIds ? Array.from(args.upsellIds) : undefined,
      postPurchaseUpsellId: args.postPurchaseUpsellId,
      landingPath: args.landingPath,
      heroImageUrl: args.heroImageUrl,
      croContent: args.croContent,
      isLive: args.isLive,
    };
    try {
      return await this.prisma.storefrontCatalogProduct.upsert({
        where: {
          storeId_slug: { storeId: args.storeId, slug: args.slug },
        },
        create: {
          storeId: args.storeId,
          slug: args.slug,
          source: writable.source,
          publishedProductId: writable.publishedProductId ?? null,
          sku: writable.sku ?? null,
          priceMinor: writable.priceMinor,
          priceCurrency: writable.priceCurrency,
          offerTiers: writable.offerTiers ?? null,
          collection: writable.collection ?? null,
          productType: writable.productType ?? null,
          target: writable.target ?? null,
          problems: writable.problems ?? [],
          badges: writable.badges ?? null,
          rating: writable.rating ?? null,
          stockLeft: writable.stockLeft ?? null,
          recentBuyers: writable.recentBuyers ?? null,
          upsellIds: writable.upsellIds ?? [],
          postPurchaseUpsellId: writable.postPurchaseUpsellId ?? null,
          landingPath: writable.landingPath ?? null,
          heroImageUrl: writable.heroImageUrl ?? null,
          croContent: writable.croContent ?? null,
          isLive: writable.isLive ?? true,
        },
        update: writable,
      });
    } catch (err) {
      throw wrapDbError(err, "catalog_upsert");
    }
  }

  /**
   * Soft-disable a catalog row. Flipping `isLive=false` hides the row
   * from `/shop`, `/collections/*`, and homepage best-sellers while
   * preserving every downstream FK (order_mirror_item.productId can
   * still resolve to a real row).
   *
   * Returns the updated row. Throws `PersistenceError{not_found}` if
   * no row exists for the slug.
   */
  async markUnlisted(args: {
    storeId: string;
    slug: string;
  }): Promise<StorefrontCatalogProductRow> {
    try {
      return await this.prisma.storefrontCatalogProduct.update({
        where: {
          storeId_slug: { storeId: args.storeId, slug: args.slug },
        },
        data: { isLive: false },
      });
    } catch (err) {
      throw wrapDbError(err, "catalog_mark_unlisted");
    }
  }

  /**
   * Lifecycle ARCHIVE (Catalog PR B).
   *
   * Marks a product archived: hidden from every storefront surface but fully
   * restorable, with all order FKs preserved. Implemented as an UPSERT so it
   * also works for a CURATED product that has no DB row yet — that case writes
   * a TOMBSTONE row (empty commerce + the archive marker) the hybrid loader
   * reads to skip the build-time snapshot.
   *
   * Always sets `isLive=false` alongside `archivedAt` so the FastAPI re-pricer
   * (`WHERE is_live = TRUE`) excludes archived products with no Python change.
   *
   * Commerce fields on an EXISTING row are left untouched (so a later restore
   * brings the AI product back with its real price). The tombstone CREATE path
   * uses `priceCurrency=""`, which the loader's merge treats as "absent" and
   * falls back to the snapshot — so a restored curated tombstone renders the
   * snapshot cleanly rather than a zero price.
   */
  async archive(args: {
    storeId: string;
    slug: string;
    reason?: string | null;
    actor?: string | null;
    /** Used ONLY when creating a tombstone (no prior row). Defaults to curated. */
    source?: ProductSourceValue;
  }): Promise<StorefrontCatalogProductRow> {
    const now = new Date();
    const marker = {
      isLive: false,
      archivedAt: now,
      archivedReason: args.reason ?? null,
      archivedBy: args.actor ?? null,
    };
    try {
      return await this.prisma.storefrontCatalogProduct.upsert({
        where: {
          storeId_slug: { storeId: args.storeId, slug: args.slug },
        },
        create: {
          storeId: args.storeId,
          slug: args.slug,
          source: args.source ?? "curated",
          priceMinor: 0,
          // Empty currency → loader merge treats price as "absent" and falls
          // back to the snapshot if this tombstone is ever restored.
          priceCurrency: "",
          ...marker,
        },
        update: marker,
      });
    } catch (err) {
      throw wrapDbError(err, "catalog_archive");
    }
  }

  /**
   * Lifecycle RESTORE — the inverse of {@link archive}.
   *
   * Clears the archive marker and flips `isLive=true`. Commerce fields are
   * untouched. Throws `PersistenceError{not_found}` if no row exists (you can
   * only restore something that was archived).
   */
  async restore(args: {
    storeId: string;
    slug: string;
  }): Promise<StorefrontCatalogProductRow> {
    try {
      return await this.prisma.storefrontCatalogProduct.update({
        where: {
          storeId_slug: { storeId: args.storeId, slug: args.slug },
        },
        data: {
          isLive: true,
          archivedAt: null,
          archivedReason: null,
          archivedBy: null,
        },
      });
    } catch (err) {
      throw wrapDbError(err, "catalog_restore");
    }
  }

  /**
   * List every row for a store — LIVE and ARCHIVED — for the admin catalog
   * view. Unlike {@link listLive} this does not filter on `isLive`.
   *
   * `status` narrows by lifecycle: `live` (archivedAt null), `archived`
   * (archivedAt set), or `all` (default). `source` narrows provenance.
   * `take` defaults to 500 (clamped to 1000).
   */
  async listAll(args: {
    storeId: string;
    take?: number;
    status?: CatalogListStatus;
    source?: ProductSourceValue;
  }): Promise<StorefrontCatalogProductRow[]> {
    const take = Math.min(args.take ?? 500, 1000);
    const status = args.status ?? "all";
    const where: Record<string, unknown> = { storeId: args.storeId };
    if (args.source) where.source = args.source;
    if (status === "archived") where.archivedAt = { not: null };
    else if (status === "live") where.archivedAt = null;
    try {
      return await this.prisma.storefrontCatalogProduct.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take,
      });
    } catch (err) {
      throw wrapDbError(err, "catalog_list_all");
    }
  }

  /**
   * Count `order_mirror_item` rows that reference a product, by its business
   * id(s) and/or slug. Read-only — powers the future delete safety-gate
   * ("can't hard-delete a product that has order history"). Returns
   * `{ orders: 0 }` when the order delegate isn't wired (e.g. unit mocks).
   */
  async countUsage(args: {
    ids?: ReadonlyArray<string>;
    slug?: string | null;
  }): Promise<{ orders: number }> {
    const delegate = this.prisma.orderMirrorItem;
    if (!delegate) return { orders: 0 };
    const or: Array<Record<string, unknown>> = [];
    for (const id of args.ids ?? []) if (id) or.push({ productId: id });
    if (args.slug) or.push({ productSlug: args.slug });
    if (or.length === 0) return { orders: 0 };
    try {
      const orders = await delegate.count({ where: { OR: or } });
      return { orders };
    } catch (err) {
      throw wrapDbError(err, "catalog_count_usage");
    }
  }
}

function wrapDbError(err: unknown, op: string): PersistenceError {
  if (err instanceof PersistenceError) return err;
  const e = err as { code?: string; message?: string };
  if (e?.code === "P2025") {
    return new PersistenceError({
      kind: "not_found",
      message: `${op}_not_found:${e.message ?? ""}`,
      cause: err,
    });
  }
  if (e?.code === "P2002") {
    return new PersistenceError({
      kind: "conflict",
      message: `${op}_conflict:${e.message ?? ""}`,
      cause: err,
    });
  }
  if (e?.code === "P2003") {
    // Foreign-key violation — most commonly an unknown store id.
    return new PersistenceError({
      kind: "invalid_input",
      message: `${op}_fk:${e.message ?? ""}`,
      cause: err,
    });
  }
  return new PersistenceError({
    kind: "unknown",
    message: `${op}_failed:${e?.message ?? "unknown"}`,
    cause: err,
  });
}
