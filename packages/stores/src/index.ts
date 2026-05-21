/**
 * @platform/stores — barrel.
 *
 * Public surface: the StoreConfig / BrandProfile / NicheProfile /
 * StoreTemplates / ExpectationsModel / ProviderAllowlist contracts,
 * the canonical Fanaa StoreConfig instance, the beauty-wellness
 * NicheProfile instance, and the registry helpers.
 *
 * Runtime validators live under `./schemas` (subpath) so the package
 * root stays Zod-free for type-only consumers.
 *
 * Usage:
 *
 *   import type { StoreConfig } from "@platform/stores";
 *   import { getStore, listStores, fanaaStore } from "@platform/stores";
 *   import { StoreConfigSchema } from "@platform/stores/schemas";
 */

// Contracts
export type {
  BrandProfile,
  ExpectationsModel,
  NicheProfile,
  ProviderAllowlist,
  StoreConfig,
  StoreTemplates,
} from "./contracts";

// Niche profile instances
export { beautyWellnessNiche } from "./niches/beauty-wellness";

// Store config instances
export { fanaaStore } from "./stores/fanaa";

// Registry helpers
export { getStore, listStores } from "./registry";
