import { describe, expect, it } from "vitest";
import { StorefrontCatalogProductRepository } from "../repositories/storefront-catalog";
import { makeMockPrisma, dbErr } from "./_helpers/mock-prisma";
import type { StorefrontCatalogProductRow } from "../contracts";

function makeRow(
  over: Partial<StorefrontCatalogProductRow> = {},
): StorefrontCatalogProductRow {
  return {
    id: "cat_1",
    storeId: "fanaa",
    slug: "glow-serum",
    source: "curated",
    publishedProductId: null,
    sku: "FNA-GLOW-30",
    priceMinor: 14_900,
    priceCurrency: "SAR",
    offerTiers: null,
    collection: "face",
    productType: "serum",
    target: "women",
    problems: ["dryness", "dullness"],
    badges: null,
    rating: { value: 4.8, count: 312 },
    stockLeft: 47,
    recentBuyers: 218,
    upsellIds: ["hydra-mist"],
    postPurchaseUpsellId: null,
    landingPath: null,
    heroImageUrl: null,
    croContent: null,
    isLive: true,
    createdAt: new Date("2026-05-22T10:00:00Z"),
    updatedAt: new Date("2026-05-26T10:00:00Z"),
    ...over,
  };
}

describe("StorefrontCatalogProductRepository.findBySlug", () => {
  it("returns the row when one matches the (storeId, slug) pair", async () => {
    const { prisma, spies } = makeMockPrisma();
    const row = makeRow();
    spies.storefrontCatalogProduct.findFirst.mockResolvedValueOnce(row);
    const repo = new StorefrontCatalogProductRepository({ prisma });

    const found = await repo.findBySlug({ storeId: "fanaa", slug: "glow-serum" });

    expect(found?.id).toBe("cat_1");
    const callArgs = spies.storefrontCatalogProduct.findFirst.mock.calls[0][0] as {
      where: { storeId: string; slug: string };
    };
    expect(callArgs.where).toEqual({ storeId: "fanaa", slug: "glow-serum" });
  });

  it("returns null when the slug is unknown — loader must handle absent rows", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.findFirst.mockResolvedValueOnce(null);
    const repo = new StorefrontCatalogProductRepository({ prisma });

    const found = await repo.findBySlug({ storeId: "fanaa", slug: "missing" });

    expect(found).toBeNull();
  });

  it("wraps DB errors into PersistenceError{unknown}", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.findFirst.mockRejectedValueOnce(
      new Error("conn lost"),
    );
    const repo = new StorefrontCatalogProductRepository({ prisma });

    await expect(
      repo.findBySlug({ storeId: "fanaa", slug: "glow-serum" }),
    ).rejects.toMatchObject({ kind: "unknown" });
  });
});

describe("StorefrontCatalogProductRepository.findManyBySlugs", () => {
  it("short-circuits to an empty array WITHOUT querying when slugs is empty", async () => {
    // The Postgres reason for the short-circuit: `WHERE slug IN ()` is
    // a syntax error in some PG versions, and even where it's valid it
    // forces a sequential scan. We must not hit the DB at all.
    const { prisma, spies } = makeMockPrisma();
    const repo = new StorefrontCatalogProductRepository({ prisma });

    const result = await repo.findManyBySlugs({ storeId: "fanaa", slugs: [] });

    expect(result).toEqual([]);
    expect(spies.storefrontCatalogProduct.findMany).not.toHaveBeenCalled();
  });

  it("queries with `slug.in` for non-empty input and returns the rows", async () => {
    const { prisma, spies } = makeMockPrisma();
    const rows = [
      makeRow({ id: "cat_1", slug: "glow-serum" }),
      makeRow({ id: "cat_2", slug: "hydra-mist" }),
    ];
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce(rows);
    const repo = new StorefrontCatalogProductRepository({ prisma });

    const result = await repo.findManyBySlugs({
      storeId: "fanaa",
      slugs: ["glow-serum", "hydra-mist"],
    });

    expect(result).toHaveLength(2);
    const callArgs = spies.storefrontCatalogProduct.findMany.mock.calls[0][0] as {
      where: { storeId: string; slug: { in: string[] } };
    };
    expect(callArgs.where.storeId).toBe("fanaa");
    expect(callArgs.where.slug.in).toEqual(["glow-serum", "hydra-mist"]);
  });

  it("treats `slugs` as readonly — passes a fresh Array.from copy to Prisma", async () => {
    // Readonly inputs would otherwise leak into the Prisma call as a
    // ReadonlyArray, which the @prisma/client types reject at compile
    // time. Defensive Array.from is the safest shape.
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([]);
    const repo = new StorefrontCatalogProductRepository({ prisma });
    const frozen = Object.freeze(["a", "b"]) as readonly string[];

    await repo.findManyBySlugs({ storeId: "fanaa", slugs: frozen });

    const callArgs = spies.storefrontCatalogProduct.findMany.mock.calls[0][0] as {
      where: { slug: { in: string[] } };
    };
    expect(Array.isArray(callArgs.where.slug.in)).toBe(true);
    expect(Object.isFrozen(callArgs.where.slug.in)).toBe(false);
  });
});

