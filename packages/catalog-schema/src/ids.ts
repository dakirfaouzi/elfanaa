/**
 * String identifier types — open for extension at the platform level but
 * narrowed enough that exhaustive `switch` blocks catch obvious typos.
 *
 * The `& {}` trick preserves the literal-union autocomplete while still
 * accepting any string at compile time. This lets future stores be added
 * by writing a `StoreConfig` instance without first widening the type
 * union in this file — but the IDE still suggests the known IDs.
 */

/** Stable store identifier. Matches `StoreConfig.id` and `apps/<store>/`. */
export type StoreId =
  | "fanaa"
  // Future placeholders — listed for IDE autocomplete only. A new store
  // landing here doesn't change platform behaviour until a corresponding
  // `StoreConfig` is registered in `@platform/stores`.
  | "trendora"
  | (string & {});

/**
 * Niche taxonomy — drives prompt selection, section availability, niche
 * extensions on UniversalProduct. Adding a new niche means writing a
 * matching `NicheProfile` in `@platform/stores`; no type change required.
 */
export type NicheId =
  | "beauty_wellness"
  | "fashion"
  | "electronics"
  | "home"
  | "fitness"
  | (string & {});

/**
 * Publisher binding — used by `StoreConfig.publisher` to resolve which
 * publisher adapter materialises UniversalProduct for this store.
 *
 * The string-extension pattern allows future publishers (`shopify`,
 * `tiktok_shop`, `meta_catalog`) to land without bumping the schema.
 */
export type PublisherId =
  | "fanaa"
  | "shopify"
  | "tiktok_shop"
  | (string & {});

/**
 * Operational store status — drives which stores appear in the Studio
 * store-switcher and which are excluded from broadcast publishers.
 *
 *   • "live"        — accepting publishes, surfaced in switchers.
 *   • "incubating"  — drafts allowed, publish blocked.
 *   • "archived"    — read-only; visible in history but hidden from
 *                     new-draft creation.
 */
export type StoreStatus = "live" | "incubating" | "archived";
