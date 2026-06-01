import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareDurableHeroUrl } from "../lib/studio/drafts-service";
import type { StudioPersistence } from "../lib/studio/persistence";

/**
 * Verified-durable hero gate tests (Step 4 Phase 4.5, ADR-S4-3).
 *
 * Contract: the gate NEVER returns a foreign/vendor URL. It returns a durable
 * CDN/data URL, a re-hosted CDN URL, or `null` (+ warning) — so the storefront
 * can never receive a rotting hero that renders black/broken.
 */

function makeFakePersistence(opts: { driver?: "r2" | "memory" } = {}): StudioPersistence {
  return {
    mediaStore: {
      async putBytes() {},
      publicUrl(args: { key: string }) {
        return `https://cdn.elfanaa.com/${args.key}`;
      },
    },
    config: {
      r2: {
        driver: opts.driver ?? "r2",
        buckets: { fanaa: "fanaa-bucket" },
        publicBaseUrls: { fanaa: "https://cdn.elfanaa.com" },
      },
    },
  } as unknown as StudioPersistence;
}

function stubFetchOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      headers: { get: (h: string) => (h === "content-type" ? "image/webp" : null) },
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("prepareDurableHeroUrl", () => {
  it("passes through an already-durable CDN url", async () => {
    const res = await prepareDurableHeroUrl({
      rawHero: "https://cdn.elfanaa.com/studio/a/gen.webp",
      draftId: "d",
      storeId: "fanaa",
      persistence: makeFakePersistence(),
    });
    expect(res.url).toBe("https://cdn.elfanaa.com/studio/a/gen.webp");
    expect(res.warning).toBeUndefined();
  });

  it("resolves a bare R2 key to an absolute durable CDN url", async () => {
    const res = await prepareDurableHeroUrl({
      rawHero: "studio-intake/fanaa/x.png",
      draftId: "d",
      storeId: "fanaa",
      persistence: makeFakePersistence(),
    });
    expect(res.url).toBe("https://cdn.elfanaa.com/studio-intake/fanaa/x.png");
  });

  it("re-hosts a still-alive vendor url to the durable CDN", async () => {
    stubFetchOk();
    const res = await prepareDurableHeroUrl({
      rawHero: "https://fal.media/files/hero.png",
      draftId: "d",
      storeId: "fanaa",
      persistence: makeFakePersistence(),
    });
    expect(res.url).not.toBeNull();
    expect(res.url!.startsWith("https://cdn.elfanaa.com/")).toBe(true);
    expect(res.url!.includes("fal.media")).toBe(false);
  });

  it("drops a dead vendor url to null + warning (never persists vendor)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, headers: { get: () => null } })),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await prepareDurableHeroUrl({
      rawHero: "https://fal.media/files/expired.png",
      draftId: "d",
      storeId: "fanaa",
      persistence: makeFakePersistence(),
    });
    expect(res.url).toBeNull();
    expect(res.warning).toBeTruthy();
    warn.mockRestore();
  });

  it("returns null for a missing hero", async () => {
    const res = await prepareDurableHeroUrl({
      rawHero: null,
      draftId: "d",
      storeId: "fanaa",
      persistence: makeFakePersistence(),
    });
    expect(res.url).toBeNull();
    expect(res.warning).toBeUndefined();
  });
});
