import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  UniversalProductSchema,
  FanaaProductExtensionSchema,
  BeautyWellnessExtensionSchema,
} from "@platform/catalog-schema/schemas";
import type { ProductImage } from "@platform/catalog-schema";
import type { PublishedProductBundle } from "@platform/publishers";
import type { DraftDocument } from "@platform/builder-schema";
import { listStores, getStore } from "@platform/stores";
import { productsRoot } from "./paths";
import { resolveImageUrl } from "./preview-props";
import { listPublishedProducts, type PublishedListItem } from "./drafts-service";

/**
 * Read M7 publisher artefacts from `.platform-data/products/<storeId>/<id>.json`.
 *
 * # Contract
 *
 *   • Loaders are READ-ONLY. They never mutate the on-disk files.
 *   • Every read is validated through the M3/M7 Zod schemas. If a
 *     bundle fails validation (drift between the publisher and the
 *     Studio's schema version, or hand-edited JSON), the loader
 *     returns a `corrupted` result with a typed reason rather than
 *     throwing — the UI shows a "this file is corrupted, see error"
 *     state instead of 500-ing the route.
 *   • Missing files return `not_found` rather than throwing, so
 *     route handlers can map straight to 404.
 *
 * # Why a typed result instead of throwing
 *
 * Next.js server components surface thrown errors as opaque 500s.
 * Differentiating "not found" from "corrupted" from "ok" in-band
 * lets the UI render a friendly status panel and lets API routes
 * return the right HTTP code.
 */

/* ─── Bundle schema ─────────────────────────────────────────────────── */

/**
 * Zod validator for the bundle the M7 FanaaPublisher writes.
 *
 * Mirrors `PublishedProductBundle` in @platform/publishers/contracts.
 * Schema is defined LOCALLY in the Studio so a future change in the
 * publisher's on-disk format is detected here (drift canary) rather
 * than silently consumed.
 */
const PublishedBundleSchema: z.ZodType<PublishedProductBundle> = z.object({
  bundleVersion: z.literal(1),
  publisher: z.string().min(1),
  storeId: z.string().min(1),
  runId: z.string(),
  actor: z.string(),
  publishedAt: z.string().min(1),
  universalProduct: UniversalProductSchema,
  fanaaExtension: FanaaProductExtensionSchema.optional(),
  beautyWellnessExtension: BeautyWellnessExtensionSchema.optional(),
});

/* ─── Result types ──────────────────────────────────────────────────── */

export type ProductLoadResult =
  | { status: "ok"; bundle: PublishedProductBundle; filePath: string }
  | { status: "not_found"; storeId: string; productId: string }
  | {
      status: "corrupted";
      storeId: string;
      productId: string;
      filePath: string;
      reason: "invalid_json" | "schema_mismatch" | "read_error";
      details?: string;
    };

/** Compact hero-image snapshot surfaced on the products LIST so each
 *  card can render a thumbnail without re-reading the full bundle. */
export interface ProductSummaryHero {
  /** Original `images[0].src` — the on-disk key. Surfaced so the UI
   *  can show it as a forensic label when the asset host is offline. */
  src: string;
  /** `resolveImageUrl(src)` — already CDN-prefixed when one is set,
   *  or a `placeholder://...` token otherwise. Pass straight to the
   *  existing `<PreviewImage>` component. */
  resolvedSrc: string;
  /** Original bilingual alt text from the bundle. */
  alt: { ar: string; en: string };
  /** True when `resolvedSrc` is a `placeholder://` token — the UI
   *  uses this to switch to the styled "asset pending" fallback. */
  placeholder: boolean;
}

