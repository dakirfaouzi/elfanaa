/**
 * @platform/storage — public surface.
 *
 * Consumers import:
 *   • Types + the `MediaStore` interface from the package root.
 *   • Adapters from `@platform/storage/adapters`.
 *   • Key helpers from `@platform/storage/keys`.
 *   • Zod schemas from `@platform/storage/schemas`.
 */
export type {
  AssetRef,
  AssetSource,
  MediaObjectMetadata,
  MediaStore,
  PresignDownloadOptions,
  PresignUploadOptions,
  PresignedDownload,
  PresignedUpload,
  StorageErrorKind,
} from "./contracts";
export { StorageError } from "./contracts";

export {
  MemoryMediaStore,
  R2MediaStore,
  type R2MediaStoreOptions,
} from "./adapters";

export {
  ALLOWED_CONTENT_TYPES,
  extForContentType,
  keyForUpload,
  parseKey,
  ulid,
  type ParsedKey,
} from "./keys";

export {
  AssetLifecycleStateSchema,
  AssetManifestSchema,
  AssetUploadIntentSchema,
  PresignedUploadResponseSchema,
  type AssetLifecycleState,
  type AssetManifest,
  type AssetUploadIntent,
  type PresignedUploadResponse,
} from "./schemas";
