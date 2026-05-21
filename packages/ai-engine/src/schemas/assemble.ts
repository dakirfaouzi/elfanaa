/**
 * Re-export of the canonical `UniversalProductSchema` from
 * `@platform/catalog-schema/schemas`.
 *
 * The assemble stage (stage 12) does NOT define its own schema — it
 * targets the canonical UniversalProduct schema by design (PLATFORM.md
 * §11 stage 12 failure mode: "Validate against `UniversalProduct`
 * schema"). Re-exporting here keeps stage code reading from a co-located
 * file and decouples the consumer from the catalog-schema layout.
 */
export { UniversalProductSchema } from "@platform/catalog-schema/schemas";