describe("StorefrontCatalogProductRepository.listLive", () => {
  it("filters by isLive=true and sorts by updatedAt desc", async () => {
    const { prisma, spies } = makeMockPrisma();
    const rows = [
      makeRow({ slug: "newer", updatedAt: new Date("2026-05-26T10:00:00Z") }),
      makeRow({ slug: "older", updatedAt: new Date("2026-05-20T10:00:00Z") }),
    ];
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce(rows);
    const repo = new StorefrontCatalogProductRepository({ prisma });

    const result = await repo.listLive({ storeId: "fanaa" });

    expect(result).toHaveLength(2);
    expect(result[0]?.slug).toBe("newer");
    const callArgs = spies.storefrontCatalogProduct.findMany.mock.calls[0][0] as {
      where: { storeId: string; isLive: boolean };
      orderBy: { updatedAt: string };
      take: number;
    };
    expect(callArgs.where).toEqual({ storeId: "fanaa", isLive: true });
    expect(callArgs.orderBy).toEqual({ updatedAt: "desc" });
    expect(callArgs.take).toBe(500);
  });

  it("clamps `take` to 1000 — a runaway parameter cannot blow the response", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([]);
    const repo = new StorefrontCatalogProductRepository({ prisma });

    await repo.listLive({ storeId: "fanaa", take: 100_000 });

    const callArgs = spies.storefrontCatalogProduct.findMany.mock.calls[0][0] as {
      take: number;
    };
    expect(callArgs.take).toBe(1000);
  });

  it("respects the optional `source` filter for dashboard splits", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([]);
    const repo = new StorefrontCatalogProductRepository({ prisma });

    await repo.listLive({ storeId: "fanaa", source: "ai_generated" });

    const callArgs = spies.storefrontCatalogProduct.findMany.mock.calls[0][0] as {
      where: { source: string };
    };
    expect(callArgs.where.source).toBe("ai_generated");
  });

  it("omits the source filter when not provided", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([]);
    const repo = new StorefrontCatalogProductRepository({ prisma });

    await repo.listLive({ storeId: "fanaa" });

    const callArgs = spies.storefrontCatalogProduct.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect("source" in callArgs.where).toBe(false);
  });
});