export interface ProductSummary {
  storeId: string;
  productId: string;
  slug: string;
  title: { ar: string; en: string };
  niche: string;
  runId: string;
  publishedAt: string;
  hasFanaaExtension: boolean;
  /**
   * First image from the bundle, ready to drop into the products-
   * list thumbnail. `null` when:
   *   • the bundle has no images at all (defensive — schema allows it),
   *   • the bundle is corrupted (no `images[0]` to read).
   *
   * Additive — introduced in C3 for the products-list card overhaul.
   * Older callers ignore it without recompilation.
   */
  heroImage?: ProductSummaryHero | null;
  /**
   * Where this row was loaded from.
   *
   *   • `"fs"` — legacy `.platform-data/products/<storeId>/<id>.json`
   *     written by the M7 `FanaaPublisher` CLI. The UI links to the
   *     detail page (`/products/<storeId>/<productId>`) which knows
   *     how to read those bundles.
   *
   *   • `"db"` — current `studio_published_product` row written by
   *     the M11 publish-from-builder flow. The detail page does not
   *     know how to read DB rows, so the UI links to the storefront
   *     route (`/p/<slug>`) instead — the canonical post-publish
   *     surface.
   *
   * Optional + back-compat: tests written before C3.1 omit it; we
   * treat `undefined` as the legacy `"fs"` source for safety.
   */
  source?: "db" | "fs";
  /** Set when the bundle file exists but failed validation. */
  corrupted?: { reason: string };
}

/* ─── Public API ────────────────────────────────────────────────────── */

/**
 * List every store that has, or may have, published products.
 *
 * The set is the UNION of:
 *
 *   1. Legacy FS dirs under `.platform-data/products/<storeId>/`
 *      (M7 publisher CLI artefacts). Detected by reading the
 *      directory; missing roots return nothing.
 *
 *   2. Registered `live` stores from `@platform/stores`. This way a
 *      brand-new store that has DB-published products but no FS dir
 *      yet still surfaces, and a deployment that has never run the
 *      legacy CLI still enumerates the catalog. We deliberately do
 *      NOT query `studio_published_product` for distinct storeIds —
 *      the registry is the canonical source of "which stores can
 *      hold catalogs" and the per-store loader (`listProducts`)
 *      handles the actual presence check.
 *
 * Stores are returned sorted alphabetically. The page-level empty
 * state checks `totalProducts === 0` to decide whether to render
 * sections, so an enumerated store with no products still collapses
 * cleanly into the page-level "No products published yet" card.
 */
export async function listPublishedStores(): Promise<string[]> {
  const fsStores = await listFsStores();
  const registryStores = listStores()
    .filter((s) => s.status === "live")
    .map((s) => s.id);
  const union = Array.from(new Set([...fsStores, ...registryStores]));
  union.sort();
  return union;
}

