/**
 * Store registry — one entry per store.
 *
 * Future stores get a sibling file (`./trendora.ts`) + a line here.
 * Nothing else changes; the registry's `getStore(id)` lookup
 * dispatches automatically.
 */
export { fanaaStore } from "./fanaa";
