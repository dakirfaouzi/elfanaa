/**
 * Catalog resolver tests (M12 / Step 2 / Phase 2.5).
 *
 * Pin the contract of the snapshot-first → hybrid-loader-fallback
 * resolver that bridges the catalog split (see
 * `lib/catalog/resolver.ts` docstring for full rationale).
 *
 * # What this file guards
 *
 *   1. Snapshot products resolve through the FAST path with ZERO
 *      side-effects (no DB hit, no async cost). This pins the
 *      race-safety contract the order re-pricer relied on before
 *      Phase 2.5.
 *
 *   2. AI-generated products (absent from snapshot, present in
 *      `storefront_catalog_product`) resolve through the hybrid
 *      loader fallback. This is the bug class that produced the
 *      "Add to cart silently does nothing" report.
 *
 *   3. True catalog drift (id missing from BOTH sources) still
 *      resolves to `null`. The `/api/orders` re-pricer treats
 *      `null` as 422 — that contract is unchanged from the original
 *      `getProductById === undefined` behaviour.
 *
 *   4. Batch resolution dedupes the DB hit to one call per request
 *      regardless of how many AI-gen lines need resolving. This is
 *      a performance contract, not a correctness one — the order
 *      POST processes every cart line and must NOT amplify a 6-line
 *      cart into 6 DB queries.
 *
 * # Why mock the loader instead of stubbing Prisma
 *
 * The loader is the only thing the resolver depends on (besides
 * snapshot, which is a pure constant). Mocking at the loader
 * boundary keeps these tests:
 *   • Fast — no DB initialisation cost.
 *   • Hermetic — no `prisma generate` requirement, no environment
 *     variables, no Postgres binary.
 *   • Focused on the resolver's contract (snapshot precedence +
 *     batch dedup) rather than the loader's own contract (which
 *     is exercised by `catalog-merge.test.ts`).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Product } from "@/lib/types";

// The resolver lives in a server-only module. Vitest doesn't ship
// the Next.js `server-only` shim, so without this mock the import
// chain throws "Failed to load url server-only". A no-op module
// stub is the standard workaround documented in the Next.js
// testing guide.
vi.mock("server-only", () => ({}));

// Mock the hybrid loader BEFORE importing the resolver — Vitest
// hoists vi.mock to the top of the file. The resolver imports
// `loadAllCatalogProducts` from `./loader`, so we intercept that
// boundary and observe call counts directly.
vi.mock("@/lib/catalog/loader", () => ({
  loadAllCatalogProducts: vi.fn(),
}));

import {
  resolveCatalogProductById,
  resolveCatalogProductBySlug,
  resolveCatalogProductsByIds,
} from "@/lib/catalog/resolver";
import { loadAllCatalogProducts } from "@/lib/catalog/loader";
import { products as snapshot } from "@/data/products";

const mockedLoader = vi.mocked(loadAllCatalogProducts);

/* -------------------------------------------------------------------------- */
/*                                  Fixtures                                   */
/* -------------------------------------------------------------------------- */

function aiGenProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "run_mppn2yd3_tkres2c7",
    slug: "run_mppn2yd3_tkres2c7",
    title: { ar: "AI", en: "AI" },
    description: { ar: "", en: "" },
    images: [{ src: "data:image/svg+xml;utf8,<svg/>", alt: { ar: "", en: "" } }],
    price: { amount: 19900, currency: "SAR" },
    ...overrides,
  };
}

const SNAPSHOT_ID = snapshot[0]!.id;
const SNAPSHOT_SLUG = snapshot[0]!.slug;

beforeEach(() => {
  mockedLoader.mockReset();
});

/* -------------------------------------------------------------------------- */
/*                          resolveCatalogProductById                          */
/* -------------------------------------------------------------------------- */

describe("resolveCatalogProductById", () => {
  it("resolves snapshot products through the fast path (no loader hit)", async () => {
    const product = await resolveCatalogProductById(SNAPSHOT_ID);
    expect(product).not.toBeNull();
    expect(product!.id).toBe(SNAPSHOT_ID);
    // Race-safety contract: a snapshot hit MUST NOT trigger the DB
    // loader. Any regression here re-introduces the mid-checkout
    // republish race we deliberately preserved for snapshot
    // products (see `lib/catalog/snapshot.ts`).
    expect(mockedLoader).not.toHaveBeenCalled();
  });

  it("falls back to the hybrid loader for AI-generated ids (snapshot miss)", async () => {
    const ai = aiGenProduct();
    mockedLoader.mockResolvedValue([ai]);

    const product = await resolveCatalogProductById(ai.id);
    expect(product).toEqual(ai);
    expect(mockedLoader).toHaveBeenCalledTimes(1);
  });

  it("returns null when both snapshot and loader miss (true catalog drift)", async () => {
    mockedLoader.mockResolvedValue([]);
    const product = await resolveCatalogProductById("ghost_product_id");
    expect(product).toBeNull();
  });

  it("preserves stable identity (no defensive cloning) for snapshot products", async () => {
    const a = await resolveCatalogProductById(SNAPSHOT_ID);
    const b = await resolveCatalogProductById(SNAPSHOT_ID);
    // Important for React memoisation downstream — selectors that
    // diff by reference (e.g. `useResolvedCartLines`) get cheap
    // skip-render behaviour when nothing has changed.
    expect(a).toBe(b);
  });
});

