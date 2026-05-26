import type { PrismaLike } from "@platform/persistence";
import { StorefrontCatalogProductRepository } from "@platform/persistence";
import {
  FANAA_CURATED_CATALOG,
  seedFanaaStorefrontCatalog,
} from "@platform/persistence/seeds";
// `seedFanaaStorefrontCatalog` lives in the dedicated
// `@platform/persistence/seeds` subpath so the seed data (≈5 KB of
// curated product copy) is excluded from every consumer that doesn't
// need it. The Studio's instrumentation hook is the only seed-aware
// caller, so importing from the subpath keeps the rest of Studio's
// bundle graph lean.

/**
 * Production-friendly auto-seed for the fanaa curated catalog rows
 * (M12 / Step 2 — Phase 2.2 fallback).
 *
 * # Why this exists
 *
 * The canonical seed lives in `packages/db/prisma/seed/storefront-
 * catalog-fanaa.ts` and is invoked via
 *   `pnpm --filter @platform/db seed:storefront-catalog-fanaa`.
 *
 * That CLI requires the FULL workspace toolchain (pnpm, tsx, every
 * `packages/*` source tree) — which the EasyPanel Studio runtime
 * image deliberately does NOT ship. The slim production image
 * carries only the Next.js standalone bundle + the Prisma CLI +
 * `node_modules/.prisma`. There is no way to invoke the workspace
 * seed from inside the running container.
 *
 * This module bridges that gap by running the SAME seed function
 * (`seedFanaaStorefrontCatalog` from `@platform/persistence/seeds`)
 * via the Studio's Next.js `instrumentation.ts` boot hook — a
 * stable Next 15 feature that's already part of the standalone
 * bundle. The seed function is bundled into the Studio's Node
 * runtime because `@platform/persistence` is a workspace dep.
 *
 * # How operators trigger it
 *
 *   1. EasyPanel → elfanaa_studio → Environment Variables →
 *      `STOREFRONT_CATALOG_AUTO_SEED=true`.
 *   2. Restart the Studio service.
 *   3. Read the boot logs — look for the
 *      `[storefront_catalog_auto_seed]` prefix. The seed reports
 *      per-row created/updated outcomes plus a final done line.
 *   4. Unset / remove the env var. Re-running with rows present is
 *      ALSO a no-op (idempotency guard below), so leaving it set
 *      indefinitely is technically safe, but operationally the
 *      "intent" of the var is "do this once after a fresh
 *      migration" — flipping it off keeps the env clean.
 *
 * # Defense-in-depth guard sequence
 *
 * The seed runs ONLY when ALL of the following hold:
 *
 *   1. `STOREFRONT_CATALOG_AUTO_SEED === "true"` (case-insensitive).
 *      Default-off means an unsuspecting deploy can NEVER trigger
 *      the seed unintentionally.
 *   2. The Prisma client resolves. If the runtime image was built
 *      without `prisma generate`, we log and exit cleanly rather
 *      than crash the container.
 *   3. None of the four curated slugs already exist in the catalog
 *      for store `fanaa`. Even with the env flag flipped on, an
 *      already-seeded DB short-circuits to a no-op.
 *   4. The seed has not yet executed in this Node process. A
 *      module-level guard prevents accidental double-execution if
 *      `instrumentation.ts` is invoked more than once (e.g. by a
 *      hot reload during local dev).
 *
 * Errors during the seed are CAUGHT and logged. They never
 * propagate to the caller, because the caller is the Next.js
 * boot path — a thrown error would crash the entire Studio
 * container. The DB's `_prisma_migrations`-style audit trail
 * (in our case, the row presence check above) is the trusted
 * post-condition.
 *
 * # Why not auto-run on every boot regardless of env
 *
 * Two reasons:
 *   • Operator intent: deploys MUST be opt-in. Mirrors the
 *     `STUDIO_AUTO_MIGRATE=true` pattern from M10.
 *   • Test isolation: production code paths that touch the DB on
 *     boot are a footgun. The env gate keeps tests + dev safe by
 *     default.
 */

/** Module-level guard. Reset only by `__resetForTests`. */
let ranInThisProcess = false;

export interface StorefrontCatalogAutoSeedLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, err?: unknown) => void;
}

export interface StorefrontCatalogAutoSeedOptions {
  /** Override the raw env. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Inject a Prisma-like client. Production resolves lazily via
   *  `require("@prisma/client")`. Tests pass a mock. */
  prisma?: PrismaLike;
  /** Override the structured logger. Defaults to console-backed. */
  logger?: StorefrontCatalogAutoSeedLogger;
  /** When true, even a successful run does NOT set `ranInThisProcess`.
   *  Used by tests that need to invoke the hook multiple times. */
  skipProcessGuard?: boolean;
}

/**
 * One-shot fanaa catalog seed runner. Safe to call from a Next.js
 * `instrumentation.ts` hook — never throws, never blocks boot.
 *
 * Returns a structured outcome so tests can assert behaviour
 * without parsing logs. Production callers ignore the return value.
 */
