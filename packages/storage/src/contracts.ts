/**
 * MediaStore — the binary-asset persistence contract.
 *
 * # Why an abstraction
 *
 * PLATFORM.md §14 names Cloudflare R2 as the production backend, but
 * the test surface (and any future migration to S3 / GCS / local-disk
 * dev mode) must not require live R2 credentials. Studio routes + the
 * worker resolve a `MediaStore` instance from the persistence factory;
 * test code injects the in-memory adapter; production code injects the
 * R2 adapter behind the same interface.
 *
 * # What this contract owns
 *
 *   • Minting presigned PUT URLs so browsers upload directly to R2
 *     (PLATFORM.md §14: "Browser → presigned PUT, no bytes through
 *     Studio server").
 *   • Minting presigned GET URLs for time-bounded download (used by
 *     the asset browser when a private bucket needs Studio-mediated
 *     download links).
 *   • Recording asset metadata in `AssetRef` so callers can persist a
 *     `StudioAsset` row WITHOUT needing the binary bytes.
 *   • Confirming an upload completed (HEAD-style probe) so the
 *     persistence layer can stamp `studio_asset.created_at` only
 *     once the bytes are actually in R2.
 *
 * # What this contract does NOT own
 *
 *   • Database persistence — that belongs to `@platform/persistence`.
 *     A real upload flow is: presign → browser PUT → Studio confirms →
 *     `StudioAssetRepository.create()`. The MediaStore knows nothing
 *     about Postgres.
 *   • CDN URL resolution for public reads — callers compose the public
 *     URL from `storeConfig.r2PublicBaseUrl + assetRef.key`. The
 *     MediaStore only mints PRESIGNED URLs (private/time-bounded).
 *   • Image resizing / Sharp pipelines — that lives in the worker's
 *     image_post stage and writes derived assets back through the
 *     MediaStore.
 */

/** Logical asset reference. Persisted to `studio_asset` rows. */
export interface AssetRef {
  /** Store-scoped bucket (e.g. `fanaa-assets`). */
  bucket: string;
  /** Object key inside the bucket. PLATFORM.md §14 pattern:
   *  `studio/<draftId>/<source>/<ulid>.<ext>`. */
  key: string;
  contentType: string;
  /** Decoded byte length when known. May be 0 when only a presigned
   *  PUT URL has been minted but the upload has not yet completed. */
  bytes: number;
  /** Optional pixel dimensions for image assets — populated by the
   *  worker's image_post stage after Sharp probes the binary. */
  width?: number;
  height?: number;
}

/** Source kind for naming + database enum mirroring. */
export type AssetSource = "upload" | "scraped" | "generated";

/** Presigned URL bundle returned by `presignUpload()`. */
export interface PresignedUpload {
  /** The PUT URL the browser sends bytes to. */
  url: string;
  /** Headers the browser MUST include verbatim — content-type at
   *  minimum, possibly x-amz-content-sha256 depending on the signer
   *  preset. Studio's intake page mirrors these into the fetch(). */
  headers: Record<string, string>;
  /** HTTP method to use. R2/S3 = "PUT". */
  method: "PUT";
  /** Wall-clock expiry timestamp (ISO-8601). After this the URL is
   *  rejected by R2. Browsers MUST retry from `presignUpload()` if
   *  the user dawdles. */
  expiresAt: string;
  /** The eventual `AssetRef` once the upload completes — returned
   *  here so Studio can persist the row optimistically. */
  ref: AssetRef;
}

/** Presigned URL bundle returned by `presignDownload()`. */
export interface PresignedDownload {
  url: string;
  expiresAt: string;
}

export interface PresignUploadOptions {
  bucket: string;
  key: string;
  contentType: string;
  /** Max byte length the signer will allow (S3/R2 enforces it via
   *  the signed `Content-Length` header range). Defaults to 25 MiB. */
  maxBytes?: number;
  /** TTL in seconds. Default 600 (10 min). */
  expiresInSec?: number;
}

export interface PresignDownloadOptions {
  bucket: string;
  key: string;
  /** TTL in seconds. Default 300 (5 min) for tight blast radius. */
  expiresInSec?: number;
}

export interface MediaObjectMetadata {
  contentType: string;
  bytes: number;
  /** ISO-8601 from the storage backend's last-modified header. */
  lastModified?: string;
}

/**
 * Storage errors carry a stable `kind` so callers can branch without
 * string-matching on a vendor SDK's exception class hierarchy.
 *
 *   • `not_found`      — the key doesn't exist (HEAD returned 404).
 *   • `forbidden`      — signature mismatch / IAM block.
 *   • `invalid_input`  — caller-supplied bucket/key violates limits.
 *   • `network`        — TCP / DNS / TLS-level failure.
 *   • `unknown`        — anything else; original error in `cause`.
 */
export type StorageErrorKind =
  | "not_found"
  | "forbidden"
  | "invalid_input"
  | "network"
  | "unknown";

export class StorageError extends Error {
  override readonly name = "StorageError";
  readonly kind: StorageErrorKind;
  readonly bucket?: string;
  readonly key?: string;
  override readonly cause?: unknown;
  constructor(args: {
    kind: StorageErrorKind;
    message: string;
    bucket?: string;
    key?: string;
    cause?: unknown;
  }) {
    super(args.message);
    this.kind = args.kind;
    this.bucket = args.bucket;
    this.key = args.key;
    this.cause = args.cause;
  }
}

/**
 * The full MediaStore contract.
 *
 * Implementations: `R2MediaStore` (production), `MemoryMediaStore`
 * (tests, dev). Both are exported from `@platform/storage/adapters`.
 */
export interface MediaStore {
  /** Mint a time-bounded PUT URL for a browser upload. */
  presignUpload(opts: PresignUploadOptions): Promise<PresignedUpload>;
  /** Mint a time-bounded GET URL for a Studio-mediated download. */
  presignDownload(opts: PresignDownloadOptions): Promise<PresignedDownload>;
  /** Probe whether an object exists. Used by `confirmUpload()` and the
   *  asset browser's verify-before-list pass. */
  exists(bucket: string, key: string): Promise<boolean>;
  /** HEAD-equivalent: returns metadata when present, throws
   *  `StorageError({kind:"not_found"})` when absent. */
  head(bucket: string, key: string): Promise<MediaObjectMetadata>;
  /** Persist a small binary directly (server-side). Used by the
   *  worker for generated images that never round-trip a browser. */
  putBytes(opts: {
    bucket: string;
    key: string;
    contentType: string;
    body: Uint8Array;
  }): Promise<AssetRef>;
  /** Delete a key. Used by lifecycle cleanup; the storefront never
   *  calls this. */
  delete(bucket: string, key: string): Promise<void>;
  /** Compose a public URL from a `(bucket, key)` pair. Implementations
   *  use the store's CDN base URL when set; otherwise return a
   *  presigned GET URL. */
  publicUrl(args: {
    bucket: string;
    key: string;
    publicBaseUrl?: string;
  }): string;
}
