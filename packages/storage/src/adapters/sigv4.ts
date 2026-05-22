import { createHash, createHmac } from "node:crypto";

/**
 * AWS Signature Version 4 — minimal implementation for S3 / R2.
 *
 * # Why hand-rolled
 *
 * `@aws-sdk/client-s3` pulls in 30+ packages totalling ~50 MB on disk
 * just to sign a PUT. For Studio + the worker we only need:
 *
 *   • Presigned URLs (query-string SigV4) for browser uploads/downloads.
 *   • Signed HEAD / PUT / DELETE requests for server-side ops.
 *
 * The full SigV4 algorithm is well-specified, stable since 2014, and
 * sits in ~150 lines of dependency-free Node `crypto` code. That makes
 * the security-critical surface trivially auditable in one file.
 *
 * # What this implements
 *
 * Per AWS docs at
 * https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html :
 *
 *   1. Canonical request    → SHA256 hash.
 *   2. String-to-sign        → "AWS4-HMAC-SHA256\n…canonicalRequestHash".
 *   3. Derived signing key   → chained HMACs over (kSecret, date,
 *                              region, service, "aws4_request").
 *   4. Signature             → hex HMAC-SHA256 of step 2 with step 3.
 *
 * # R2-specific notes
 *
 *   • Region is always "auto".
 *   • Service is always "s3".
 *   • Endpoint hostname is `<accountId>.r2.cloudflarestorage.com`.
 *   • Path-style URLs only (R2 does not support virtual-hosted-style).
 */

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional session token (STS). Stored as `x-amz-security-token`. */
  sessionToken?: string;
}

export interface SigV4SignRequest {
  method: "GET" | "HEAD" | "PUT" | "DELETE" | "POST";
  /** Full URL including bucket+key path. Must be path-style for R2. */
  url: URL;
  /** Additional headers to sign (e.g. content-type for PUT). Hostname
   *  + x-amz-date are always added. */
  headers?: Record<string, string>;
  /** Hex-encoded SHA-256 of the request body. Use `UNSIGNED-PAYLOAD`
   *  when the body is unknown at signing time (browser PUT). */
  payloadHash: string;
  /** Wall-clock signing time. Injectable for tests. */
  signingDate?: Date;
}

export interface PresignRequest {
  method: "GET" | "PUT";
  url: URL;
  /** Headers to bake into the signature (content-type for PUT, etc).
   *  These MUST be sent verbatim by the client. */
  signedHeaders?: Record<string, string>;
  /** Seconds the URL stays valid. SigV4 caps at 7 days = 604800. */
  expiresInSec: number;
  /** Payload SHA — usually UNSIGNED-PAYLOAD for browser uploads. */
  payloadHash?: string;
  /** Injectable for tests. */
  signingDate?: Date;
}

const SERVICE = "s3";
const ALG = "AWS4-HMAC-SHA256";
const UNSIGNED = "UNSIGNED-PAYLOAD";

/**
 * Mint a presigned URL with the signature embedded in the query
 * string. Suitable for browser PUTs / time-bounded downloads.
 *
 * Returns the full URL + the headers the client MUST send verbatim.
 */
