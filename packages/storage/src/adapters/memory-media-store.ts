import type {
  AssetRef,
  MediaObjectMetadata,
  MediaStore,
  PresignDownloadOptions,
  PresignUploadOptions,
  PresignedDownload,
  PresignedUpload,
} from "../contracts";
import { StorageError } from "../contracts";

/**
 * In-memory MediaStore. Used by tests + `STORAGE_DRIVER=memory` local
 * dev (no R2 credentials needed). Implements the full contract; the
 * "presigned" URLs are JSON-encoded sentinels that the test harness
 * recognises.
 *
 * # Why a real in-memory backend instead of stubs
 *
 *   • Lets the Studio + persistence layers run end-to-end without
 *     touching the network. The presigned URL flow + HEAD probe +
 *     publicUrl resolution all exercise the same code paths the
 *     production R2 adapter does.
 *   • Tests inject this adapter via dependency injection — there are
 *     no global module mocks. Fast, deterministic, no shared state
 *     across test files when constructed per-test.
 */
export interface MemoryObject {
  contentType: string;
  body: Uint8Array;
  lastModified: string;
}

export class MemoryMediaStore implements MediaStore {
  private readonly objects = new Map<string, MemoryObject>();
  private readonly nowFn: () => Date;

  /** When set, `presignUpload`/`presignDownload` emit URLs whose host
   *  matches this base. The asset list endpoint composes
   *  `publicUrl()` from `publicBaseUrl` when callers supply it. */
  private readonly localBase: string;

  constructor(opts: { nowFn?: () => Date; localBase?: string } = {}) {
    this.nowFn = opts.nowFn ?? (() => new Date());
    this.localBase = opts.localBase ?? "memory://media";
  }

  private composeKey(bucket: string, key: string): string {
    return `${bucket}/${key}`;
  }

  async presignUpload(opts: PresignUploadOptions): Promise<PresignedUpload> {
    const expiresAt = new Date(
      this.nowFn().getTime() + (opts.expiresInSec ?? 600) * 1000,
    ).toISOString();
    return {
      url: `${this.localBase}/${opts.bucket}/${opts.key}?signed=put&exp=${encodeURIComponent(expiresAt)}`,
      headers: { "content-type": opts.contentType },
      method: "PUT",
      expiresAt,
      ref: {
        bucket: opts.bucket,
        key: opts.key,
        contentType: opts.contentType,
        bytes: 0,
      },
    };
  }

  async presignDownload(
    opts: PresignDownloadOptions,
  ): Promise<PresignedDownload> {
    const expiresAt = new Date(
      this.nowFn().getTime() + (opts.expiresInSec ?? 300) * 1000,
    ).toISOString();
    return {
      url: `${this.localBase}/${opts.bucket}/${opts.key}?signed=get&exp=${encodeURIComponent(expiresAt)}`,
      expiresAt,
    };
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    return this.objects.has(this.composeKey(bucket, key));
  }

  async head(bucket: string, key: string): Promise<MediaObjectMetadata> {
    const composed = this.composeKey(bucket, key);
    const o = this.objects.get(composed);
    if (!o) {
      throw new StorageError({
        kind: "not_found",
        message: `object_not_found:${composed}`,
        bucket,
        key,
      });
    }
    return {
      contentType: o.contentType,
      bytes: o.body.byteLength,
      lastModified: o.lastModified,
    };
  }

  async putBytes(opts: {
    bucket: string;
    key: string;
    contentType: string;
    body: Uint8Array;
  }): Promise<AssetRef> {
    this.objects.set(this.composeKey(opts.bucket, opts.key), {
      contentType: opts.contentType,
      body: opts.body,
      lastModified: this.nowFn().toISOString(),
    });
    return {
      bucket: opts.bucket,
      key: opts.key,
      contentType: opts.contentType,
      bytes: opts.body.byteLength,
    };
  }

  async delete(bucket: string, key: string): Promise<void> {
    this.objects.delete(this.composeKey(bucket, key));
  }

  publicUrl(args: {
    bucket: string;
    key: string;
    publicBaseUrl?: string;
  }): string {
    if (args.publicBaseUrl && args.publicBaseUrl.trim() !== "") {
      const base = args.publicBaseUrl.replace(/\/$/, "");
      return `${base}/${args.key}`;
    }
    return `${this.localBase}/${args.bucket}/${args.key}`;
  }

  // ── test helpers ────────────────────────────────────────────────────
  /** Forcibly seed an object — bypasses presign flow. Tests only. */
  seed(bucket: string, key: string, o: Omit<MemoryObject, "lastModified">): void {
    this.objects.set(this.composeKey(bucket, key), {
      ...o,
      lastModified: this.nowFn().toISOString(),
    });
  }

  size(): number {
    return this.objects.size;
  }

  keys(): string[] {
    return [...this.objects.keys()];
  }
}
