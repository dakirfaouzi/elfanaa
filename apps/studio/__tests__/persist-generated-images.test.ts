import { afterEach, describe, expect, it, vi } from "vitest";
import type { UniversalProduct } from "@platform/catalog-schema";
import {
  persistGeneratedImages,
  rehostImageUrl,
} from "../lib/studio/persist-generated-images";
import type { StudioPersistence } from "../lib/studio/persistence";

/**
 * persistGeneratedImages tests (Step 4 Phase 4.5).
 *
 * The headline guarantee: EVERY generated image array — `images` (hero +
 * gallery) AND `lifestyleImages` — is re-hosted to durable storage. Before 4.5
 * lifestyle shots kept their ephemeral vendor URLs and rotted; this pins the
 * fix so it can't regress.
 */

function makeProduct(overrides: Partial<UniversalProduct> = {}): UniversalProduct {
  return {
    id: "up_test_001",
    slug: "glow-serum",
    niche: "beauty_wellness",
    storeContext: "fanaa",
    generationRunId: "run_test_001",
    generatedAt: "2026-01-15T10:00:00.000Z",
    title: { ar: "سيروم", en: "Glow Serum" },
    description: { ar: "وصف", en: "Desc" },
    benefits: [],
    images: [
      { src: "https://fal.media/files/hero.png", alt: { ar: "", en: "hero" } },
    ],
    lifestyleImages: [
      { src: "https://fal.media/files/life1.png", alt: { ar: "", en: "l1" } },
      { src: "https://fal.media/files/life2.png", alt: { ar: "", en: "l2" } },
    ],
    reviews: [],
    faq: [],
    priceHint: { amount: 19900, currency: "SAR" },
    hooks: [],
    sources: {
      supplierUrl: "https://example.com",
      scrapedAt: "2026-01-14T18:00:00.000Z",
      uploadedImages: [],
    },
    ...overrides,
  };
}

interface FakeOpts {
  driver?: "r2" | "memory";
  publicBaseUrl?: string;
}

function makeFakePersistence(opts: FakeOpts = {}): {
  persistence: StudioPersistence;
  putCalls: Array<{ bucket: string; key: string }>;
} {
  const putCalls: Array<{ bucket: string; key: string }> = [];
  const persistence = {
    mediaStore: {
      async putBytes(args: { bucket: string; key: string }) {
        putCalls.push({ bucket: args.bucket, key: args.key });
      },
      publicUrl(args: { key: string }) {
        // Absolute public CDN URL (durable, not a private R2 endpoint).
        return `https://cdn.elfanaa.com/${args.key}`;
      },
    },
    config: {
      r2: {
        driver: opts.driver ?? "r2",
        buckets: { fanaa: "fanaa-bucket" },
        publicBaseUrls: {
          fanaa: opts.publicBaseUrl ?? "https://cdn.elfanaa.com",
        },
      },
    },
  } as unknown as StudioPersistence;
  return { persistence, putCalls };
}

/** Mock a successful image download (small webp payload). */
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

describe("persistGeneratedImages", () => {
  it("re-hosts BOTH images and lifestyleImages to the durable CDN", async () => {
    stubFetchOk();
    const { persistence, putCalls } = makeFakePersistence();

    const out = await persistGeneratedImages({
      product: makeProduct(),
      draftId: "draft_001",
      storeId: "fanaa",
      persistence,
    });

    // hero + 2 lifestyle = 3 uploads.
    expect(putCalls).toHaveLength(3);
    expect(out.images[0]!.src.startsWith("https://cdn.elfanaa.com/")).toBe(true);
    expect(out.lifestyleImages).toHaveLength(2);
    for (const img of out.lifestyleImages!) {
      expect(img.src.startsWith("https://cdn.elfanaa.com/")).toBe(true);
      expect(img.src.includes("fal.media")).toBe(false);
    }
  });

  it("preserves alt text while rewriting src", async () => {
    stubFetchOk();
    const { persistence } = makeFakePersistence();
    const out = await persistGeneratedImages({
      product: makeProduct(),
      draftId: "draft_001",
      storeId: "fanaa",
      persistence,
    });
    expect(out.lifestyleImages![0]!.alt).toEqual({ ar: "", en: "l1" });
  });

  it("returns the product unchanged when R2 is not configured (memory driver)", async () => {
    stubFetchOk();
    const { persistence, putCalls } = makeFakePersistence({ driver: "memory" });
    const product = makeProduct();
    const out = await persistGeneratedImages({
      product,
      draftId: "draft_001",
      storeId: "fanaa",
      persistence,
    });
    expect(out).toBe(product);
    expect(putCalls).toHaveLength(0);
  });

  it("keeps the original src when a download fails (no regression)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, headers: { get: () => null } })),
    );
    const { persistence } = makeFakePersistence();
    const product = makeProduct();
    const out = await persistGeneratedImages({
      product,
      draftId: "draft_001",
      storeId: "fanaa",
      persistence,
    });
    // All downloads failed → nothing rewritten → same product reference.
    expect(out).toBe(product);
  });
});

describe("rehostImageUrl", () => {
  it("returns null (skip) for non-HTTP refs", async () => {
    const { persistence } = makeFakePersistence();
    const r2 = (persistence.config as unknown as { r2: { buckets: Record<string, string> } }).r2;
    const res = await rehostImageUrl({
      src: "studio-intake/fanaa/x.png",
      draftId: "d",
      bucket: r2.buckets.fanaa!,
      publicBaseUrl: "https://cdn.elfanaa.com",
      mediaStore: persistence.mediaStore,
    });
    expect(res).toBeNull();
  });

  it("returns null (skip) for a URL already on the public CDN", async () => {
    const { persistence } = makeFakePersistence();
    const res = await rehostImageUrl({
      src: "https://cdn.elfanaa.com/already.png",
      draftId: "d",
      bucket: "fanaa-bucket",
      publicBaseUrl: "https://cdn.elfanaa.com",
      mediaStore: persistence.mediaStore,
    });
    expect(res).toBeNull();
  });

  it("re-hosts a foreign/vendor URL to the durable CDN", async () => {
    stubFetchOk();
    const { persistence } = makeFakePersistence();
    const res = await rehostImageUrl({
      src: "https://fal.media/files/x.png",
      draftId: "d",
      bucket: "fanaa-bucket",
      publicBaseUrl: "https://cdn.elfanaa.com",
      mediaStore: persistence.mediaStore,
    });
    expect(res).not.toBeNull();
    expect(res!.startsWith("https://cdn.elfanaa.com/")).toBe(true);
  });
});
