/**
 * Deterministic key naming for media assets (PLATFORM.md §14).
 *
 *   studio/<draftId>/<source>/<ulid>.<ext>
 *
 *   • `studio/` prefix → easy lifecycle rule scoping (R2 supports
 *     prefix-based lifecycle policies).
 *   • `<draftId>/`     → groups assets per draft so `LIST` calls
 *     return everything for an asset-browser sidebar in one round-trip.
 *   • `<source>/`      → one of `upload | scraped | generated`.
 *     Mirrors `studio_asset.source`. Makes IAM policies trivial
 *     (e.g. "Studio JWT can only write to `upload/`").
 *   • `<ulid>`         → monotonic, sortable, URL-safe. ULIDs sort
 *     chronologically so the asset browser's default ordering is
 *     "newest first" without an explicit timestamp index.
 *   • `<ext>`          → from content-type via a static allow-list.
 *
 * # Why ULID and not UUID
 *
 * ULIDs (Universally Unique Lexicographically Sortable Identifier)
 * embed a 48-bit timestamp prefix, so listing a bucket by key order
 * yields chronological order. UUIDv4 needs an extra `created_at`
 * column to sort by; ULIDs collapse that to a single string.
 *
 * # Why not import a `ulid` package
 *
 * Avoid a 4kB dep for a 26-char string. The implementation below is
 * spec-compliant (Crockford base-32, 48-bit time + 80-bit random) and
 * audited inline. Uses Node's built-in `crypto.randomBytes` so it
 * never blocks on entropy.
 */
import { randomBytes } from "node:crypto";
import type { AssetSource } from "./contracts";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_TIME_LEN = 10;
const ULID_RAND_LEN = 16;

/**
 * Mint a fresh ULID. 26 ASCII chars, URL-safe, monotonic to ms.
 *
 * Tests inject `nowMs` and `randomFn` for byte-stable assertions.
 */
export function ulid(opts: {
  nowMs?: number;
  randomFn?: (bytes: number) => Uint8Array;
} = {}): string {
  const now = opts.nowMs ?? Date.now();
  const rand = opts.randomFn ?? ((n: number) => new Uint8Array(randomBytes(n)));
  return encodeTime(now) + encodeRandom(rand(ULID_RAND_LEN));
}

function encodeTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error(`ulid_invalid_time:${ms}`);
  }
  let n = ms;
  const out: string[] = [];
  for (let i = ULID_TIME_LEN - 1; i >= 0; i--) {
    const mod = n % 32;
    out[i] = CROCKFORD[mod];
    n = Math.floor(n / 32);
  }
  return out.join("");
}

function encodeRandom(bytes: Uint8Array): string {
  // Pack 10 bytes (80 bits) into 16 base-32 chars.
  // We supply 16 bytes and use the first 10 (truncate to spec length).
  const view = bytes.subarray(0, 10);
  let out = "";
  let buffer = 0;
  let bitsInBuffer = 0;
  for (let i = 0; i < view.length; i++) {
    buffer = (buffer << 8) | view[i]!;
    bitsInBuffer += 8;
    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5;
      const idx = (buffer >> bitsInBuffer) & 31;
      out += CROCKFORD[idx];
    }
  }
  if (bitsInBuffer > 0) {
    const idx = (buffer << (5 - bitsInBuffer)) & 31;
    out += CROCKFORD[idx];
  }
  return out.padEnd(ULID_RAND_LEN, "0").slice(0, ULID_RAND_LEN);
}

// ─────────────────────────────────────────────────────────────────────────
// Content-type → extension mapping
// ─────────────────────────────────────────────────────────────────────────

/**
 * Static allow-list of content types Studio accepts for uploads.
 * Anything outside this list is rejected at `keyForUpload()` time so a
 * malicious operator can't poison the R2 bucket with .exe / .sh / etc.
 *
 * Keep this conservative — generation outputs are PNG/JPEG/WebP only;
 * scrape outputs are images + occasional MP4 (for hero loops).
 */
export const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
};

export function extForContentType(contentType: string): string {
  const ext = ALLOWED_CONTENT_TYPES[contentType.toLowerCase().trim()];
  if (!ext) {
    throw new Error(`unsupported_content_type:${contentType}`);
  }
  return ext;
}

// ─────────────────────────────────────────────────────────────────────────
// Key construction
// ─────────────────────────────────────────────────────────────────────────

const DRAFT_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Compose a fresh upload key for a draft.
 *
 *   studio/<draftId>/<source>/<ulid>.<ext>
 *
 * Used by both the presign endpoint and the worker's image_gen stage.
 */
export function keyForUpload(opts: {
  draftId: string;
  source: AssetSource;
  contentType: string;
  /** Optional ULID override — supplied by tests for determinism. */
  ulidOverride?: string;
  /** Now-getter for ULID time component. Tests pin this. */
  nowMs?: number;
}): string {
  if (!DRAFT_ID_RE.test(opts.draftId)) {
    throw new Error(`invalid_draft_id:${opts.draftId}`);
  }
  const ext = extForContentType(opts.contentType);
  const id = opts.ulidOverride ?? ulid({ nowMs: opts.nowMs });
  return `studio/${opts.draftId}/${opts.source}/${id}.${ext}`;
}

/** Parse a key back into its components. Used by the asset browser. */
export interface ParsedKey {
  draftId: string;
  source: AssetSource;
  id: string;
  ext: string;
}

const KEY_RE = /^studio\/([a-zA-Z0-9_-]{1,64})\/(upload|scraped|generated)\/([A-Z0-9]{26})\.([a-z0-9]+)$/;

export function parseKey(key: string): ParsedKey | null {
  const match = KEY_RE.exec(key);
  if (!match) return null;
  return {
    draftId: match[1]!,
    source: match[2] as AssetSource,
    id: match[3]!,
    ext: match[4]!,
  };
}