export async function runStorefrontCatalogAutoSeed(
  options: StorefrontCatalogAutoSeedOptions = {},
): Promise<
  | { status: "disabled" }
  | { status: "already_ran" }
  | { status: "prisma_unavailable" }
  | { status: "skipped_rows_present"; existingSlugs: string[] }
  | {
      status: "seeded";
      rows: ReadonlyArray<{ slug: string; id: string; created: boolean }>;
    }
  | { status: "failed"; error: unknown }
> {
  const env = options.env ?? process.env;
  const logger = options.logger ?? defaultLogger;

  // ── Guard 1: env flag ────────────────────────────────────────────
  const rawFlag = env.STOREFRONT_CATALOG_AUTO_SEED?.trim().toLowerCase();
  if (rawFlag !== "true") {
    return { status: "disabled" };
  }

  // ── Guard 2: process-level dedup ────────────────────────────────
  if (ranInThisProcess) {
    logger.info(
      "[storefront_catalog_auto_seed] already ran in this process — skipping",
    );
    return { status: "already_ran" };
  }
  if (!options.skipProcessGuard) {
    ranInThisProcess = true;
  }

  // ── Guard 3: Prisma availability ────────────────────────────────
  let prisma = options.prisma ?? null;
  let ownsClient = false;
  if (!prisma) {
    prisma = loadPrismaClient();
    ownsClient = true;
  }
  if (!prisma) {
    logger.warn(
      "[storefront_catalog_auto_seed] enabled but @prisma/client unavailable — skipping (was `prisma generate` run?)",
    );
    return { status: "prisma_unavailable" };
  }

  try {
    // ── Guard 4: row-presence check ────────────────────────────────
    const repo = new StorefrontCatalogProductRepository({ prisma });
    const expectedSlugs = FANAA_CURATED_CATALOG.map((r) => r.slug);
    const existing = await repo.findManyBySlugs({
      storeId: "fanaa",
      slugs: expectedSlugs,
    });
    if (existing.length > 0) {
      const existingSlugs = existing.map((r) => r.slug);
      logger.info(
        `[storefront_catalog_auto_seed] skipping — ${existingSlugs.length} of ${expectedSlugs.length} curated rows already present (slugs: ${existingSlugs.join(", ")})`,
      );
      return { status: "skipped_rows_present", existingSlugs };
    }

    // ── Run the seed ───────────────────────────────────────────────
    logger.info(
      "[storefront_catalog_auto_seed] running — store=fanaa, table is empty for the four curated slugs",
    );
    const result = await seedFanaaStorefrontCatalog(prisma);
    for (const row of result.rows) {
      const verb = row.created ? "created" : "updated";
      logger.info(
        `[storefront_catalog_auto_seed] ${verb.padEnd(7)} ${row.slug.padEnd(20)} id=${row.id}`,
      );
    }
    logger.info(
      `[storefront_catalog_auto_seed] done — store=${result.storeId} rows=${result.rows.length}`,
    );
    return { status: "seeded", rows: result.rows };
  } catch (err) {
    logger.error(
      "[storefront_catalog_auto_seed] FAILED — transaction rolled back; container will continue booting",
      err,
    );
    return { status: "failed", error: err };
  } finally {
    // Release the temporary Prisma client we instantiated for the
    // seed. The Studio's persistence factory holds its OWN client
    // (created lazily on first request); we never want to share
    // ownership of a long-lived pool with a boot-time one-shot.
    //
    // `PrismaLike` (from @platform/persistence) intentionally omits
    // `$disconnect` to keep the contract focused on model delegates,
    // so we route through `unknown` to access the real PrismaClient
    // method without widening the public type.
    if (ownsClient && prisma) {
      const disconnectable = prisma as unknown as {
        $disconnect?: () => Promise<void>;
      };
      if (typeof disconnectable.$disconnect === "function") {
        try {
          await disconnectable.$disconnect();
        } catch {
          // Swallow — we don't care if disconnect fails at this point.
        }
      }
    }
  }
}

/** Reset the module-level guard. Tests only. */
export function __resetStorefrontCatalogAutoSeedGuard(): void {
  ranInThisProcess = false;
}

const defaultLogger: StorefrontCatalogAutoSeedLogger = {
  info: (msg) => {
    // eslint-disable-next-line no-console
    console.log(msg);
  },
  warn: (msg) => {
    // eslint-disable-next-line no-console
    console.warn(msg);
  },
  error: (msg, err) => {
    // eslint-disable-next-line no-console
    console.error(msg, err);
  },
};

/**
 * Lazily load the real PrismaClient. Returns `null` when the client
 * cannot be resolved (no codegen / module missing).
 *
 * # Why CommonJS-style require
 *
 * Identical pattern to `apps/studio/lib/studio/persistence.ts`'s
 * `loadPrismaClient`. Using `require` instead of static import keeps
 * Next.js from statically bundling `@prisma/client` into the Edge
 * runtime where it would be invalid. The instrumentation hook
 * targets the Node runtime exclusively (see `instrumentation.ts`),
 * so `require` resolves correctly there.
 */
function loadPrismaClient(): PrismaLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const prismaPkg = require("@prisma/client") as {
      PrismaClient: new () => PrismaLike;
    };
    return new prismaPkg.PrismaClient();
  } catch {
    return null;
  }
}
