/**
 * Repository barrel.
 *
 *   • StudioStoreRepository              — registry of live stores.
 *   • StudioDraftRepository              — drafts.
 *   • StudioRunRepository                — runs (read side; PrismaRunStore
 *                                          owns the write side).
 *   • StudioAssetRepository              — R2 asset manifest rows.
 *   • StudioEventRepository              — append-only audit log.
 *   • StudioPublishedProductRepository   — immutable publish snapshots.
 *   • StorefrontCatalogProductRepository — DB-backed storefront catalog
 *                                          (M12 / Step 2).
 */
export { StudioStoreRepository } from "./store";
export { StudioDraftRepository } from "./draft";
export { StudioRunRepository } from "./run";
export { StudioAssetRepository } from "./asset";
export { StudioEventRepository } from "./event";
export { StudioPublishedProductRepository } from "./published";
export { StorefrontCatalogProductRepository } from "./storefront-catalog";
