import { describe, expect, it } from "vitest";
import {
  AssetLifecycleStateSchema,
  AssetManifestSchema,
  AssetUploadIntentSchema,
  PresignedUploadResponseSchema,
} from "../schemas";

/**
 * Storage schemas tests. The schemas are the wire-format contract
 * between Studio routes / persistence / storage; drift here would
 * silently corrupt the asset browser. We test each one against
 * canonical happy + failure inputs.
 */

describe("AssetUploadIntentSchema", () => {
  it("accepts a valid intent", () => {
    const parsed = AssetUploadIntentSchema.safeParse({
      source: "upload",
      contentType: "image/png",
      bytes: 12345,
      altAr: "صورة المنتج",
      altEn: "Product photo",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown sources", () => {
    const parsed = AssetUploadIntentSchema.safeParse({
      source: "unknown",
      contentType: "image/png",
      bytes: 1,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unsupported content types", () => {
    const parsed = AssetUploadIntentSchema.safeParse({
      source: "upload",
      contentType: "application/exe",
      bytes: 1,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects oversized uploads (>25 MiB)", () => {
    const parsed = AssetUploadIntentSchema.safeParse({
      source: "upload",
      contentType: "image/png",
      bytes: 26 * 1024 * 1024,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects zero-byte uploads", () => {
    const parsed = AssetUploadIntentSchema.safeParse({
      source: "upload",
      contentType: "image/png",
      bytes: 0,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("AssetManifestSchema", () => {
  it("accepts a complete manifest", () => {
    const parsed = AssetManifestSchema.safeParse({
      id: "asset_01",
      draftId: "draft_01",
      source: "generated",
      bucket: "fanaa-assets",
      key: "studio/draft_01/generated/01HX.png",
      contentType: "image/png",
      bytes: 12345,
      width: 1024,
      height: 1024,
      createdAt: "2026-05-22T10:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("makes width/height optional", () => {
    const parsed = AssetManifestSchema.safeParse({
      id: "asset_01",
      draftId: "draft_01",
      source: "upload",
      bucket: "fanaa-assets",
      key: "k",
      contentType: "image/png",
      bytes: 1,
      createdAt: "2026-05-22T10:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("PresignedUploadResponseSchema", () => {
  it("accepts a complete presigned-upload response", () => {
    const parsed = PresignedUploadResponseSchema.safeParse({
      url: "https://example.com/upload?sig=abc",
      headers: { "content-type": "image/png" },
      method: "PUT",
      expiresAt: "2026-05-22T11:00:00.000Z",
      ref: {
        bucket: "fanaa-assets",
        key: "studio/d/upload/01.png",
        contentType: "image/png",
        bytes: 0,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-URL fields", () => {
    const parsed = PresignedUploadResponseSchema.safeParse({
      url: "not a url",
      headers: {},
      method: "PUT",
      expiresAt: "2026",
      ref: { bucket: "b", key: "k", contentType: "image/png", bytes: 0 },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("AssetLifecycleStateSchema", () => {
  it("enumerates exactly the four lifecycle states", () => {
    expect(AssetLifecycleStateSchema.options).toEqual([
      "pending",
      "uploaded",
      "attached",
      "archived",
    ]);
  });
});
