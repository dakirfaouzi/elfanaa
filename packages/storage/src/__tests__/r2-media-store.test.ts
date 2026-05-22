import { describe, expect, it, vi } from "vitest";
import { R2MediaStore } from "../adapters/r2-media-store";
import { StorageError } from "../contracts";

/**
 * Tests for the R2 adapter.
 *
 * Strategy: inject a stub `fetchFn` that records every request and
 * returns scripted Responses. The SigV4 signer runs as-is so we
 * implicitly assert that the signed URL+headers actually reach the
 * fetch boundary in the right shape.
 *
 * What we verify:
 *   • presignUpload mints a signed PUT URL with the expected ttl,
 *     content-type header bound into the signature, and an AssetRef.
 *   • head/exists/putBytes/delete issue the correct HTTP method +
 *     path-style URL + AWS4-HMAC-SHA256 Authorization header.
 *   • Status-code branches map to the right StorageError.kind.
 *   • publicUrl honours `publicBaseUrl` and falls back to `r2://…`
 *     sentinel when none is provided.
 */

interface StubCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: BodyInit | null | undefined;
}

function makeStub(scripted: Response[] = [new Response(null, { status: 200 })]) {
  const calls: StubCall[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers: Record<string, string> = {};
    const h = init?.headers ?? {};
    if (h instanceof Headers) {
      h.forEach((v, k) => {
        headers[k] = v;
      });
    } else if (Array.isArray(h)) {
      for (const [k, v] of h) headers[k] = v;
    } else {
      for (const [k, v] of Object.entries(h as Record<string, string>)) {
        headers[k] = v;
      }
    }
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers,
      body: init?.body ?? null,
    });
    const next = scripted.shift() ?? new Response(null, { status: 200 });
    return next;
  });
  return { calls, fetchFn };
}

function makeStore(stub: ReturnType<typeof makeStub>) {
  return new R2MediaStore({
    accountId: "acct",
    accessKeyId: "AKID",
    secretAccessKey: "SECRET",
    fetchFn: stub.fetchFn as unknown as typeof fetch,
    nowFn: () => new Date("2026-05-22T10:00:00.000Z"),
  });
}

describe("R2MediaStore — construction", () => {
  it("rejects missing credentials at construction time", () => {
    expect(
      () =>
        new R2MediaStore({
          accountId: "",
          accessKeyId: "id",
          secretAccessKey: "sec",
        }),
    ).toThrow(/r2_missing_accountId/);
    expect(
      () =>
        new R2MediaStore({
          accountId: "acct",
          accessKeyId: "",
          secretAccessKey: "sec",
        }),
    ).toThrow(/r2_missing_accessKeyId/);
    expect(
      () =>
        new R2MediaStore({
          accountId: "acct",
          accessKeyId: "id",
          secretAccessKey: "",
        }),
    ).toThrow(/r2_missing_secretAccessKey/);
  });
});