async function listFsStores(): Promise<string[]> {
  const root = productsRoot();
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/**
 * List every product for `<storeId>`. The result is sorted most-
 * recently-published first.
 *
 * # Two read paths, one union
 *
 * The Studio operates on two parallel catalogs:
 *
 *   1. **DB**: `studio_published_product` rows written by the M11
 *      publish-from-builder flow (`publishDraft()` →
 *      `repositories.published.publish()`). One row per `(storeId,
 *      slug, version)`, with `isCurrent=true` on the latest.
 *
 *   2. **FS**: `.platform-data/products/<storeId>/<id>.json` bundles
 *      written by the legacy M7 `FanaaPublisher` CLI. Pre-M11 path.
 *
 * Before C3.1, this function only read the FS path. Any product
 * published from the builder was invisible to the products catalog
 * (a "split-brain"). The fix is to merge both reads here, prefer DB
 * on slug collision (DB is the system of record once the M11 flow
 * lands), and stamp each summary with `source: "db" | "fs"` so the
 * UI can route the card click correctly.
 *
 * Corrupt files / schema-invalid DB rows appear in the list with
 * `corrupted` set — the UI shows them with a warning state instead
 * of hiding them, so the operator can spot+repair drift.
 *
 * # Graceful degradation
 *
 * If persistence is in file-only mode (no Prisma client wired), the
 * DB read silently no-ops and the function returns FS-only — exactly
 * the pre-C3.1 behaviour. Tests that don't enable dual-write still
 * see the legacy semantics.
 */
export async function listProducts(
  storeId: string,
): Promise<ProductSummary[]> {
  const [fsRows, dbRows] = await Promise.all([
    listFromFs(storeId),
    listFromDb(storeId),
  ]);

  // Cross-source dedup only — never within a source. Two FS bundles
  // can legitimately share a slug (e.g. an old run plus a regenerated
  // run) and we want both to remain visible so the operator can
  // notice the duplicate and clean it up. DB rows are unique on
  // `(storeId, slug, isCurrent=true)` by construction.
  //
  // When a slug is published in both DB and FS, the DB row wins
  // because the M11 publish flow is the system of record once a
  // draft has been promoted from the builder.
  const dbSlugs = new Set(dbRows.map((r) => r.slug));
  const summaries: ProductSummary[] = [...dbRows];
  for (const row of fsRows) {
    if (!dbSlugs.has(row.slug)) {
      summaries.push(row);
    }
  }

  summaries.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return summaries;
}

/** FS-backed legacy reader. Returns `[]` on missing root. */
async function listFromFs(storeId: string): Promise<ProductSummary[]> {
  const dir = path.join(productsRoot(), storeId);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const ids = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));

  const summaries: ProductSummary[] = [];
  for (const id of ids) {
    const result = await readProduct(storeId, id);
    if (result.status === "ok") {
      summaries.push({
        storeId,
        productId: id,
        slug: result.bundle.universalProduct.slug,
        title: result.bundle.universalProduct.title,
        niche: result.bundle.universalProduct.niche,
        runId: result.bundle.runId,
        publishedAt: result.bundle.publishedAt,
        hasFanaaExtension: Boolean(result.bundle.fanaaExtension),
        heroImage: extractHeroImage(result.bundle.universalProduct.images),
        source: "fs",
      });
    } else if (result.status === "corrupted") {
      summaries.push({
        storeId,
        productId: id,
        slug: id,
        title: { ar: "", en: id },
        niche: "",
        runId: "",
        publishedAt: "",
        hasFanaaExtension: false,
        heroImage: null,
        source: "fs",
        corrupted: { reason: result.reason },
      });
    }
  }
  return summaries;
}

/** DB-backed reader. Returns `[]` when persistence is file-only or
 *  on any read error (logged via console; we don't want a transient
 *  DB blip to wipe the catalog). */
