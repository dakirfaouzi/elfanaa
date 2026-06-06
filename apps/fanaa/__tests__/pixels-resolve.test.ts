import { afterEach, describe, expect, it } from "vitest";
import { resolvePixelIds } from "@/lib/pixels";

/**
 * resolvePixelIds() — the runtime/build-time merge that fixes "browser pixels
 * never initialize" when IDs are provided only as runtime env (Docker/EasyPanel)
 * and were therefore never inlined into the bundle at build time.
 */

const KEYS = [
  "NEXT_PUBLIC_META_PIXEL_ID",
  "NEXT_PUBLIC_TIKTOK_PIXEL_ID",
  "NEXT_PUBLIC_SNAPCHAT_PIXEL_ID",
] as const;

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("resolvePixelIds", () => {
  it("uses runtime IDs when the build baked nothing (the production bug)", () => {
    const ids = resolvePixelIds({
      meta: "26052333031114111",
      tiktok: "D6S2GURC77UC2AGO2710",
      snapchat: "3e85ace2-62c5-4246-9cd8-7cfc490019e4",
    });
    expect(ids.meta).toBe("26052333031114111");
    expect(ids.tiktok).toBe("D6S2GURC77UC2AGO2710");
    expect(ids.snapchat).toBe("3e85ace2-62c5-4246-9cd8-7cfc490019e4");
  });

  it("prefers a runtime override over a build-time inlined value", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "build_meta";
    expect(resolvePixelIds({ meta: "runtime_meta" }).meta).toBe("runtime_meta");
  });

  it("falls back to the build-time value when the runtime value is missing/blank/null", () => {
    process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID = "build_tt";
    expect(resolvePixelIds({ tiktok: null }).tiktok).toBe("build_tt");
    expect(resolvePixelIds({ tiktok: "   " }).tiktok).toBe("build_tt");
    expect(resolvePixelIds(null).tiktok).toBe("build_tt");
    expect(resolvePixelIds(undefined).tiktok).toBe("build_tt");
  });

  it("returns undefined for a pixel when neither source has a value", () => {
    const ids = resolvePixelIds({});
    expect(ids.meta).toBeUndefined();
    expect(ids.tiktok).toBeUndefined();
    expect(ids.snapchat).toBeUndefined();
  });

  it("trims whitespace from runtime values", () => {
    expect(resolvePixelIds({ snapchat: "  snap-id  " }).snapchat).toBe("snap-id");
  });
});
