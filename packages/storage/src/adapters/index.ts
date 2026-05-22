/**
 * @platform/storage/adapters — barrel.
 *
 * Two adapters ship:
 *
 *   • `MemoryMediaStore`  — in-process, tests + local dev. Implements
 *     the full MediaStore contract using a `Map<string, Uint8Array>`.
 *   • `R2MediaStore`      — production. Cloudflare R2 via
 *     @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner.
 *
 * Future adapters (S3, GCS, B2) drop in here.
 */
export { MemoryMediaStore } from "./memory-media-store";
export type { MemoryObject } from "./memory-media-store";
export { R2MediaStore } from "./r2-media-store";
export type { R2MediaStoreOptions } from "./r2-media-store";
