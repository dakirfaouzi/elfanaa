/**
 * Persistence seeds barrel.
 *
 * Each seed lives in its own file under `./seeds/`. The seed is a
 * pure function that accepts a `PrismaLike` and returns a summary;
 * the CLI wrapper that runs it from `packages/db` instantiates the
 * real client and forwards.
 *
 * Seeds are NOT auto-run by `prisma migrate dev`. Operators invoke
 * them explicitly via `pnpm --filter @platform/db seed:<name>`.
 */
export {
  FANAA_CURATED_CATALOG,
  seedFanaaStorefrontCatalog,
  type FanaaCatalogSeedResult,
  type FanaaCuratedRow,
} from "./fanaa-storefront-catalog";
