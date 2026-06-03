import { describe, it, expect } from "vitest";
import { durableUploadRef } from "../lib/studio/upload-ref";

describe("durableUploadRef", () => {
  it("prefers the bare R2 key (identical to generated assets)", () => {
    expect(
      durableUploadRef({
        key: "studio/drft_123/upload/01J.webp",
        publicUrl: "https://cdn.example.com/studio/drft_123/upload/01J.webp",
      }),
    ).toBe("studio/drft_123/upload/01J.webp");
  });

  it("NEVER returns the non-fetchable r2:// sentinel — the original bug", () => {
    // No CDN configured → publicUrl is the r2:// sentinel. Must fall back to key.
    expect(
      durableUploadRef({
        key: "studio/drft_123/upload/01J.webp",
        publicUrl: "r2://fanaa-media/studio/drft_123/upload/01J.webp",
      }),
    ).toBe("studio/drft_123/upload/01J.webp");
  });

  it("falls back to a real http(s) publicUrl when no key is present", () => {
    expect(
      durableUploadRef({ key: "", publicUrl: "https://cdn.example.com/x.webp" }),
    ).toBe("https://cdn.example.com/x.webp");
  });

  it("returns empty (caller refuses to persist) when only an r2:// sentinel exists", () => {
    expect(
      durableUploadRef({ publicUrl: "r2://fanaa-media/studio/drft_123/x.webp" }),
    ).toBe("");
  });

  it("returns empty for missing/blank refs", () => {
    expect(durableUploadRef({})).toBe("");
    expect(durableUploadRef({ key: "   ", publicUrl: "  " })).toBe("");
    expect(durableUploadRef({ key: null, publicUrl: null })).toBe("");
  });
});
