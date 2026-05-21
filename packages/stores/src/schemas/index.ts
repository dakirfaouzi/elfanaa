/**
 * Barrel — runtime validators for store-config contracts.
 *
 * Subpath import (`@platform/stores/schemas`) is preferred over re-exporting
 * from the package root: the root surface (`@platform/stores`) is pure
 * types-and-data and stays Zod-free for consumers who don't need
 * validation.
 */
export * from "./contracts";
