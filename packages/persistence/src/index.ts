/**
 * @platform/persistence — public surface.
 *
 * Two layers:
 *
 *   1. `PrismaRunStore` + `CompositeRunStore` — implementations of
 *      the M6 `RunStore` contract. Worker + Studio talk to these.
 *   2. `Studio*Repository` — typed reads/writes for the Studio UI.
 *
 * All operations are Promise-based, no I/O at import time.
 */
export { PrismaRunStore } from "./prisma-run-store";
export { CompositeRunStore } from "./composite-run-store";
export type { CompositeRunStoreOptions } from "./composite-run-store";

export {
  PersistenceError,
  type AssetSeed,
  type DraftSeed,
  type EventSeed,
  type PersistenceErrorKind,
  type PrismaLike,
  type PrismaModelDelegate,
  type PrismaRunStoreOptions,
  type StudioArtifactRow,
  type StudioAssetRow,
  type StudioAssetSourceValue,
  type StudioDraftRow,
  type StudioDraftStatusValue,
  type StudioEventRow,
  type StudioPublishedProductRow,
  type StudioRunRow,
  type StudioRunStatusValue,
  type StudioStepRow,
  type StudioStepStatusValue,
  type StudioStoreRow,
  type StudioStoreStatusValue,
} from "./contracts";

export {
  centsToUsd,
  runRecordToCreateInput,
  runRowToRecord,
  runStatusFromPrisma,
  runStatusToPrisma,
  stepRecordToCreateInput,
  stepRowToRecord,
  stepStatusFromPrisma,
  stepStatusToPrisma,
  usdToCents,
} from "./mappers";

export {
  StudioAssetRepository,
  StudioDraftRepository,
  StudioEventRepository,
  StudioPublishedProductRepository,
  StudioRunRepository,
  StudioStoreRepository,
} from "./repositories";
