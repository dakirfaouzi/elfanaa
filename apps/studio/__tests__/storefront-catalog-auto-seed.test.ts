import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaLike } from "@platform/persistence";
import {
  __resetStorefrontCatalogAutoSeedGuard,
  runStorefrontCatalogAutoSeed,
  type StorefrontCatalogAutoSeedLogger,
} from "../lib/studio/storefront-catalog-auto-seed";

/**
 * Minimal Prisma-like stub for the auto-seed runner.
 *
 * The runner touches three model delegates:
 *   • storefrontCatalogProduct.findMany (idempotency check)
 *   • storefrontCatalogProduct.upsert   (per-row write)
 *   • studioStore.upsert                (FK bootstrap)
 * …plus `$transaction`, which we wire to invoke the callback with
 * the same stub so transaction-scoped repos see the same spies.
 *
 * We DON'T pull `_helpers/mock-prisma` from the persistence package
 * because that helper is package-internal (`__tests__/_helpers/...`)
 * and isn't part of `@platform/persistence`'s public surface. A
 * focused stub is cheaper than widening the persistence export map.
 */
function makeMinimalPrismaStub() {
  const spies = {
    studioStore: { upsert: vi.fn() },
    storefrontCatalogProduct: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  };
  const prisma = {
    studioStore: spies.studioStore,
    storefrontCatalogProduct: spies.storefrontCatalogProduct,
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> =>
      fn(prisma),
    $disconnect: vi.fn(async () => {
      // Mock disconnect — the runner calls this when it owns the client.
    }),
  } as unknown as PrismaLike;
  return { prisma, spies };
}

