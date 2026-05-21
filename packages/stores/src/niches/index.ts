/**
 * Niche profile registry.
 *
 * One instance per niche, cross-store. Stores attach the appropriate
 * profile via `StoreConfig.nicheProfile`. Adding a new niche means
 * adding a new file here + a corresponding entry in
 * `@platform/catalog-schema`'s niche extensions directory.
 */
export { beautyWellnessNiche } from "./beauty-wellness";
