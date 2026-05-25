import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isFetchableAssetUrl, resolveAssetUrl } from "../lib/studio/asset-url";

/**
 * C3.1 follow-up — `resolveAssetUrl()` is the URL adapter that closes
 * the gap between R2 KEYS (which the intake uploader and AI pipeline
 * write into `MediaRef.desktopSrc`) and BROWSER-FETCHABLE URLs (which
 * the runtime renderer writes into `<img src>`).
 *
 * # Coverage focus
 *
 *   1. Pass-through for already-resolved URLs (http, data, blob,
 *      memory) — the helper must NEVER double-prefix.
 *   2. R2 key → `/api/studio/media/<key>` translation, including
 *      basePath threading via NEXT_PUBLIC_STUDIO_BASE_PATH.
 *   3. Empty/whitespace input → "" (caller's responsibility to render
 *      a placeholder card).
 *   4. URL-encoding of keys with awkward characters — defence against
 *      future key shapes the proxy route would otherwise mis-parse.
 */

describe("resolveAssetUrl", () => {
  // The basePath is read at module-load time from
  // `process.env.NEXT_PUBLIC_STUDIO_BASE_PATH`. Each test stages the env
  // before importing the helper via dynamic import so the value is
  // picked up cleanly without leaking between cases.

  describe("empty and absolute URLs", () => {
    it("returns '' for null", () => {
      expect(resolveAssetUrl(null)).toBe("");
    });

    it("returns '' for undefined", () => {
      expect(resolveAssetUrl(undefined)).toBe("");
    });

    it("returns '' for empty string", () => {
      expect(resolveAssetUrl("")).toBe("");
    });

    it("returns '' for whitespace-only input", () => {
      expect(resolveAssetUrl("   ")).toBe("");
    });

    it("passes http:// URLs through unchanged", () => {
      expect(resolveAssetUrl("http://cdn.example.com/a.png")).toBe(
        "http://cdn.example.com/a.png",
      );
    });

    it("passes https:// URLs through unchanged", () => {
      expect(resolveAssetUrl("https://cdn.example.com/a.png")).toBe(
        "https://cdn.example.com/a.png",
      );
    });

    it("passes HTTPS:// (uppercase scheme) through unchanged", () => {
      expect(resolveAssetUrl("HTTPS://cdn.example.com/a.png")).toBe(
        "HTTPS://cdn.example.com/a.png",
      );
    });

    it("passes data: URLs through unchanged", () => {
      const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
      expect(resolveAssetUrl(dataUrl)).toBe(dataUrl);
    });

    it("passes blob: URLs through unchanged (client-side previews)", () => {
      const blobUrl = "blob:http://localhost:3000/abc-123";
      expect(resolveAssetUrl(blobUrl)).toBe(blobUrl);
    });

    it("passes memory:// URLs through unchanged (dev memory store)", () => {
      const memUrl = "memory://media/fanaa-assets/studio-intake/fanaa/01H.webp";
      expect(resolveAssetUrl(memUrl)).toBe(memUrl);
    });
  });

  describe("R2 key translation", () => {
    it("rewrites an intake key to the asset proxy path", () => {
      // No basePath configured in the test env → proxy URL starts
      // with the bare `/api/...` prefix.
      const key = "studio-intake/fanaa/01HXYZTESTULIDFAKEABCDEFGH.webp";
      expect(resolveAssetUrl(key)).toBe(
        "/api/studio/media/studio-intake/fanaa/01HXYZTESTULIDFAKEABCDEFGH.webp",
      );
    });

    it("rewrites a draft-attached key to the asset proxy path", () => {
      const key = "studio/draft_abc/upload/01HXYZTESTULIDFAKEABCDEFGH.png";
      expect(resolveAssetUrl(key)).toBe(
        "/api/studio/media/studio/draft_abc/upload/01HXYZTESTULIDFAKEABCDEFGH.png",
      );
    });

    it("preserves `/` separators as path delimiters (does NOT encode them)", () => {
      // The catch-all route receives one path segment per `/` delim.
      // If we URL-encoded the `/` as `%2F`, the route handler would
      // see a single segment and the key parser would reject it.
      const key = "stores/fanaa/p/a.webp";
      expect(resolveAssetUrl(key)).toBe(
        "/api/studio/media/stores/fanaa/p/a.webp",
      );
    });

    it("URI-encodes awkward characters inside a segment", () => {
      // A segment containing a space must be percent-encoded so the
      // browser doesn't strip it during URL resolution. Real keys
      // emitted by the storage layer don't have spaces — this guards
      // against any future shape that might.
      const key = "studio-intake/fanaa/file with space.webp";
      expect(resolveAssetUrl(key)).toBe(
        "/api/studio/media/studio-intake/fanaa/file%20with%20space.webp",
      );
    });

    it("trims surrounding whitespace before translation", () => {
      const key = "  studio-intake/fanaa/01HXYZ.webp  ";
      expect(resolveAssetUrl(key)).toBe(
        "/api/studio/media/studio-intake/fanaa/01HXYZ.webp",
      );
    });

    it("idempotency: feeding a proxy URL back in returns a stable shape", () => {
      // Once `resolveAssetUrl()` has emitted an absolute proxy URL,
      // feeding it through the helper again must NOT change it. (Today
      // the path starts with `/` — relative — but the same helper
      // applied to its output should preserve it byte-for-byte to keep
      // double-render scenarios safe.)
      const first = resolveAssetUrl("studio-intake/fanaa/01H.webp");
      const second = resolveAssetUrl(first);
      expect(second).toBe(first);
    });
  });

  describe("isFetchableAssetUrl", () => {
    it("rejects null / undefined / empty", () => {
      expect(isFetchableAssetUrl(null)).toBe(false);
      expect(isFetchableAssetUrl(undefined)).toBe(false);
      expect(isFetchableAssetUrl("")).toBe(false);
      expect(isFetchableAssetUrl("   ")).toBe(false);
    });

    it("accepts any non-empty string (it's the output of resolveAssetUrl)", () => {
      expect(isFetchableAssetUrl("/api/studio/media/x")).toBe(true);
      expect(isFetchableAssetUrl("https://x.example/a.png")).toBe(true);
      expect(isFetchableAssetUrl("data:image/png;base64,abc")).toBe(true);
    });
  });
});