function makeRecordingLogger(): StorefrontCatalogAutoSeedLogger & {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("runStorefrontCatalogAutoSeed — env-gating", () => {
  beforeEach(() => __resetStorefrontCatalogAutoSeedGuard());
  afterEach(() => __resetStorefrontCatalogAutoSeedGuard());

  it("returns {disabled} and touches NOTHING when the env flag is unset", async () => {
    // The default state in production today. Until an operator sets the
    // flag, this hook MUST behave like a no-op — that's the entire
    // contract Studio runtime depends on.
    const { prisma, spies } = makeMinimalPrismaStub();
    const logger = makeRecordingLogger();

    const result = await runStorefrontCatalogAutoSeed({
      env: {},
      prisma,
      logger,
    });

    expect(result).toEqual({ status: "disabled" });
    expect(spies.storefrontCatalogProduct.findMany).not.toHaveBeenCalled();
    expect(spies.storefrontCatalogProduct.upsert).not.toHaveBeenCalled();
    expect(spies.studioStore.upsert).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("returns {disabled} when the env flag is something other than 'true'", async () => {
    // Anything other than the literal "true" (case-insensitive) is
    // treated as off. This catches the common operator typos like
    // STOREFRONT_CATALOG_AUTO_SEED=yes / 1 / on without surprising
    // anyone.
    const { prisma, spies } = makeMinimalPrismaStub();
    const logger = makeRecordingLogger();

    for (const value of ["false", "FALSE", "0", "yes", "on", ""]) {
      __resetStorefrontCatalogAutoSeedGuard();
      const result = await runStorefrontCatalogAutoSeed({
        env: { STOREFRONT_CATALOG_AUTO_SEED: value },
        prisma,
        logger,
      });
      expect(result).toEqual({ status: "disabled" });
    }
    expect(spies.storefrontCatalogProduct.findMany).not.toHaveBeenCalled();
  });

  it("accepts 'true' case-insensitively (TRUE, True, true)", async () => {
    for (const value of ["true", "TRUE", "True", "  true  "]) {
      __resetStorefrontCatalogAutoSeedGuard();
      const { prisma, spies } = makeMinimalPrismaStub();
      spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([
        { slug: "glow-serum" },
      ]);
      const logger = makeRecordingLogger();

      const result = await runStorefrontCatalogAutoSeed({
        env: { STOREFRONT_CATALOG_AUTO_SEED: value },
        prisma,
        logger,
      });

      expect(result.status).not.toBe("disabled");
    }
  });
});

describe("runStorefrontCatalogAutoSeed — idempotency", () => {
  beforeEach(() => __resetStorefrontCatalogAutoSeedGuard());
  afterEach(() => __resetStorefrontCatalogAutoSeedGuard());

  it("skips when ANY curated row is already present", async () => {
    // The most common production case after the first successful
    // seed. Operators routinely leave the env flag flipped on
    // (forgetting to unset it). The DB-side row check is the
    // ultimate defense — we MUST NOT re-seed.
    const { prisma, spies } = makeMinimalPrismaStub();
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([
      { slug: "glow-serum", id: "cat_existing" },
    ]);
    const logger = makeRecordingLogger();

    const result = await runStorefrontCatalogAutoSeed({
      env: { STOREFRONT_CATALOG_AUTO_SEED: "true" },
      prisma,
      logger,
    });

    expect(result).toEqual({
      status: "skipped_rows_present",
      existingSlugs: ["glow-serum"],
    });
    expect(spies.storefrontCatalogProduct.upsert).not.toHaveBeenCalled();
    expect(spies.studioStore.upsert).not.toHaveBeenCalled();
    const infoMessages = logger.info.mock.calls.map((c) => c[0] as string);
    expect(infoMessages.some((m) => m.includes("skipping"))).toBe(true);
  });

  it("runs the full seed when zero curated rows exist", async () => {
    const { prisma, spies } = makeMinimalPrismaStub();
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([]);
    spies.studioStore.upsert.mockResolvedValue({
      id: "fanaa",
      displayName: "Fanaa",
      status: "live",
      configHash: "seed-storefront-catalog",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    spies.storefrontCatalogProduct.findFirst.mockResolvedValue(null);
    spies.storefrontCatalogProduct.upsert.mockImplementation(
      async (args: unknown) => {
        const create = (args as { create: { slug: string } }).create;
        return {
          id: `cat_${create.slug}`,
          slug: create.slug,
          storeId: "fanaa",
          source: "curated",
          publishedProductId: null,
          sku: "FN-XXX",
          priceMinor: 19_900,
          priceCurrency: "SAR",
          offerTiers: null,
          collection: null,
          productType: null,
          target: null,
          problems: [],
          badges: null,
          rating: null,
          stockLeft: null,
          recentBuyers: null,
          upsellIds: [],
          landingPath: null,
          isLive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    );
    const logger = makeRecordingLogger();

    const result = await runStorefrontCatalogAutoSeed({
      env: { STOREFRONT_CATALOG_AUTO_SEED: "true" },
      prisma,
      logger,
    });

    expect(result.status).toBe("seeded");
    if (result.status === "seeded") {
      expect(result.rows).toHaveLength(4);
      expect(result.rows.map((r) => r.slug)).toEqual([
        "glow-serum",
        "barrier-cream",
        "hair-mask",
        "sugarbear-hair",
      ]);
    }
    expect(spies.studioStore.upsert).toHaveBeenCalledTimes(1);
    expect(spies.storefrontCatalogProduct.upsert).toHaveBeenCalledTimes(4);
  });

  it("logs per-row created/updated outcomes during a successful seed", async () => {
    // The "log explicit created/updated row output during deploy"
    // requirement. Operators rely on these lines to confirm the
    // seed actually populated the table.
    const { prisma, spies } = makeMinimalPrismaStub();
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([]);
    spies.studioStore.upsert.mockResolvedValue({
      id: "fanaa",
      displayName: "Fanaa",
      status: "live",
      configHash: "x",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    spies.storefrontCatalogProduct.findFirst.mockResolvedValue(null);
    spies.storefrontCatalogProduct.upsert.mockImplementation(
      async (args: unknown) => {
        const create = (args as { create: { slug: string } }).create;
        return {
          id: `cat_${create.slug}`,
          slug: create.slug,
          storeId: "fanaa",
          source: "curated",
          publishedProductId: null,
          sku: "FN-XXX",
          priceMinor: 19_900,
          priceCurrency: "SAR",
          offerTiers: null,
          collection: null,
          productType: null,
          target: null,
          problems: [],
          badges: null,
          rating: null,
          stockLeft: null,
          recentBuyers: null,
          upsellIds: [],
          landingPath: null,
          isLive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    );
    const logger = makeRecordingLogger();

    await runStorefrontCatalogAutoSeed({
      env: { STOREFRONT_CATALOG_AUTO_SEED: "true" },
      prisma,
      logger,
    });

    const messages = logger.info.mock.calls.map((c) => c[0] as string);
    // One "running" line, four per-row lines, one "done" line.
    expect(messages.some((m) => m.includes("running"))).toBe(true);
    expect(messages.filter((m) => m.includes("created")).length).toBe(4);
    expect(messages.some((m) => m.includes("done"))).toBe(true);
    // Each curated slug must appear in the logs.
    for (const slug of ["glow-serum", "barrier-cream", "hair-mask", "sugarbear-hair"]) {
      expect(messages.some((m) => m.includes(slug))).toBe(true);
    }
  });
});

describe("runStorefrontCatalogAutoSeed — process-level guard", () => {
  beforeEach(() => __resetStorefrontCatalogAutoSeedGuard());
  afterEach(() => __resetStorefrontCatalogAutoSeedGuard());

  it("a second call within the same process returns {already_ran}", async () => {
    // Two calls might happen if the instrumentation hook fires twice
    // — e.g. during a Next dev-mode hot reload. The seed MUST run at
    // most once per process to keep DB write traffic predictable.
    const { prisma, spies } = makeMinimalPrismaStub();
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([
      { slug: "glow-serum" },
    ]);
    const logger = makeRecordingLogger();

    const first = await runStorefrontCatalogAutoSeed({
      env: { STOREFRONT_CATALOG_AUTO_SEED: "true" },
      prisma,
      logger,
    });
    const second = await runStorefrontCatalogAutoSeed({
      env: { STOREFRONT_CATALOG_AUTO_SEED: "true" },
      prisma,
      logger,
    });

    expect(first.status).not.toBe("already_ran");
    expect(second).toEqual({ status: "already_ran" });
    // The second call MUST NOT have triggered any DB lookup.
    expect(spies.storefrontCatalogProduct.findMany).toHaveBeenCalledTimes(1);
  });

  it("DOES NOT set the process guard when the env flag is off", async () => {
    // If env-disabled calls set the guard, a later operator-triggered
    // restart with the flag flipped on would silently no-op. The
    // guard MUST only engage AFTER the env-allowed branch executes.
    const { prisma, spies } = makeMinimalPrismaStub();
    const logger = makeRecordingLogger();

    await runStorefrontCatalogAutoSeed({
      env: {},
      prisma,
      logger,
    });
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([]);
    spies.studioStore.upsert.mockResolvedValue({
      id: "fanaa",
      displayName: "Fanaa",
      status: "live",
      configHash: "x",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    spies.storefrontCatalogProduct.findFirst.mockResolvedValue(null);
    spies.storefrontCatalogProduct.upsert.mockImplementation(
      async (args: unknown) => {
        const create = (args as { create: { slug: string } }).create;
        return {
          id: `cat_${create.slug}`,
          slug: create.slug,
          storeId: "fanaa",
          source: "curated",
          publishedProductId: null,
          sku: "FN-XXX",
          priceMinor: 19_900,
          priceCurrency: "SAR",
          offerTiers: null,
          collection: null,
          productType: null,
          target: null,
          problems: [],
          badges: null,
          rating: null,
          stockLeft: null,
          recentBuyers: null,
          upsellIds: [],
          landingPath: null,
          isLive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    );
    const second = await runStorefrontCatalogAutoSeed({
      env: { STOREFRONT_CATALOG_AUTO_SEED: "true" },
      prisma,
      logger,
    });

    expect(second.status).toBe("seeded");
  });
});

describe("runStorefrontCatalogAutoSeed — error handling", () => {
  beforeEach(() => __resetStorefrontCatalogAutoSeedGuard());
  afterEach(() => __resetStorefrontCatalogAutoSeedGuard());

  it("CATCHES seed failures and returns {failed} without rethrowing", async () => {
    // The studio container MUST keep booting even if the seed
    // explodes. Throwing here would crash Next.js's register()
    // before any request is served — strictly worse than an
    // unseeded catalog (which the storefront loader handles
    // gracefully via its build-time snapshot fallback).
    const { prisma, spies } = makeMinimalPrismaStub();
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([]);
    spies.studioStore.upsert.mockResolvedValue({
      id: "fanaa",
      displayName: "Fanaa",
      status: "live",
      configHash: "x",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    spies.storefrontCatalogProduct.findFirst.mockResolvedValue(null);
    spies.storefrontCatalogProduct.upsert.mockRejectedValueOnce(
      new Error("transient db error"),
    );
    const logger = makeRecordingLogger();

    await expect(
      runStorefrontCatalogAutoSeed({
        env: { STOREFRONT_CATALOG_AUTO_SEED: "true" },
        prisma,
        logger,
      }),
    ).resolves.toMatchObject({ status: "failed" });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("returns {failed} (NOT a thrown error) on transaction rollback", async () => {
    // Defense-in-depth: even if the underlying `$transaction`
    // itself rejects (vs. a single upsert), the runner must
    // still catch and surface a structured outcome. This guards
    // against future Prisma changes that bubble transaction errors
    // differently from per-query errors.
    const { prisma, spies } = makeMinimalPrismaStub();
    spies.storefrontCatalogProduct.findMany.mockResolvedValueOnce([]);
    // Force the seed's transaction wrapper to reject.
    (prisma as { $transaction: unknown }).$transaction = vi
      .fn()
      .mockRejectedValueOnce(new Error("postgres deadlock"));
    const logger = makeRecordingLogger();

    const result = await runStorefrontCatalogAutoSeed({
      env: { STOREFRONT_CATALOG_AUTO_SEED: "true" },
      prisma,
      logger,
    });

    expect(result.status).toBe("failed");
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