export function presign(
  creds: SigV4Credentials,
  region: string,
  req: PresignRequest,
): { url: string; signedHeaders: Record<string, string>; expiresAt: string } {
  if (req.expiresInSec < 1 || req.expiresInSec > 7 * 24 * 60 * 60) {
    throw new Error(`sigv4_expiresInSec_out_of_range:${req.expiresInSec}`);
  }
  const now = req.signingDate ?? new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const credential = `${creds.accessKeyId}/${credentialScope}`;

  // Headers signed for presigned URLs typically include only `host`
  // (and the optional payload SHA via header when not UNSIGNED).
  const signedHeaderMap: Record<string, string> = {
    host: req.url.host,
    ...lowerCaseHeaders(req.signedHeaders ?? {}),
  };
  const signedHeaderList = Object.keys(signedHeaderMap).sort();
  const signedHeadersValue = signedHeaderList.join(";");

  // Build the query parameters and add the SigV4-required ones in
  // alphabetical order (canonical request requires sorted keys).
  const params = new URLSearchParams(req.url.searchParams);
  params.set("X-Amz-Algorithm", ALG);
  params.set("X-Amz-Credential", credential);
  params.set("X-Amz-Date", amzDate);
  params.set("X-Amz-Expires", String(req.expiresInSec));
  params.set("X-Amz-SignedHeaders", signedHeadersValue);
  if (creds.sessionToken) {
    params.set("X-Amz-Security-Token", creds.sessionToken);
  }
  // Sort all query params alphabetically for canonical request.
  const sortedParams = [...params.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );

  const canonicalQuery = sortedParams
    .map(
      ([k, v]) =>
        `${rfc3986Encode(k)}=${rfc3986Encode(v)}`,
    )
    .join("&");
  const canonicalUri = canonicalUriFromPath(req.url.pathname);
  const canonicalHeaders =
    signedHeaderList
      .map(
        (h) =>
          `${h}:${signedHeaderMap[h]!.trim().replace(/\s+/g, " ")}`,
      )
      .join("\n") + "\n";
  const payloadHash = req.payloadHash ?? UNSIGNED;

  const canonicalRequest = [
    req.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeadersValue,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    ALG,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveSigningKey(
    creds.secretAccessKey,
    dateStamp,
    region,
    SERVICE,
  );
  const signature = hmacSha256Hex(signingKey, stringToSign);

  const finalUrl = new URL(req.url.toString());
  finalUrl.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;

  return {
    url: finalUrl.toString(),
    signedHeaders: req.signedHeaders ?? {},
    expiresAt: new Date(now.getTime() + req.expiresInSec * 1000).toISOString(),
  };
}

/**
 * Sign request headers for a direct (non-presigned) server-side call.
 * Returns the full Headers object to include in the fetch() call.
 *
 * Used for HEAD / PUT (server-side bytes) / DELETE from the worker.
 */
export function signHeaders(
  creds: SigV4Credentials,
  region: string,
  req: SigV4SignRequest,
): Record<string, string> {
  const now = req.signingDate ?? new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const payloadHash = req.payloadHash;

  const signedHeaders: Record<string, string> = {
    host: req.url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...lowerCaseHeaders(req.headers ?? {}),
  };
  if (creds.sessionToken) {
    signedHeaders["x-amz-security-token"] = creds.sessionToken;
  }
  const signedHeaderList = Object.keys(signedHeaders).sort();
  const signedHeadersValue = signedHeaderList.join(";");

  const params = req.url.searchParams;
  const sortedParams = [...params.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const canonicalQuery = sortedParams
    .map(([k, v]) => `${rfc3986Encode(k)}=${rfc3986Encode(v)}`)
    .join("&");
  const canonicalUri = canonicalUriFromPath(req.url.pathname);
  const canonicalHeaders =
    signedHeaderList
      .map(
        (h) =>
          `${h}:${signedHeaders[h]!.trim().replace(/\s+/g, " ")}`,
      )
      .join("\n") + "\n";

  const canonicalRequest = [
    req.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeadersValue,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    ALG,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveSigningKey(
    creds.secretAccessKey,
    dateStamp,
    region,
    SERVICE,
  );
  const signature = hmacSha256Hex(signingKey, stringToSign);

  return {
    ...signedHeaders,
    Authorization: `${ALG} Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersValue}, Signature=${signature}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

function formatAmzDate(d: Date): string {
  // YYYYMMDD'T'HHmmss'Z' — no separators, UTC. Spec §6.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function lowerCaseHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function hmacSha256Hex(key: Buffer | string, data: string): string {
  return createHmac("sha256", key).update(data, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function deriveSigningKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSha256(`AWS4${secret}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

/**
 * Canonical URI per SigV4 spec: each path segment URL-encoded EXCEPT
 * the slash separators. Empty path → "/".
 */
function canonicalUriFromPath(path: string): string {
  if (!path || path === "/") return "/";
  return path
    .split("/")
    .map((seg) => rfc3986Encode(decodeSegment(seg)))
    .join("/");
}

function decodeSegment(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/**
 * RFC 3986 encoding — encodeURIComponent + extra escapes for `!`,
 * `*`, `'`, `(`, `)` per the spec. AWS uses this for both query
 * parameters and canonical URIs.
 */
function rfc3986Encode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
