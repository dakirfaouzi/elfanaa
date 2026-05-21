/**
 * Publisher / store-specific extensions to UniversalProduct.
 *
 * Each file in this directory describes the fields ONE publisher needs
 * that don't belong in the universal shape. Publishers compose
 * `UniversalProduct` with their extension at materialise-time.
 *
 * Future entries (when those publishers ship):
 *   • shopify.ts        — variant gid, metafields, theme tags
 *   • tiktok-shop.ts    — category mapping, commission tier
 *   • meta-catalog.ts   — feed-specific availability flags
 */
export type {
  FanaaProductExtension,
  FanaaOfferTier,
  FanaaProductType,
  FanaaProductTarget,
  FanaaProductProblem,
} from "./fanaa";
