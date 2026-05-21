import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  UniversalProductSchema,
  FanaaProductExtensionSchema,
  BeautyWellnessExtensionSchema,
} from "@platform/catalog-schema/schemas";
import type { PublishedProductBundle } from "@platform/publishers";
import { productsRoot } from "./paths";

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

export interface ProductSummary {
  storeId: string;
  productId: string;
  slug: string;
  title: { ar: string; en: string };
  niche: string;
  runId: string;
  publishedAt: string;
  hasFanaaExtension: boolean;
  /** Set when the bundle file exists but failed validation. */
  corrupted?: { reason: string };
}

/* ─── Public API ────────────────────────────────────────────────────── */

/**
 * List every store that has a `products/<storeId>/` directory.
 *
 * Returns an empty array when `.platform-data/products/` does not
 * exist yet (no products have been published — the M7 worker is
 * idle).
 */
export async function listPublishedStores(): Promise<string[]> {
  const root = productsRoot();
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/**
 * List every product bundle under `<storeId>`. The result is sorted
 * most-recently-published first. Corrupt files appear in the list with
 * `corrupted` set — the UI shows them with a warning state instead of
 * hiding them, so the operator can spot+repair drift.
 */
export async function listProducts(
  storeId: string,
): Promise<ProductSummary[]> {
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
        corrupted: { reason: result.reason },
      });
    }
  }

  summaries.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return summaries;
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