describe("R2MediaStore — presigned URLs", () => {
  it("presignUpload mints a path-style URL with AWS4 query params", async () => {
    const stub = makeStub();
    const store = makeStore(stub);
    const up = await store.presignUpload({
      bucket: "fanaa-assets",
      key: "studio/d/upload/k.png",
      contentType: "image/png",
      expiresInSec: 900,
    });
    expect(up.method).toBe("PUT");
    expect(up.headers["content-type"]).toBe("image/png");
    const u = new URL(up.url);
    expect(u.hostname).toBe("acct.r2.cloudflarestorage.com");
    expect(u.pathname).toBe("/fanaa-assets/studio/d/upload/k.png");
    expect(u.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(u.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(u.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(up.ref).toEqual({
      bucket: "fanaa-assets",
      key: "studio/d/upload/k.png",
      contentType: "image/png",
      bytes: 0,
    });
  });

  it("presignUpload computes expiresAt = now + ttl", async () => {
    const stub = makeStub();
    const store = makeStore(stub);
    const up = await store.presignUpload({
      bucket: "b",
      key: "k",
      contentType: "image/png",
      expiresInSec: 600,
    });
    expect(up.expiresAt).toBe("2026-05-22T10:10:00.000Z");
  });

  it("presignDownload mints a signed GET URL", async () => {
    const stub = makeStub();
    const store = makeStore(stub);
    const dl = await store.presignDownload({ bucket: "b", key: "k" });
    expect(dl.url).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(dl.expiresAt).toBe("2026-05-22T10:05:00.000Z");
  });

  it("rejects an out-of-range ttl", async () => {
    const stub = makeStub();
    const store = makeStore(stub);
    await expect(
      store.presignUpload({
        bucket: "b",
        key: "k",
        contentType: "image/png",
        expiresInSec: 0,
      }),
    ).rejects.toThrow(/sigv4_expiresInSec_out_of_range/);
  });
});

describe("R2MediaStore — server-side calls", () => {
  it("head sends HEAD with AWS4 Authorization, returns parsed metadata", async () => {
    const stub = makeStub([
      new Response(null, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": "1234",
          "last-modified": "Fri, 22 May 2026 10:00:00 GMT",
        },
      }),
    ]);
    const store = makeStore(stub);
    const meta = await store.head("fanaa-assets", "studio/d/upload/k.png");
    expect(meta).toEqual({
      contentType: "image/png",
      bytes: 1234,
      lastModified: "Fri, 22 May 2026 10:00:00 GMT",
    });
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]!.method).toBe("HEAD");
    expect(stub.calls[0]!.url).toBe(
      "https://acct.r2.cloudflarestorage.com/fanaa-assets/studio/d/upload/k.png",
    );
    // Header name may be either "Authorization" (object literal) or
    // "authorization" (Headers instance) depending on how fetch
    // normalises. Accept either.
    const auth =
      stub.calls[0]!.headers["Authorization"] ??
      stub.calls[0]!.headers["authorization"];
    expect(auth).toContain("AWS4-HMAC-SHA256");
    expect(stub.calls[0]!.headers["x-amz-content-sha256"]).toBe(
      // SHA-256("") canonical hex.
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("exists returns true on 200, false on 404", async () => {
    const ok = makeStub([new Response(null, { status: 200 })]);
    const okStore = makeStore(ok);
    await expect(okStore.exists("b", "k")).resolves.toBe(true);

    const missing = makeStub([new Response(null, { status: 404 })]);
    const missingStore = makeStore(missing);
    await expect(missingStore.exists("b", "k")).resolves.toBe(false);
  });

  it("putBytes signs the body with the correct payload hash", async () => {
    const stub = makeStub([new Response(null, { status: 200 })]);
    const store = makeStore(stub);
    const body = new Uint8Array([1, 2, 3, 4]);
    const ref = await store.putBytes({
      bucket: "b",
      key: "k",
      contentType: "image/png",
      body,
    });
    expect(ref.bytes).toBe(4);
    expect(stub.calls[0]!.method).toBe("PUT");
    expect(stub.calls[0]!.headers["x-amz-content-sha256"]).toBe(
      // SHA-256 of [1,2,3,4] (8-bit unsigned) — pre-computed.
      "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
    );
    expect(stub.calls[0]!.headers["content-type"]).toBe("image/png");
  });

  it("delete treats 404 as success", async () => {
    const stub = makeStub([new Response(null, { status: 404 })]);
    const store = makeStore(stub);
    await expect(store.delete("b", "k")).resolves.toBeUndefined();
  });
});

describe("R2MediaStore — error mapping", () => {
  it("403 → StorageError{forbidden}", async () => {
    const stub = makeStub([new Response(null, { status: 403 })]);
    const store = makeStore(stub);
    try {
      await store.head("b", "k");
      expect.fail("expected head to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(StorageError);
      expect((err as StorageError).kind).toBe("forbidden");
    }
  });

  it("400 → StorageError{invalid_input}", async () => {
    const stub = makeStub([new Response(null, { status: 400 })]);
    const store = makeStore(stub);
    try {
      await store.head("b", "k");
      expect.fail("expected head to throw");
    } catch (err) {
      expect((err as StorageError).kind).toBe("invalid_input");
    }
  });

  it("500 → StorageError{unknown}", async () => {
    const stub = makeStub([new Response(null, { status: 500 })]);
    const store = makeStore(stub);
    try {
      await store.head("b", "k");
      expect.fail("expected head to throw");
    } catch (err) {
      expect((err as StorageError).kind).toBe("unknown");
    }
  });
});

describe("R2MediaStore — publicUrl", () => {
  it("composes against a CDN base", () => {
    const stub = makeStub();
    const store = makeStore(stub);
    expect(
      store.publicUrl({
        bucket: "fanaa-assets",
        key: "studio/d/upload/abc.png",
        publicBaseUrl: "https://cdn.elfanaa.com",
      }),
    ).toBe("https://cdn.elfanaa.com/studio/d/upload/abc.png");
  });

  it("emits an r2:// sentinel without a CDN base", () => {
    const stub = makeStub();
    const store = makeStore(stub);
    expect(store.publicUrl({ bucket: "fanaa-assets", key: "k" })).toBe(
      "r2://fanaa-assets/k",
    );
  });
});