async function listFromDb(storeId: string): Promise<ProductSummary[]> {
  let result: Awaited<ReturnType<typeof listPublishedProducts>>;
  try {
    result = await listPublishedProducts({ storeId });
  } catch (err) {
    // Defensive: any unexpected throw degrades to "no DB rows" so
    // the FS path still serves something. Diagnostic logging only —
    // structured logs hook in via the API route + middleware later.
    // eslint-disable-next-line no-console
    console.warn(
      `[product-loader] listFromDb threw for storeId=${storeId}:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
  if (!result.ok) {
    if (result.code === "mode_unavailable") return [];
    // eslint-disable-next-line no-console
    console.warn(
      `[product-loader] listFromDb failed for storeId=${storeId}: code=${result.code}`,
    );
    return [];
  }

  const storeConfig = getStore(storeId);
  const niche = storeConfig?.niche ?? "";

  return result.value.map((item) => mapPublishedToSummary(item, niche));
}

/**
 * Adapt a DB-published item into the `ProductSummary` shape the
 * products card consumes. Pure / testable; the niche fallback is
 * pulled from the store registry by the caller.
 */
export function mapPublishedToSummary(
  item: PublishedListItem,
  niche: string,
): ProductSummary {
  const row = item.row;
  if (item.documentInvalid || !item.document) {
    return {
      storeId: row.storeId,
      productId: row.id,
      slug: row.slug,
      title: { ar: "", en: row.slug },
      niche,
      runId: "",
      publishedAt: row.publishedAt.toISOString(),
      hasFanaaExtension: false,
      heroImage: null,
      source: "db",
      corrupted: { reason: "document_schema_invalid" },
    };
  }
  const doc = item.document;
  return {
    storeId: row.storeId,
    productId: row.id,
    slug: row.slug,
    title: {
      ar: doc.meta.title.ar ?? "",
      en: doc.meta.title.en ?? "",
    },
    niche,
    runId: "",
    publishedAt: row.publishedAt.toISOString(),
    hasFanaaExtension: false,
    heroImage: extractHeroFromDocument(doc),
    source: "db",
  };
}

/**
 * Resolve a hero thumbnail from a draft document — mirrors the
 * `buildPageMetadata` ogImage fallback chain:
 *
 *   1. `meta.ogImage` (operator-set override)
 *   2. First `hero` section's `media.desktopSrc`
 *   3. First `image_gallery` section's first item
 *
 * Returns `null` when nothing usable is found, so the card renders
 * the neutral "no image" placeholder instead of a broken `<img>`.
 */
function extractHeroFromDocument(
  doc: DraftDocument,
): ProductSummaryHero | null {
  const src = pickDocumentHeroSrc(doc);
  if (!src) return null;
  const resolved = resolveImageUrl(src);
  return {
    src,
    resolvedSrc: resolved,
    alt: { ar: "", en: doc.meta.title.en ?? "" },
    placeholder: resolved.startsWith("placeholder://"),
  };
}

function pickDocumentHeroSrc(doc: DraftDocument): string | null {
  if (doc.meta.ogImage) return doc.meta.ogImage;
  const hero = doc.sections.find((s) => s.kind === "hero");
  if (hero && hero.kind === "hero" && hero.media) {
    return hero.media.desktopSrc;
  }
  const gallery = doc.sections.find((s) => s.kind === "image_gallery");
  if (
    gallery &&
    gallery.kind === "image_gallery" &&
    gallery.items.length > 0
  ) {
    return gallery.items[0]!.desktopSrc;
  }
  return null;
}

/**
 * Pull a thumbnail-ready hero snapshot from a UniversalProduct's
 * `images[]`. Returns `null` when the bundle has no images at all.
 *
 * # Why a separate helper (and not inline in listProducts)
 *
 * The placeholder semantics — `resolveImageUrl()` may return a
 * `placeholder://...` token when the CDN isn't configured — need to
 * be threaded through to the UI so the products card can render the
 * styled "asset pending" placeholder instead of a broken `<img>`.
 * Encapsulating the extraction in one function keeps that logic
 * close to the schema and lets a future caller (e.g. a search-by-
 * image surface) reuse it without copying.
 */
export function extractHeroImage(
  images: ReadonlyArray<ProductImage> | undefined,
): ProductSummaryHero | null {
  if (!images || images.length === 0) return null;
  const hero = images[0]!;
  const resolved = resolveImageUrl(hero.src);
  return {
    src: hero.src,
    resolvedSrc: resolved,
    alt: hero.alt,
    placeholder: resolved.startsWith("placeholder://"),
  };
}

/**
 * Read a single bundle by storeId + productId (the
 * `universalProduct.id` — Fanaa publisher writes the file as
 * `<universalProductId>.json`).
 */
export async function readProduct(
  storeId: string,
  productId: string,
): Promise<ProductLoadResult> {
  const filePath = path.join(productsRoot(), storeId, `${productId}.json`);

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { status: "not_found", storeId, productId };
    }
    return {
      status: "corrupted",
      storeId,
      productId,
      filePath,
      reason: "read_error",
      details: (err as Error).message,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      status: "corrupted",
      storeId,
      productId,
      filePath,
      reason: "invalid_json",
      details: (err as Error).message,
    };
  }

  const validated = PublishedBundleSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      status: "corrupted",
      storeId,
      productId,
      filePath,
      reason: "schema_mismatch",
      details: validated.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }

  return { status: "ok", bundle: validated.data, filePath };
}
