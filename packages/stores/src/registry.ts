import type { StoreId } from "@platform/catalog-schema";
import type { StoreConfig } from "./contracts";
import { fanaaStore } from "./stores";

/**
 * Pure-function store registry.
 *
 * # Why a function-based registry instead of a map exported as `stores`?
 *
 * Exporting `stores` as a const map locks consumers into the literal
 * `Record<StoreId, StoreConfig>` shape. Function-based access lets the
 * registry add behaviour later (e.g. "exclude archived stores from
 * listStores in production builds") without touching consumers.
 *
 * # M3 disclaimer
 *
 * No caller invokes either function yet. They exist so M4+ can wire
 * the pipeline / publisher / Studio against a stable lookup contract.
 */

const REGISTRY: Record<string, StoreConfig> = {
  [fanaaStore.id]: fanaaStore,
  // Future stores land here. Adding a new entry is the entire registration
  // path — no other file in the platform needs to know.
};

/**
 * Resolve a store by ID. Returns `undefined` when the ID isn't registered
 * so callers can degrade gracefully (e.g. Studio store-switcher omits
 * unknown IDs rather than throwing).
 */
export function getStore(id: StoreId): StoreConfig | undefined {
  return REGISTRY[id];
}

/**
 * List every registered store. Order is insertion order
 * (`Object.values` over the literal map).
 *
 * Studio store-switcher consumers may want to filter by `status === "live"`
 * before rendering — the registry intentionally returns every entry so
 * incubating stores remain discoverable from operational tooling.
 */
export function listStores(): StoreConfig[] {
  return Object.values(REGISTRY);
}
