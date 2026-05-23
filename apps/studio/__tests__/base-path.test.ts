import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the Studio basePath helpers.
 *
 * The behaviour these helpers encode is subtle:
 *   • `studioPath()` is for places Next.js does NOT auto-prefix
 *     (raw `fetch()`, server `redirect()`, cookie `path`).
 *   • `stripStudioBasePath()` is for places Next.js DOES auto-prefix
 *     (`router.push/replace`, `<Link href>`) so we don't end up with
 *     `/studio/studio/drafts` when the input already contains the
 *     basePath.
 *
 * Getting either wrong manifests as a 404 in production for everyone
 * who tries to log into Studio under the M12 mount, so we pin the
 * behaviour exhaustively.
 *
 * `STUDIO_BASE_PATH` is read once at module load from
 * `process.env.NEXT_PUBLIC_STUDIO_BASE_PATH`, so we mutate the env +
 * `vi.resetModules()` between cases instead of trying to monkey-patch
 * the live module.
 */

const ENV_KEY = "NEXT_PUBLIC_STUDIO_BASE_PATH";

async function loadHelpers(basePath: string | undefined) {
  if (basePath === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = basePath;
  }
  vi.resetModules();
  return import("../lib/base-path");
}

describe("base-path helpers (mounted at root)", () => {
  let helpers: typeof import("../lib/base-path");
  const original = process.env[ENV_KEY];

  beforeEach(async () => {
    helpers = await loadHelpers("");
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it("exposes an empty STUDIO_BASE_PATH", () => {
    expect(helpers.STUDIO_BASE_PATH).toBe("");
  });

  it("studioPath() returns the input verbatim when there is no basePath", () => {
    expect(helpers.studioPath("/api/auth/login")).toBe("/api/auth/login");
    expect(helpers.studioPath("/drafts")).toBe("/drafts");
    expect(helpers.studioPath("foo")).toBe("foo");
  });

  it("studioCookiePath() returns '/' so cookies are domain-wide", () => {
    expect(helpers.studioCookiePath()).toBe("/");
  });

  it("stripStudioBasePath() is a no-op", () => {
    expect(helpers.stripStudioBasePath("/drafts")).toBe("/drafts");
    expect(helpers.stripStudioBasePath("/studio/drafts")).toBe("/studio/drafts");
    expect(helpers.stripStudioBasePath("/")).toBe("/");
  });
});

describe("base-path helpers (mounted at /studio)", () => {
  let helpers: typeof import("../lib/base-path");
  const original = process.env[ENV_KEY];

  beforeEach(async () => {
    helpers = await loadHelpers("/studio");
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it("exposes the configured STUDIO_BASE_PATH", () => {
    expect(helpers.STUDIO_BASE_PATH).toBe("/studio");
  });

  it("studioPath() prepends the basePath to absolute paths", () => {
    expect(helpers.studioPath("/api/auth/login")).toBe("/studio/api/auth/login");
    expect(helpers.studioPath("/drafts")).toBe("/studio/drafts");
  });

  it("studioPath() also normalises a missing leading slash", () => {
    expect(helpers.studioPath("foo")).toBe("/studio/foo");
  });

  it("studioCookiePath() returns the basePath so cookies stay scoped", () => {
    expect(helpers.studioCookiePath()).toBe("/studio");
  });

  describe("stripStudioBasePath()", () => {
    it("removes the basePath from a child path", () => {
      // The exact regression we are guarding against: middleware writes
      // pathname into `?next=…`; if we don't strip, router.replace()
      // re-prefixes and we navigate to /studio/studio/drafts → 404.
      expect(helpers.stripStudioBasePath("/studio/drafts")).toBe("/drafts");
      expect(helpers.stripStudioBasePath("/studio/runs/abc-123")).toBe(
        "/runs/abc-123"
      );
    });

    it("collapses the bare basePath to '/'", () => {
      expect(helpers.stripStudioBasePath("/studio")).toBe("/");
    });

    it("leaves paths that don't start with the basePath unchanged", () => {
      expect(helpers.stripStudioBasePath("/drafts")).toBe("/drafts");
      expect(helpers.stripStudioBasePath("/login")).toBe("/login");
      // Never silently rewrite a similarly-named but unrelated route.
      expect(helpers.stripStudioBasePath("/studio-internal/foo")).toBe(
        "/studio-internal/foo"
      );
    });

    it("is idempotent — calling twice gives the same result as once", () => {
      const once = helpers.stripStudioBasePath("/studio/drafts");
      const twice = helpers.stripStudioBasePath(once);
      expect(once).toBe(twice);
    });
  });
});
