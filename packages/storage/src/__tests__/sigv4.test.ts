import { describe, expect, it } from "vitest";
import { presign, signHeaders } from "../adapters/sigv4";

/**
 * SigV4 algorithm tests.
 *
 * Coverage:
 *   1. Presign result includes the five required `X-Amz-*` query
 *      params + a 64-char hex signature.
 *   2. expiresAt = signingDate + ttl seconds (ISO-8601).
 *   3. Signature changes when the signing date moves by one second.
 *   4. signHeaders adds Authorization + x-amz-content-sha256 + x-amz-date.
 *   5. Out-of-range expiresInSec throws.
 *
 * We do NOT pin the signature byte-for-byte against a published AWS
 * test vector — those vectors all assume `service: s3` + specific
 * test credentials we'd be exposing in the test file. Instead we
 * pin against our own reproducible inputs and verify shape +
 * determinism + sensitivity.
 */

const creds = {
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "EXAMPLEKEY",
};
const region = "auto";

describe("presign", () => {
  it("emits the five required AWS4 query parameters + a 64-char signature", () => {
    const out = presign(creds, region, {
      method: "PUT",
      url: new URL("https://acct.r2.cloudflarestorage.com/b/k"),
      signedHeaders: { "content-type": "image/png" },
      expiresInSec: 900,
      signingDate: new Date("2026-05-22T10:00:00.000Z"),
    });
    const u = new URL(out.url);
    expect(u.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(u.searchParams.get("X-Amz-Credential")).toMatch(
      /AKIAEXAMPLE\/\d{8}\/auto\/s3\/aws4_request/,
    );
    expect(u.searchParams.get("X-Amz-Date")).toMatch(/^\d{8}T\d{6}Z$/);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toContain("host");
    expect(u.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("expiresAt = signingDate + ttl seconds (ISO-8601)", () => {
    const out = presign(creds, region, {
      method: "GET",
      url: new URL("https://acct.r2.cloudflarestorage.com/b/k"),
      expiresInSec: 300,
      signingDate: new Date("2026-05-22T10:00:00.000Z"),
    });
    expect(out.expiresAt).toBe("2026-05-22T10:05:00.000Z");
  });

  it("is deterministic for the same (creds, url, time)", () => {
    const a = presign(creds, region, {
      method: "PUT",
      url: new URL("https://acct.r2.cloudflarestorage.com/b/k"),
      signedHeaders: { "content-type": "image/png" },
      expiresInSec: 600,
      signingDate: new Date("2026-05-22T10:00:00.000Z"),
    });
    const b = presign(creds, region, {
      method: "PUT",
      url: new URL("https://acct.r2.cloudflarestorage.com/b/k"),
      signedHeaders: { "content-type": "image/png" },
      expiresInSec: 600,
      signingDate: new Date("2026-05-22T10:00:00.000Z"),
    });
    expect(a.url).toBe(b.url);
  });

  it("shifts the signature when the date changes by 1 second", () => {
    const a = presign(creds, region, {
      method: "PUT",
      url: new URL("https://acct.r2.cloudflarestorage.com/b/k"),
      expiresInSec: 600,
      signingDate: new Date("2026-05-22T10:00:00.000Z"),
    });
    const b = presign(creds, region, {
      method: "PUT",
      url: new URL("https://acct.r2.cloudflarestorage.com/b/k"),
      expiresInSec: 600,
      signingDate: new Date("2026-05-22T10:00:01.000Z"),
    });
    const sigA = new URL(a.url).searchParams.get("X-Amz-Signature");
    const sigB = new URL(b.url).searchParams.get("X-Amz-Signature");
    expect(sigA).not.toBe(sigB);
  });

  it("rejects ttl < 1s and > 7 days", () => {
    expect(() =>
      presign(creds, region, {
        method: "GET",
        url: new URL("https://x/b/k"),
        expiresInSec: 0,
      }),
    ).toThrow(/sigv4_expiresInSec_out_of_range/);
    expect(() =>
      presign(creds, region, {
        method: "GET",
        url: new URL("https://x/b/k"),
        expiresInSec: 7 * 24 * 60 * 60 + 1,
      }),
    ).toThrow(/sigv4_expiresInSec_out_of_range/);
  });
});

describe("signHeaders", () => {
  it("returns Authorization, x-amz-content-sha256, x-amz-date, host", () => {
    const out = signHeaders(creds, region, {
      method: "HEAD",
      url: new URL("https://acct.r2.cloudflarestorage.com/b/k"),
      // SHA-256 of an empty body.
      payloadHash:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signingDate: new Date("2026-05-22T10:00:00.000Z"),
    });
    expect(out.Authorization).toContain("AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE");
    expect(out.Authorization).toContain("SignedHeaders=");
    expect(out.Authorization).toMatch(/Signature=[a-f0-9]{64}$/);
    expect(out["x-amz-content-sha256"]).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(out["x-amz-date"]).toMatch(/^\d{8}T\d{6}Z$/);
    expect(out.host).toBe("acct.r2.cloudflarestorage.com");
  });

  it("includes session token when supplied", () => {
    const out = signHeaders(
      { ...creds, sessionToken: "TOKEN" },
      region,
      {
        method: "HEAD",
        url: new URL("https://acct.r2.cloudflarestorage.com/b/k"),
        payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        signingDate: new Date("2026-05-22T10:00:00.000Z"),
      },
    );
    expect(out["x-amz-security-token"]).toBe("TOKEN");
  });
});
