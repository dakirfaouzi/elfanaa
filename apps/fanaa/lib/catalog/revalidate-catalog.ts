import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Catalog cache invalidation (Catalog PR C).
 *
 * Storefront catalog reads are `React.cache` (per-request) + ISR
 * (`revalidate = 60`). After an archive/restore mutation we must purge the ISR
 * cache for every surface that dereferences the catalog, otherwise the change
 * lags up to 60s. Calling `revalidatePath` from the mutation route handler
 * forces those paths to regenerate on next request.
 *
 * We use `revalidatePath` rather than tagging reads with `revalidateTag` to
 * keep the loader's caching model untouched (PR C is additive — no read-path
 * change). For dynamic segments we pass `type: "page"` so EVERY instance of
 * that route (every PDP, every collection) is invalidated, not just one.
 */

/** Static catalog surfaces (exact paths). */
const STATIC_SURFACES = ["/", "/shop", "/collections", "/concerns"] as const;

/** Dynamic catalog surfaces (route patterns; invalidated for all instances). */
const DYNAMIC_SURFACES = [
  "/products/[slug]",
  "/collections/[slug]",
  "/concerns/[slug]",
  "/for/[gender]",
] as const;

/**
 * Invalidate every storefront surface that renders catalog products. Safe to
 * call after any archive/restore. A path that does not exist is a harmless
 * no-op, so this stays correct even if a surface is later removed.
 */
export function revalidateCatalogSurfaces(): void {
  for (const path of STATIC_SURFACES) revalidatePath(path);
  for (const path of DYNAMIC_SURFACES) revalidatePath(path, "page");
}
