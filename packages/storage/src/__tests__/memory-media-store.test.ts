import { describe, expect, it, beforeEach } from "vitest";
import { MemoryMediaStore } from "../adapters/memory-media-store";
import { StorageError } from "../contracts";

/**
 * Contract tests for MemoryMediaStore. Every public method of the
 * MediaStore interface is exercised.
 *
 * The same suite shape will be re-run against R2MediaStore (with a
 * stubbed S3 client) to verify the two implementations agree on
 * semantics.
 */
describe("MemoryMediaStore", () => {
  let store: MemoryMediaStore;
  const fixedNow = new Date("2026-05-22T10:00:00.000Z");

  beforeEach(() => {
    store = new MemoryMediaStore({ nowFn: () => fixedNow });
  });

  it("presignUpload returns a URL, expiresAt and a zero-byte AssetRef", async () => {
    const up = await store.presignUpload({
      bucket: "fanaa-assets",
      key: "studio/d/upload/abc.png",
      contentType: "image/png",
    });
    expect(up.method).toBe("PUT");
    expect(up.url).toContain("fanaa-assets");
    expect(up.url).toContain("studio/d/upload/abc.png");
    expect(up.headers["content-type"]).toBe("image/png");
    expect(up.ref).toEqual({
      bucket: "fanaa-assets",
      key: "studio/d/upload/abc.png",
      contentType: "image/png",
      bytes: 0,
    });
  });

  it("presignUpload applies the default 10-minute TTL", async () => {
    const up = await store.presignUpload({
      bucket: "b",
      key: "k",
      contentType: "image/png",
    });
    const expected = new Date(fixedNow.getTime() + 600 * 1000).toISOString();
    expect(up.expiresAt).toBe(expected);
  });

  it("presignDownload applies the default 5-minute TTL", async () => {
    const dl = await store.presignDownload({ bucket: "b", key: "k" });
    const expected = new Date(fixedNow.getTime() + 300 * 1000).toISOString();
    expect(dl.expiresAt).toBe(expected);
  });

  it("putBytes + head + exists + delete round-trip", async () => {
    const body = new Uint8Array([1, 2, 3, 4]);
    const ref = await store.putBytes({
      bucket: "b",
      key: "k",
      contentType: "image/png",
      body,
    });
    expect(ref.bytes).toBe(4);

    await expect(store.exists("b", "k")).resolves.toBe(true);
    const meta = await store.head("b", "k");
    expect(meta).toEqual({
      contentType: "image/png",
      bytes: 4,
      lastModified: fixedNow.toISOString(),
    });

    await store.delete("b", "k");
    await expect(store.exists("b", "k")).resolves.toBe(false);
  });

  it("head throws StorageError(not_found) when the key is absent", async () => {
    await expect(store.head("b", "missing")).rejects.toBeInstanceOf(StorageError);
    try {
      await store.head("b", "missing");
    } catch (err) {
      expect((err as StorageError).kind).toBe("not_found");
    }
  });

  it("exists returns false for missing keys without throwing", async () => {
    await expect(store.exists("b", "missing")).resolves.toBe(false);
  });

  it("publicUrl composes with the supplied CDN base URL", () => {
    expect(
      store.publicUrl({
        bucket: "fanaa-assets",
        key: "studio/d/upload/abc.png",
        publicBaseUrl: "https://cdn.elfanaa.com",
      }),
    ).toBe("https://cdn.elfanaa.com/studio/d/upload/abc.png");
  });

  it("publicUrl strips trailing slashes on the base", () => {
    expect(
      store.publicUrl({
        bucket: "b",
        key: "k",
        publicBaseUrl: "https://cdn.example.com/",
      }),
    ).toBe("https://cdn.example.com/k");
  });

  it("publicUrl falls back to the local sentinel when no CDN base supplied", () => {
    const url = store.publicUrl({ bucket: "b", key: "k" });
    expect(url.startsWith("memory://")).toBe(true);
    expect(url).toContain("/b/k");
  });

  it("seed/keys/size test helpers reflect the live store", () => {
    expect(store.size()).toBe(0);
    store.seed("b", "k", { contentType: "image/png", body: new Uint8Array([5]) });
    expect(store.size()).toBe(1);
    expect(store.keys()).toEqual(["b/k"]);
  });
});
