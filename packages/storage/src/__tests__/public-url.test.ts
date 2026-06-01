import { describe, expect, it } from "vitest";
import {
  isDurablePublicUrl,
  resolvePublicCdnBase,
  resolveStorageRef,
} from "../public-url";

const CDN = "https://cdn.elfanaa.com";

/**
 * Public-URL resolution tests (Step 4 Phase 4.5).
 *
 * This module is the single source of truth shared by the fanaa storefront
 * (catalog hydration) and the Studio publish hero gate, so the behaviour is
 * pinned here once and both consumers inherit it.
 */
describe("resolveStorageRef", () => {
  it("returns null for empty / whitespace", () => {
    expect(resolveStorageRef("", { cdnBase: CDN })).toBeNull();
    expect(resolveStorageRef("   ", { cdnBase: CDN })).toBeNull();
    expect(resolveStorageRef(null, { cdnBase: CDN })).toBeNull();
    expect(resolveStorageRef(undefined, { cdnBase: CDN })).toBeNull();
  });

  it("passes inline data URIs through unchanged", () => {
    const data = "data:image/svg+xml;utf8,<svg/>";
    expect(resolveStorageRef(data, { cdnBase: CDN })).toBe(data);
  });

  it("passes already-absolute public URLs through unchanged", () => {
    expect(
      resolveStorageRef("https://cdn.elfanaa.com/studio/a/gen.webp", { cdnBase: CDN }),
    ).toBe("https://cdn.elfanaa.com/studio/a/gen.webp");
    // A foreign/vendor URL is still RESOLVED (renderable) — durability is a
    // separate question answered by isDurablePublicUrl.
    expect(
      resolveStorageRef("https://fal.media/files/abc.png", { cdnBase: CDN }),
    ).toBe("https://fal.media/files/abc.png");
  });

  it("rewrites a private R2 S3-endpoint URL to the public CDN", () => {
    expect(
      resolveStorageRef(
        "https://acct.r2.cloudflarestorage.com/fanaa-bucket/studio/a/gen.webp",
        { cdnBase: CDN },
      ),
    ).toBe("https://cdn.elfanaa.com/studio/a/gen.webp");
  });

  it("resolves r2:// scheme to cdnBase + key (bucket dropped)", () => {
    expect(
      resolveStorageRef("r2://fanaa-bucket/studio/abc/gen.webp", { cdnBase: CDN }),
    ).toBe("https://cdn.elfanaa.com/studio/abc/gen.webp");
  });

  it("resolves a bare R2 key to cdnBase + key", () => {
    expect(
      resolveStorageRef("studio-intake/fanaa/01KSV.png", { cdnBase: CDN }),
    ).toBe("https://cdn.elfanaa.com/studio-intake/fanaa/01KSV.png");
  });

  it("returns null for unknown URI schemes", () => {
    expect(resolveStorageRef("blob:abc", { cdnBase: CDN })).toBeNull();
    expect(resolveStorageRef("file:///x.png", { cdnBase: CDN })).toBeNull();
  });

  it("never double-slashes regardless of trailing slash on the base", () => {
    expect(
      resolveStorageRef("studio/x.png", { cdnBase: "https://cdn.elfanaa.com/" }),
    ).toBe("https://cdn.elfanaa.com/studio/x.png");
  });
});

describe("isDurablePublicUrl", () => {
  it("treats our own CDN as durable", () => {
    expect(isDurablePublicUrl("https://cdn.elfanaa.com/a.png", CDN)).toBe(true);
    expect(isDurablePublicUrl("https://cdn.elfanaa.com", CDN)).toBe(true);
  });

  it("treats inline data URIs as durable", () => {
    expect(isDurablePublicUrl("data:image/svg+xml;utf8,<svg/>", CDN)).toBe(true);
  });

  it("treats vendor / foreign URLs as NON-durable", () => {
    expect(isDurablePublicUrl("https://fal.media/files/abc.png", CDN)).toBe(false);
    expect(isDurablePublicUrl("https://images.unsplash.com/x", CDN)).toBe(false);
  });

  it("guards against a CDN-prefix lookalike host", () => {
    // Must match on the base + "/" boundary, not a bare prefix.
    expect(
      isDurablePublicUrl("https://cdn.elfanaa.com.evil.test/a.png", CDN),
    ).toBe(false);
  });

  it("is false for null / empty", () => {
    expect(isDurablePublicUrl(null, CDN)).toBe(false);
    expect(isDurablePublicUrl("", CDN)).toBe(false);
  });
});

describe("resolvePublicCdnBase", () => {
  it("uses the env value when it is a public host", () => {
    expect(resolvePublicCdnBase("https://cdn.elfanaa.com/", CDN)).toBe(CDN);
  });

  it("ignores a private R2 endpoint env and falls back", () => {
    expect(
      resolvePublicCdnBase("https://acct.r2.cloudflarestorage.com/bucket", CDN),
    ).toBe(CDN);
  });

  it("falls back when env is missing", () => {
    expect(resolvePublicCdnBase(undefined, CDN)).toBe(CDN);
    expect(resolvePublicCdnBase("   ", CDN)).toBe(CDN);
  });
});