/* -------------------------------------------------------------------------- */
/*                         resolveCatalogProductBySlug                         */
/* -------------------------------------------------------------------------- */

describe("resolveCatalogProductBySlug", () => {
  it("resolves snapshot products through the fast path (no loader hit)", async () => {
    const product = await resolveCatalogProductBySlug(SNAPSHOT_SLUG);
    expect(product).not.toBeNull();
    expect(product!.slug).toBe(SNAPSHOT_SLUG);
    expect(mockedLoader).not.toHaveBeenCalled();
  });

  it("falls back to the hybrid loader for AI-generated slugs", async () => {
    const ai = aiGenProduct();
    mockedLoader.mockResolvedValue([ai]);
    const product = await resolveCatalogProductBySlug(ai.slug);
    expect(product?.slug).toBe(ai.slug);
    expect(mockedLoader).toHaveBeenCalledTimes(1);
  });

  it("returns null on true catalog drift", async () => {
    mockedLoader.mockResolvedValue([]);
    const product = await resolveCatalogProductBySlug("ghost-slug");
    expect(product).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*                         resolveCatalogProductsByIds                         */
/* -------------------------------------------------------------------------- */

describe("resolveCatalogProductsByIds", () => {
  it("returns [] for empty input without calling the loader", async () => {
    const out = await resolveCatalogProductsByIds([]);
    expect(out).toEqual([]);
    expect(mockedLoader).not.toHaveBeenCalled();
  });

  it("resolves an all-snapshot batch without calling the loader", async () => {
    const ids = snapshot.slice(0, 2).map((p) => p.id);
    const out = await resolveCatalogProductsByIds(ids);
    expect(out).toHaveLength(ids.length);
    expect(out[0]?.id).toBe(ids[0]);
    expect(out[1]?.id).toBe(ids[1]);
    // All-snapshot fast path: zero DB hits. Critical for the order
    // POST hot path — every Sugarbear / glow-serum / barrier-cream
    // order today is 100% snapshot, and Phase 2.5 must not regress
    // that to a DB round-trip.
    expect(mockedLoader).not.toHaveBeenCalled();
  });

  it("resolves a mixed batch with EXACTLY ONE loader call", async () => {
    const ai1 = aiGenProduct({ id: "run_a", slug: "run_a" });
    const ai2 = aiGenProduct({ id: "run_b", slug: "run_b" });
    mockedLoader.mockResolvedValue([ai1, ai2]);

    const ids = [SNAPSHOT_ID, ai1.id, SNAPSHOT_ID, ai2.id];
    const out = await resolveCatalogProductsByIds(ids);

    expect(out).toHaveLength(ids.length);
    expect(out[0]?.id).toBe(SNAPSHOT_ID);
    expect(out[1]?.id).toBe(ai1.id);
    expect(out[2]?.id).toBe(SNAPSHOT_ID);
    expect(out[3]?.id).toBe(ai2.id);
    // Batch contract: the DB list query fires AT MOST ONCE per
    // resolveBatch invocation, regardless of how many lines need
    // the fallback path. Without this guarantee an N-line AI-gen
    // cart would N-multiply the DB load.
    expect(mockedLoader).toHaveBeenCalledTimes(1);
  });

  it("preserves input position for null entries (correlates to cart.lines[i])", async () => {
    mockedLoader.mockResolvedValue([]);
    const ids = [SNAPSHOT_ID, "ghost_a", SNAPSHOT_ID, "ghost_b"];
    const out = await resolveCatalogProductsByIds(ids);

    expect(out).toHaveLength(4);
    expect(out[0]).not.toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).not.toBeNull();
    expect(out[3]).toBeNull();
    // Order POST relies on positional correlation to surface
    // `product:<id>` errors back to the client. A reorder or
    // filter here would produce mis-attributed unknown_product
    // responses.
  });
});
