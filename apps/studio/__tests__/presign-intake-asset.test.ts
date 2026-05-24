import { describe, expect, it } from "vitest";
import { MemoryMediaStore } from "@platform/storage";
import { presignIntakeAsset } from "../lib/studio/intake/presign-intake-asset";

/**
 * presignIntakeAsset tests — the intake-time sibling to
 * presignAsset (Phase B1).
 *
 * Coverage focuses on the BEHAVIOURAL DIFFERENCES from
 * presignAsset:
 *
 *   • No draftId required — the helper doesn't query a draft repo.
 *   • storeId is the new trust-boundary input — bad ids must be
 *     rejected before reaching the bucket resolver.
 *   • Issued keys MUST land under `studio-intake/` so the R2
 *     lifecycle policy can expire them safely.
 *
 * Shared behaviour (Zod intent validation, bucket-missing, presign
 * failure) is verified via narrow cases — the deeper coverage
 * lives in asset-presign.test.ts.
 */
describe("presignIntakeAsset", () => {
  const validIntent = {
    source: "upload" as const,
    contentType: "image/webp",
    bytes: 24_000,
    altAr: "صورة",
    altEn: "Photo",
  };

  it("returns ok with a presigned URL targeting studio-intake/", async () => {
    const mediaStore = new MemoryMediaStore();
    const result = await presignIntakeAsset({
      storeId: "fanaa",
      rawIntent: validIntent,
      mediaStore,
      bucketResolver: () => "fanaa-assets",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.presigned.method).toBe("PUT");
    expect(result.presigned.ref.bucket).toBe("fanaa-assets");
    // The KEY assertion of Phase B1: the issued key MUST be under
    // the studio-intake/ prefix so the R2 lifecycle rule can
    // expire it without touching draft assets.
    expect(result.presigned.ref.key.startsWith("studio-intake/fanaa/")).toBe(
      true,
    );
    expect(result.presigned.ref.key).toMatch(/\.webp$/);
    expect(result.intent.contentType).toBe("image/webp");
  });

  it("invalid_store_id when storeId fails the regex", async () => {
    const result = await presignIntakeAsset({
      storeId: "store with spaces",
      rawIntent: validIntent,
      mediaStore: new MemoryMediaStore(),
      bucketResolver: () => "b",
    });
    expect(result.status).toBe("invalid_store");
    if (result.status !== "invalid_store") return;
    expect(result.storeId).toBe("store with spaces");
  });

  it("invalid_store_id when storeId is empty (SSRF guard)", async () => {
    const result = await presignIntakeAsset({
      storeId: "",
      rawIntent: validIntent,
      mediaStore: new MemoryMediaStore(),
      bucketResolver: () => "b",
    });
    expect(result.status).toBe("invalid_store");
  });

  it("invalid_intent when bytes exceed the schema cap", async () => {
    const result = await presignIntakeAsset({
      storeId: "fanaa",
      rawIntent: { ...validIntent, bytes: 999 * 1024 * 1024 },
      mediaStore: new MemoryMediaStore(),
      bucketResolver: () => "b",
    });
    expect(result.status).toBe("invalid_intent");
  });

  it("invalid_intent when content-type is outside the allow-list", async () => {
    const result = await presignIntakeAsset({
      storeId: "fanaa",
      rawIntent: { ...validIntent, contentType: "application/x-msdownload" },
      mediaStore: new MemoryMediaStore(),
      bucketResolver: () => "b",
    });
    expect(result.status).toBe("invalid_intent");
  });

  it("bucket_missing when the resolver returns undefined", async () => {
    const result = await presignIntakeAsset({
      storeId: "fanaa",
      rawIntent: validIntent,
      mediaStore: new MemoryMediaStore(),
      bucketResolver: () => undefined,
    });
    expect(result.status).toBe("bucket_missing");
    if (result.status !== "bucket_missing") return;
    expect(result.storeId).toBe("fanaa");
  });

  it("presign_failed when the MediaStore throws", async () => {
    const throwingStore = {
      presignUpload: async () => {
        throw new Error("r2_signer_explode");
      },
    } as unknown as MemoryMediaStore;
    const result = await presignIntakeAsset({
      storeId: "fanaa",
      rawIntent: validIntent,
      mediaStore: throwingStore,
      bucketResolver: () => "fanaa-assets",
    });
    expect(result.status).toBe("presign_failed");
    if (result.status !== "presign_failed") return;
    expect(result.reason).toContain("r2_signer_explode");
  });

  it("two presigns from the same store yield distinct keys (ULID monotonicity)", async () => {
    const mediaStore = new MemoryMediaStore();
    const a = await presignIntakeAsset({
      storeId: "fanaa",
      rawIntent: validIntent,
      mediaStore,
      bucketResolver: () => "fanaa-assets",
    });
    const b = await presignIntakeAsset({
      storeId: "fanaa",
      rawIntent: validIntent,
      mediaStore,
      bucketResolver: () => "fanaa-assets",
    });
    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");
    if (a.status !== "ok" || b.status !== "ok") return;
    expect(a.presigned.ref.key).not.toBe(b.presigned.ref.key);
  });
});
