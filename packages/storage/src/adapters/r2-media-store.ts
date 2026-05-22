import { createHash } from "node:crypto";
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
import { presign, signHeaders, type SigV4Credentials } from "./sigv4";

/**
 * Cloudflare R2 MediaStore — production backend (PLATFORM.md §14).
 *
 * # Wire protocol
 *
 * R2 speaks S3 + SigV4. This adapter signs requests using the local
 * `sigv4.ts` implementation (dependency-free, ~150 LoC) and issues
 * them via Node 18+ built-in `fetch`. No `@aws-sdk/*` packages.
 *
 * # Endpoints
 *
 *   • Account endpoint: `https://<accountId>.r2.cloudflarestorage.com`
 *   • Path-style URL  : `/<bucket>/<key>` (virtual-host-style NOT
 *     supported by R2).
 *   • Region          : "auto"
 *   • Service         : "s3"
 *
 * # Test seam
 *
 * The constructor accepts a `fetchFn` override so tests inject a stub
 * that records the request URL + headers + body without doing any
 * network I/O. The same override is also used to fail-inject
 * status-code errors that exercise the StorageError mapper.
 */
export interface R2MediaStoreOptions {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional STS session token. */
  sessionToken?: string;
  /** Override the `fetch` implementation. Tests pass a stub. */
  fetchFn?: typeof fetch;
  /** Override the now-getter so signing is byte-stable in tests. */
  nowFn?: () => Date;
  /** Default expiry for presigned PUTs (seconds). */
  defaultUploadTtlSec?: number;
  /** Default expiry for presigned GETs (seconds). */
  defaultDownloadTtlSec?: number;
}

const REGION = "auto";

export class R2MediaStore implements MediaStore {
  private readonly creds: SigV4Credentials;
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;
  private readonly nowFn: () => Date;
  private readonly defaultUploadTtlSec: number;
  private readonly defaultDownloadTtlSec: number;

  constructor(opts: R2MediaStoreOptions) {
    if (!opts.accountId) throw new Error("r2_missing_accountId");
    if (!opts.accessKeyId) throw new Error("r2_missing_accessKeyId");
    if (!opts.secretAccessKey) throw new Error("r2_missing_secretAccessKey");
    this.creds = {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
      sessionToken: opts.sessionToken,
    };
    this.endpoint = `https://${opts.accountId}.r2.cloudflarestorage.com`;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.nowFn = opts.nowFn ?? (() => new Date());
    this.defaultUploadTtlSec = opts.defaultUploadTtlSec ?? 600;
    this.defaultDownloadTtlSec = opts.defaultDownloadTtlSec ?? 300;
  }

  private urlFor(bucket: string, key: string): URL {
    return new URL(
      `${this.endpoint}/${encodeURIComponent(bucket)}/${encodeKeyPath(key)}`,
    );
  }

  async presignUpload(opts: PresignUploadOptions): Promise<PresignedUpload> {
    const url = this.urlFor(opts.bucket, opts.key);
    const ttl = opts.expiresInSec ?? this.defaultUploadTtlSec;
    const signed = presign(this.creds, REGION, {
      method: "PUT",
      url,
      signedHeaders: { "content-type": opts.contentType },
      expiresInSec: ttl,
      signingDate: this.nowFn(),
    });
    return {
      url: signed.url,
      headers: { "content-type": opts.contentType },
      method: "PUT",
      expiresAt: signed.expiresAt,
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
    const url = this.urlFor(opts.bucket, opts.key);
    const ttl = opts.expiresInSec ?? this.defaultDownloadTtlSec;
    const signed = presign(this.creds, REGION, {
      method: "GET",
      url,
      expiresInSec: ttl,
      signingDate: this.nowFn(),
    });
    return { url: signed.url, expiresAt: signed.expiresAt };
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.head(bucket, key);
      return true;
    } catch (err) {
      if (err instanceof StorageError && err.kind === "not_found") return false;
      throw err;
    }
  }

