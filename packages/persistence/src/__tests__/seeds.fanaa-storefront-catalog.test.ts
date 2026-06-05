import { describe, expect, it } from "vitest";
import {
  FANAA_CURATED_CATALOG,
  seedFanaaStorefrontCatalog,
} from "../seeds/fanaa-storefront-catalog";
import type { StorefrontCatalogProductRow } from "../contracts";
import { makeMockPrisma } from "./_helpers/mock-prisma";

function makeUpsertRow(
  slug: string,
  over: Partial<StorefrontCatalogProductRow> = {},
): StorefrontCatalogProductRow {
  return {
    id: `cat_${slug}`,
    storeId: "fanaa",
    slug,
    source: "curated",
    publishedProductId: null,
    sku: "FN-XXX",
    priceMinor: 19_900,
    priceCurrency: "SAR",
    offerTiers: [],
    collection: null,
    productType: null,
    target: null,
    problems: [],
    badges: null,
    rating: null,
    stockLeft: null,
    recentBuyers: null,
    upsellIds: [],
    postPurchaseUpsellId: null,
    landingPath: null,
    heroImageUrl: null,
    croContent: null,
    isLive: true,
    archivedAt: null,
    archivedReason: null,
    archivedBy: null,
    createdAt: new Date("2026-05-26T15:00:00Z"),
    updatedAt: new Date("2026-05-26T15:00:00Z"),
    ...over,
  };
}

