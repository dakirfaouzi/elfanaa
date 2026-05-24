/**
 * @platform/ingest/metadata — barrel.
 *
 * Structured intake metadata schemas. Imported by `IngestJob` as a
 * single optional namespace field (`intakeMetadata`) so the
 * canonical contract grows by exactly ONE optional field regardless
 * of how many intake features ship.
 *
 * See `./intake-metadata.ts` for the full design rationale.
 *
 * # Subpath usage
 *
 *   import { IntakeMetadataSchema } from "@platform/ingest/metadata";
 */
export type { IntakeMetadata } from "./intake-metadata";
export { IntakeMetadataSchema } from "./intake-metadata";
