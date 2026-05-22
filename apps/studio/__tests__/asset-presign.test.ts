import { describe, expect, it, vi } from "vitest";
import { MemoryMediaStore } from "@platform/storage";
import { presignAsset } from "../lib/studio/asset-presign";

/**
 * Asset-presign helper tests.
 *
 * Verifies:
 *   • Zod validation: invalid intents return `invalid_intent`.
 *   • Draft lookup: missing draft → `draft_not_found` (when repo
 *     supplied).
 *   • Bucket resolution: missing bucket → `bucket_missing`.
 *   • MediaStore failure: throwing presigner → `presign_failed`.
 *   • Happy path: a complete intent returns `ok` with a URL.
 */
describe("presignAsset", () => {
  const validIntent = {
    source: "upload" as const,
    contentType: "image/png",
    bytes: 12345,
    altAr: "صورة",
    altEn: "Photo",
  };

  function makeMockDraftRepo(opts: { exists: boolean }) {
    return {
      findById: vi.fn(async () =>
        opts.exists
          ? {
              id: "draft_xyz",
              storeId: "fanaa",
              slug: "test",
              title: "Test",
              supplierUrl: null,
              notes: null,
              positioning: null,
              status: "intake" as const,
              template: "default",
              costCents: 0,
              publishedAt: null,
              publishedRef: null,
              createdBy: "system",
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : null,
      ),
    } as unknown as Parameters<typeof presignAsset>[0]["draftRepo"];
  }

  it("returns ok with a presigned URL for a valid intent + draft + bucket", async () => {
    const mediaStore = new MemoryMediaStore();
    const result = await presignAsset({
      draftId: "draft_xyz",
      rawIntent: validIntent,
      mediaStore,
      draftRepo: makeMockDraftRepo({ exists: true }),
      bucketResolver: () => "fanaa-assets",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.presigned.method).toBe("PUT");
    expect(result.presigned.ref.bucket).toBe("fanaa-assets");
    expect(result.presigned.ref.key).toContain("studio/draft_xyz/upload/");
    expect(result.intent.contentType).toBe("image/png");
  });

  it("invalid intent (oversized) → invalid_intent", async () => {
    const result = await presignAsset({
      draftId: "draft_xyz",
      rawIntent: { ...validIntent, bytes: 999 * 1024 * 1024 },
      mediaStore: new MemoryMediaStore(),
      bucketResolver: () => "b",
    });
    expect(result.status).toBe("invalid_intent");
  });

  it("invalid intent (unknown content type) → invalid_intent", async () => {
    const result = await presignAsset({
      draftId: "draft_xyz",
      rawIntent: { ...validIntent, contentType: "application/exe" },
      mediaStore: new MemoryMediaStore(),
      bucketResolver: () => "b",
    });
    expect(result.status).toBe("invalid_intent");
  });

  it("draft repo supplied + draft missing → draft_not_found", async () => {
    const result = await presignAsset({
      draftId: "missing",
      rawIntent: validIntent,
      mediaStore: new MemoryMediaStore(),
      draftRepo: makeMockDraftRepo({ exists: false }),
      bucketResolver: () => "b",
    });
    expect(result.status).toBe("draft_not_found");
  });

  it("bucket resolver returns undefined → bucket_missing", async () => {
    const result = await presignAsset({
      draftId: "draft_xyz",
      rawIntent: validIntent,
      mediaStore: new MemoryMediaStore(),
      draftRepo: makeMockDraftRepo({ exists: true }),
      bucketResolver: () => undefined,
    });
    expect(result.status).toBe("bucket_missing");
    if (result.status === "bucket_missing") {
      expect(result.storeId).toBe("fanaa");
    }
  });

  it("mediaStore presign throws → presign_failed", async () => {
    const failingStore = {
      presignUpload: vi.fn(async () => {
        throw new Error("r2_unreachable");
      }),
      presignDownload: vi.fn(),
      exists: vi.fn(),
      head: vi.fn(),
      putBytes: vi.fn(),
      delete: vi.fn(),
      publicUrl: () => "",
    } as unknown as Parameters<typeof presignAsset>[0]["mediaStore"];
    const result = await presignAsset({
      draftId: "draft_xyz",
      rawIntent: validIntent,
      mediaStore: failingStore,
      draftRepo: makeMockDraftRepo({ exists: true }),
      bucketResolver: () => "b",
    });
    expect(result.status).toBe("presign_failed");
    if (result.status === "presign_failed") {
      expect(result.reason).toBe("r2_unreachable");
    }
  });

  it("no draftRepo (file-only mode) → defaults storeId to 'fanaa'", async () => {
    const result = await presignAsset({
      draftId: "draft_xyz",
      rawIntent: validIntent,
      mediaStore: new MemoryMediaStore(),
      bucketResolver: (storeId) =>
        storeId === "fanaa" ? "fanaa-assets" : undefined,
    });
    expect(result.status).toBe("ok");
  });
});