describe("FANAA_CURATED_CATALOG (the data itself)", () => {
  // The seed data is the contract the storefront's loader (Phase 2.2)
  // depends on. Locking these assertions in catches accidental edits
  // — e.g. someone bumps the price in products.ts but forgets to
  // re-run the seed.

  it("contains exactly four curated rows", () => {
    expect(FANAA_CURATED_CATALOG).toHaveLength(4);
  });

  it("uses unique slugs", () => {
    const slugs = FANAA_CURATED_CATALOG.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses unique SKUs", () => {
    const skus = FANAA_CURATED_CATALOG.map((r) => r.sku);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("pins SAR as the only currency", () => {
    // The fanaa storefront is SAR-only by site config. A non-SAR row
    // here would silently break price formatting and cart totals.
    for (const row of FANAA_CURATED_CATALOG) {
      expect(row.priceCurrency).toBe("SAR");
      for (const tier of row.offerTiers) {
        expect(tier.total.currency).toBe("SAR");
      }
    }
  });

  it("uses the shared 1/2/3 tier price ladder (199/279/349 SAR)", () => {
    const expected = [
      { quantity: 1, amount: 19_900 },
      { quantity: 2, amount: 27_900 },
      { quantity: 3, amount: 34_900 },
    ];
    for (const row of FANAA_CURATED_CATALOG) {
      expect(row.offerTiers).toHaveLength(3);
      for (let i = 0; i < expected.length; i++) {
        expect(row.offerTiers[i]!.quantity).toBe(expected[i]!.quantity);
        expect(row.offerTiers[i]!.total.amount).toBe(expected[i]!.amount);
      }
    }
  });

  it("references only existing slugs in upsellIds (no dangling refs)", () => {
    const slugs = new Set(FANAA_CURATED_CATALOG.map((r) => r.slug));
    for (const row of FANAA_CURATED_CATALOG) {
      for (const target of row.upsellIds) {
        expect(slugs.has(target)).toBe(true);
      }
      // A row also must not list itself as an upsell.
      expect(row.upsellIds.includes(row.slug)).toBe(false);
    }
  });

  it("pins sugarbear-hair's landingPath to /sugarbear (bespoke route)", () => {
    // Sugarbear has a hand-tuned landing experience at /sugarbear; the
    // catalog row MUST route the shop card there instead of the
    // default /products/<slug> template. Forgetting this strands the
    // bespoke conversion flow.
    const sugar = FANAA_CURATED_CATALOG.find((r) => r.slug === "sugarbear-hair");
    expect(sugar?.landingPath).toBe("/sugarbear");
  });

  it("leaves the other three curated products' landingPath null", () => {
    // null = default route at /products/<slug>. Anything else would
    // hide the curated PDP behind a redirect.
    const nonSugar = FANAA_CURATED_CATALOG.filter(
      (r) => r.slug !== "sugarbear-hair",
    );
    for (const row of nonSugar) {
      expect(row.landingPath).toBeNull();
    }
  });
});

describe("seedFanaaStorefrontCatalog (the orchestrator)", () => {
  it("upserts the fanaa StudioStore row before any catalog row", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioStore.upsert.mockResolvedValue({
      id: "fanaa",
      displayName: "Fanaa",
      status: "live",
      configHash: "seed-storefront-catalog",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    spies.storefrontCatalogProduct.findFirst.mockResolvedValue(null);
    spies.storefrontCatalogProduct.upsert.mockImplementation(async (args) => {
      const create = (args as { create: { slug: string } }).create;
      return makeUpsertRow(create.slug);
    });

    await seedFanaaStorefrontCatalog(prisma);

    expect(spies.studioStore.upsert).toHaveBeenCalledTimes(1);
    const storeCallArgs = spies.studioStore.upsert.mock.calls[0][0] as {
      where: { id: string };
      create: { id: string; displayName: string };
    };
    expect(storeCallArgs.where.id).toBe("fanaa");
    expect(storeCallArgs.create.id).toBe("fanaa");
    expect(storeCallArgs.create.displayName).toBe("Fanaa");

    // The store upsert must happen FIRST, before any catalog upsert
    // — otherwise the FK fails on a fresh DB.
    const storeUpsertOrder = spies.studioStore.upsert.mock.invocationCallOrder[0]!;
    const firstCatalogUpsertOrder =
      spies.storefrontCatalogProduct.upsert.mock.invocationCallOrder[0]!;
    expect(storeUpsertOrder).toBeLessThan(firstCatalogUpsertOrder);
  });

  it("upserts all four curated rows in declaration order", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioStore.upsert.mockResolvedValue({
      id: "fanaa",
      displayName: "Fanaa",
      status: "live",
      configHash: "seed-storefront-catalog",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    spies.storefrontCatalogProduct.findFirst.mockResolvedValue(null);
    spies.storefrontCatalogProduct.upsert.mockImplementation(async (args) => {
      const create = (args as { create: { slug: string } }).create;
      return makeUpsertRow(create.slug);
    });

    const result = await seedFanaaStorefrontCatalog(prisma);

    expect(spies.storefrontCatalogProduct.upsert).toHaveBeenCalledTimes(4);
    expect(result.rows.map((r) => r.slug)).toEqual([
      "glow-serum",
      "barrier-cream",
      "hair-mask",
      "sugarbear-hair",
    ]);
  });

  it("marks rows as created=true on a fresh DB", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioStore.upsert.mockResolvedValue({
      id: "fanaa",
      displayName: "Fanaa",
      status: "live",
      configHash: "seed-storefront-catalog",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    spies.storefrontCatalogProduct.findFirst.mockResolvedValue(null);
    spies.storefrontCatalogProduct.upsert.mockImplementation(async (args) => {
      const create = (args as { create: { slug: string } }).create;
      return makeUpsertRow(create.slug);
    });

    const result = await seedFanaaStorefrontCatalog(prisma);

    for (const row of result.rows) {
      expect(row.created).toBe(true);
    }
  });

  it("marks rows as created=false on re-run (rows already exist)", async () => {
    const { prisma, spies } = makeMockPrisma();
    spies.studioStore.upsert.mockResolvedValue({
      id: "fanaa",
      displayName: "Fanaa",
      status: "live",
      configHash: "seed-storefront-catalog",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    spies.storefrontCatalogProduct.findFirst.mockImplementation(async (args) => {
      const where = (args as { where: { slug: string } }).where;
      return makeUpsertRow(where.slug);
    });
    spies.storefrontCatalogProduct.upsert.mockImplementation(async (args) => {
      const create = (args as { create: { slug: string } }).create;
      return makeUpsertRow(create.slug);
    });

    const result = await seedFanaaStorefrontCatalog(prisma);

    for (const row of result.rows) {
      expect(row.created).toBe(false);
    }
  });

  it("passes source=curated for every row", async () => {
    // The seed writes ONLY curated rows. AI-generated rows land via
    // the Studio publish flow (Phase 2.3); confusing the two would
    // make the dashboard's source split lie.
    const { prisma, spies } = makeMockPrisma();
    spies.studioStore.upsert.mockResolvedValue({
      id: "fanaa",
      displayName: "Fanaa",
      status: "live",
      configHash: "seed-storefront-catalog",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    spies.storefrontCatalogProduct.findFirst.mockResolvedValue(null);
    spies.storefrontCatalogProduct.upsert.mockImplementation(async (args) => {
      const create = (args as { create: { slug: string } }).create;
      return makeUpsertRow(create.slug);
    });

    await seedFanaaStorefrontCatalog(prisma);

    for (const call of spies.storefrontCatalogProduct.upsert.mock.calls) {
      const args = call[0] as { create: { source: string } };
      expect(args.create.source).toBe("curated");
    }
  });

  it("propagates the failure when a catalog upsert rejects (transaction rollback semantics)", async () => {
    // The seed runs inside prisma.$transaction so a failed row aborts
    // the whole seed. We don't manually call rollback in the seed
    // code — Prisma's transaction wrapper handles it — but we MUST
    // not swallow the error. A swallowed error would leave a
    // half-seeded DB, the worst possible outcome.
    const { prisma, spies } = makeMockPrisma();
    spies.studioStore.upsert.mockResolvedValue({
      id: "fanaa",
      displayName: "Fanaa",
      status: "live",
      configHash: "seed-storefront-catalog",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    spies.storefrontCatalogProduct.findFirst.mockResolvedValue(null);
    spies.storefrontCatalogProduct.upsert
      .mockResolvedValueOnce(makeUpsertRow("glow-serum"))
      .mockRejectedValueOnce(new Error("constraint violation"));

    await expect(seedFanaaStorefrontCatalog(prisma)).rejects.toThrow();
  });
});
