/**
 * CLI seed runner — fanaa curated storefront catalog (M12 / Step 2).
 *
 * # Usage
 *
 *   # From the workspace root, against a local dev DB:
 *   $env:ADMIN_DATABASE_URL="postgresql://elfanaa:elfanaa@localhost:5432/elfanaa"
 *   pnpm --filter @platform/db seed:storefront-catalog-fanaa
 *
 *   # Against production (operator's dev machine, with prod URL):
 *   $env:ADMIN_DATABASE_URL="postgresql://<prod-host>/<db>"
 *   pnpm --filter @platform/db seed:storefront-catalog-fanaa
 *
 * # Idempotency
 *
 * Re-running this seed is safe. Every write goes through `upsert`
 * keyed on `(storeId, slug)`. The script reports `created` vs
 * `updated` per row so the operator can see what changed.
 *
 * # Transaction semantics
 *
 * The seed runs inside a single `prisma.$transaction`. If any row
 * fails, NONE are committed — a half-seeded DB is impossible.
 *
 * # Why this file is a thin CLI wrapper
 *
 * The actual seed logic lives in `@platform/persistence/seeds`
 * (`packages/persistence/src/seeds/fanaa-storefront-catalog.ts`)
 * where it can be unit-tested with vitest's mock Prisma. This file
 * just bridges the workspace's seed convention (a script in
 * `packages/db/prisma/seed/`) to that library function.
 */

import { PrismaClient } from "@prisma/client";
import { seedFanaaStorefrontCatalog } from "@platform/persistence/seeds";

function normaliseAdminDbUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let url = raw.trim();
  // The FastAPI service stores its DB URL as `postgresql+asyncpg://...`.
  // Operators routinely copy that value into ADMIN_DATABASE_URL — strip
  // the SQLAlchemy dialect prefix so Prisma accepts it. Mirrors the
  // identical normalisation in `apps/fanaa/lib/admin/db.ts`.
  url = url.replace(/^postgresql\+asyncpg:\/\//i, "postgresql://");
  url = url.replace(/^postgres\+asyncpg:\/\//i, "postgres://");
  return url;
}

async function main(): Promise<void> {
  const dbUrl = normaliseAdminDbUrl(process.env.ADMIN_DATABASE_URL);
  if (!dbUrl) {
    // eslint-disable-next-line no-console
    console.error(
      "[seed:storefront-catalog-fanaa] ADMIN_DATABASE_URL is not set.\n" +
        "Set it before running the seed:\n" +
        '  $env:ADMIN_DATABASE_URL="postgresql://user:pass@host:5432/db"',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    // eslint-disable-next-line no-console
    console.log(
      `[seed:storefront-catalog-fanaa] connecting to ${dbUrl.replace(/:[^:@/]+@/, ":***@")}`,
    );
    // The PrismaLike contract in @platform/persistence covers the
    // exact subset of the real PrismaClient we call here. The cast
    // is safe because PrismaClient is a strict superset.
    const result = await seedFanaaStorefrontCatalog(prisma as unknown as Parameters<typeof seedFanaaStorefrontCatalog>[0]);

    // eslint-disable-next-line no-console
    console.log("[seed:storefront-catalog-fanaa] result:");
    for (const row of result.rows) {
      const verb = row.created ? "created" : "updated";
      // eslint-disable-next-line no-console
      console.log(`  • ${verb.padEnd(7)} ${row.slug.padEnd(20)} id=${row.id}`);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[seed:storefront-catalog-fanaa] done — store=${result.storeId} rows=${result.rows.length}`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[seed:storefront-catalog-fanaa] FAILED — transaction rolled back",
    );
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