  async head(bucket: string, key: string): Promise<MediaObjectMetadata> {
    const url = this.urlFor(bucket, key);
    // For HEAD there's no body — payload hash of empty string.
    const payloadHash = sha256Hex("");
    const headers = signHeaders(this.creds, REGION, {
      method: "HEAD",
      url,
      payloadHash,
      signingDate: this.nowFn(),
    });
    const res = await this.fetchFn(url, { method: "HEAD", headers });
    if (!res.ok) {
      throw mapHttpError(res.status, { bucket, key });
    }
    return {
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
      bytes: Number(res.headers.get("content-length") ?? 0),
      lastModified: res.headers.get("last-modified") ?? undefined,
    };
  }

  async putBytes(opts: {
    bucket: string;
    key: string;
    contentType: string;
    body: Uint8Array;
  }): Promise<AssetRef> {
    const url = this.urlFor(opts.bucket, opts.key);
    const payloadHash = sha256Hex(opts.body);
    const headers = signHeaders(this.creds, REGION, {
      method: "PUT",
      url,
      headers: {
        "content-type": opts.contentType,
        "content-length": String(opts.body.byteLength),
      },
      payloadHash,
      signingDate: this.nowFn(),
    });
    // Cast to BodyInit — Node's lib.dom.d.ts BodyInit narrows away
    // Uint8Array on some TS versions, but fetch() accepts it at runtime.
    const res = await this.fetchFn(url, {
      method: "PUT",
      headers,
      body: opts.body as unknown as BodyInit,
    });
    if (!res.ok) {
      throw mapHttpError(res.status, { bucket: opts.bucket, key: opts.key });
    }
    return {
      bucket: opts.bucket,
      key: opts.key,
      contentType: opts.contentType,
      bytes: opts.body.byteLength,
    };
  }

  async delete(bucket: string, key: string): Promise<void> {
    const url = this.urlFor(bucket, key);
    const payloadHash = sha256Hex("");
    const headers = signHeaders(this.creds, REGION, {
      method: "DELETE",
      url,
      payloadHash,
      signingDate: this.nowFn(),
    });
    const res = await this.fetchFn(url, { method: "DELETE", headers });
    // R2 returns 204 on delete success, even if the key did not exist
    // (S3-compatible behaviour). 404 is treated as success here too.
    if (!res.ok && res.status !== 404) {
      throw mapHttpError(res.status, { bucket, key });
    }
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
    // No public CDN base — callers should fetch via presignDownload().
    // The sentinel makes the lack-of-public-URL situation explicit.
    return `r2://${args.bucket}/${args.key}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function sha256Hex(input: string | Uint8Array): string {
  const h = createHash("sha256");
  if (typeof input === "string") {
    h.update(input, "utf8");
  } else {
    h.update(input);
  }
  return h.digest("hex");
}

/** Encode an S3 key as a URL path. Slashes between segments stay
 *  un-encoded; everything else is RFC 3986. */
function encodeKeyPath(key: string): string {
  return key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function mapHttpError(
  status: number,
  loc: { bucket: string; key: string },
): StorageError {
  if (status === 404) {
    return new StorageError({
      kind: "not_found",
      message: `r2_not_found:${loc.bucket}/${loc.key}`,
      bucket: loc.bucket,
      key: loc.key,
    });
  }
  if (status === 401 || status === 403) {
    return new StorageError({
      kind: "forbidden",
      message: `r2_forbidden:${loc.bucket}/${loc.key}`,
      bucket: loc.bucket,
      key: loc.key,
    });
  }
  if (status >= 400 && status < 500) {
    return new StorageError({
      kind: "invalid_input",
      message: `r2_invalid_input_status_${status}:${loc.bucket}/${loc.key}`,
      bucket: loc.bucket,
      key: loc.key,
    });
  }
  return new StorageError({
    kind: status === 0 ? "network" : "unknown",
    message: `r2_status_${status}:${loc.bucket}/${loc.key}`,
    bucket: loc.bucket,
    key: loc.key,
  });
}
