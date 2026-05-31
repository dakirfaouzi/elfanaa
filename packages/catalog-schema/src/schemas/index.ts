/**
 * Barrel — re-export every Zod schema in @platform/catalog-schema.
 *
 * Consumers that need just one schema should import directly from the
 * subpath (`@platform/catalog-schema/schemas`) to keep their bundle
 * tree-shakable, but a single import surface keeps the rest of the
 * platform honest about which validators exist.
 */
export * from "./locales";
export * from "./primitives";
export * from "./section-content";
export * from "./cro-content";
export * from "./universal";
export * from "./extensions/fanaa";
export * from "./niches/beauty-wellness";
