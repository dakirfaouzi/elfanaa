import { describe, expect, it } from "vitest";
import { resolvePublicImageUrl } from "../runtime/orchestrator";

/**
 * Regression guard for the 2026-05-31 identity-loss root cause:
 * intake stores bare R2 keys, but the vision provider + fal img2img
 * need a fetchable URL. If this resolver ever returns a bare key or an
 * unfetchable private S3-endpoint URL, vision goes blind and the whole
 * product identity collapses to generic store defaults (PLATFORM.md §26.6).
 */
describe("resolvePublicImageUrl", () => {
  const CDN = "https://cdn.elfanaa.com";
  const S3 = "https://7f60.r2.cloudflarestorage.com/fanaa-assets";

  it("composes a bare R2 key against a public CDN base", () => {
    expect(
      resolvePublicImageUrl("studio-intake/fanaa/01HZ.webp", CDN),
    ).toBe("https://cdn.elfanaa.com/studio-intake/fanaa/01HZ.webp");
  });

  it("strips an r2:// scheme prefix before composing", () => {
    expect(
      resolvePublicImageUrl("r2://studio-intake/fanaa/01HZ.webp", CDN),
    ).toBe("https://cdn.elfanaa.com/studio-intake/fanaa/01HZ.webp");
  });

  it("normalises a leading slash on the key and trailing slash on the base", () => {
    expect(
      resolvePublicImageUrl("/studio-intake/x.webp", `${CDN}/`),
    ).toBe("https://cdn.elfanaa.com/studio-intake/x.webp");
  });

  it("passes an absolute non-S3 https URL through unchanged", () => {
    expect(resolvePublicImageUrl(`${CDN}/already/public.jpg`, CDN)).toBe(
      `${CDN}/already/public.jpg`,
    );
  });

  it("rejects an absolute private S3-endpoint URL (unfetchable by providers)", () => {
    expect(resolvePublicImageUrl(`${S3}/studio/x.jpg`, CDN)).toBeUndefined();
  });

  it("rejects a bare key when the base is the private S3 endpoint", () => {
    expect(resolvePublicImageUrl("studio-intake/x.webp", S3)).toBeUndefined();
  });

  it("returns undefined when no base is configured for a bare key", () => {
    expect(resolvePublicImageUrl("studio-intake/x.webp", undefined)).toBeUndefined();
    expect(resolvePublicImageUrl("studio-intake/x.webp", "  ")).toBeUndefined();
  });

  it("returns undefined for empty / missing input", () => {
    expect(resolvePublicImageUrl(undefined, CDN)).toBeUndefined();
    expect(resolvePublicImageUrl("", CDN)).toBeUndefined();
    expect(resolvePublicImageUrl("   ", CDN)).toBeUndefined();
  });
});