describe("StorefrontCatalogProductRepository.upsert", () => {
  it("issues an upsert keyed on (storeId, slug) with full create + update payloads", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.upsert.mockResolvedValueOnce(makeRow());
    const repo = new StorefrontCatalogProductRepository({ prisma });

    await repo.upsert({
      storeId: "fanaa",
      slug: "glow-serum",
      source: "curated",
      priceMinor: 14_900,
      priceCurrency: "SAR",
      collection: "face",
      problems: ["dryness"],
      upsellIds: ["hydra-mist"],
    });

    const callArgs = spies.storefrontCatalogProduct.upsert.mock.calls[0][0] as {
      where: { storeId_slug: { storeId: string; slug: string } };
      create: { storeId: string; slug: string; priceMinor: number };
      update: { priceMinor: number };
    };
    expect(callArgs.where.storeId_slug).toEqual({
      storeId: "fanaa",
      slug: "glow-serum",
    });
    expect(callArgs.create.priceMinor).toBe(14_900);
    expect(callArgs.update.priceMinor).toBe(14_900);
  });

  it("defaults `isLive` to true on create when omitted", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.upsert.mockResolvedValueOnce(makeRow());
    const repo = new StorefrontCatalogProductRepository({ prisma });

    await repo.upsert({
      storeId: "fanaa",
      slug: "new-product",
      source: "ai_generated",
      priceMinor: 9_900,
      priceCurrency: "SAR",
    });

    const callArgs = spies.storefrontCatalogProduct.upsert.mock.calls[0][0] as {
      create: { isLive: boolean };
    };
    expect(callArgs.create.isLive).toBe(true);
  });

  it("converts readonly `problems` and `upsellIds` to fresh mutable arrays", async () => {
    // Same readonly-leak guard as findManyBySlugs. Prisma rejects
    // ReadonlyArray inputs at the type level; defensive Array.from is
    // the safest shape.
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.upsert.mockResolvedValueOnce(makeRow());
    const repo = new StorefrontCatalogProductRepository({ prisma });
    const frozenProblems = Object.freeze(["dryness", "dullness"]) as readonly string[];

    await repo.upsert({
      storeId: "fanaa",
      slug: "x",
      source: "curated",
      priceMinor: 1,
      priceCurrency: "SAR",
      problems: frozenProblems,
    });

    const callArgs = spies.storefrontCatalogProduct.upsert.mock.calls[0][0] as {
      create: { problems: string[] };
    };
    expect(callArgs.create.problems).toEqual(["dryness", "dullness"]);
    expect(Object.isFrozen(callArgs.create.problems)).toBe(false);
  });

  it("maps P2002 (unique conflict) to PersistenceError{conflict}", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.upsert.mockRejectedValueOnce(
      dbErr("P2002", "duplicate (storeId, slug)"),
    );
    const repo = new StorefrontCatalogProductRepository({ prisma });

    await expect(
      repo.upsert({
        storeId: "fanaa",
        slug: "glow-serum",
        source: "curated",
        priceMinor: 1,
        priceCurrency: "SAR",
      }),
    ).rejects.toMatchObject({ kind: "conflict" });
  });

  it("maps P2003 (FK violation — unknown store) to PersistenceError{invalid_input}", async () => {
    // The store_id FK is the only foreign key on this table. The most
    // common P2003 trigger is a typo in the store slug; operators need
    // a clear "invalid input" surface rather than the opaque
    // "unknown" bucket.
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.upsert.mockRejectedValueOnce(
      dbErr("P2003", "FK store_id violation"),
    );
    const repo = new StorefrontCatalogProductRepository({ prisma });

    await expect(
      repo.upsert({
        storeId: "ghost",
        slug: "x",
        source: "curated",
        priceMinor: 1,
        priceCurrency: "SAR",
      }),
    ).rejects.toMatchObject({ kind: "invalid_input" });
  });
});

describe("StorefrontCatalogProductRepository.markUnlisted", () => {
  it("flips isLive=false WITHOUT deleting the row", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.update.mockResolvedValueOnce(
      makeRow({ isLive: false }),
    );
    const repo = new StorefrontCatalogProductRepository({ prisma });

    const result = await repo.markUnlisted({ storeId: "fanaa", slug: "glow-serum" });

    expect(result.isLive).toBe(false);
    const callArgs = spies.storefrontCatalogProduct.update.mock.calls[0][0] as {
      where: { storeId_slug: { storeId: string; slug: string } };
      data: { isLive: boolean };
    };
    expect(callArgs.where.storeId_slug).toEqual({
      storeId: "fanaa",
      slug: "glow-serum",
    });
    expect(callArgs.data).toEqual({ isLive: false });
    expect(spies.storefrontCatalogProduct.delete).not.toHaveBeenCalled();
    expect(spies.storefrontCatalogProduct.deleteMany).not.toHaveBeenCalled();
  });

  it("maps P2025 (row not found) to PersistenceError{not_found}", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.storefrontCatalogProduct.update.mockRejectedValueOnce(
      dbErr("P2025", "Record to update not found."),
    );
    const repo = new StorefrontCatalogProductRepository({ prisma });

    await expect(
      repo.markUnlisted({ storeId: "fanaa", slug: "ghost" }),
    ).rejects.toMatchObject({ kind: "not_found" });
  });
});
