import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public runtime configuration for the browser.
 *
 * # Why this exists
 *
 * `NEXT_PUBLIC_*` env vars are inlined into the client bundle by Webpack at
 * `next build`. In a Docker/EasyPanel deploy where the pixel IDs are provided
 * only as *runtime* environment variables (not `--build-arg`s), the browser
 * bundle bakes empty strings and the Meta/TikTok/Snap pixels never initialise.
 *
 * This handler runs on the server at REQUEST time (`force-dynamic`, never
 * cached), so it reads the container's live env and hands the IDs to the
 * client. `PixelProvider` fetches it and feeds the result into the existing
 * `bootPixels()` path — no change to the deferred-boot, facade, dedup, or CAPI
 * architecture. Build-time inlined IDs still work and act as the fallback.
 *
 * Only PUBLIC, browser-safe values belong here. The matching CAPI access
 * tokens stay server-side and are NEVER exposed.
 */
export function GET() {
  const env = process.env;
  const val = (...names: string[]): string | null => {
    for (const n of names) {
      const v = env[n];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  return NextResponse.json(
    {
      pixels: {
        meta: val("NEXT_PUBLIC_META_PIXEL_ID", "META_PIXEL_ID"),
        tiktok: val("NEXT_PUBLIC_TIKTOK_PIXEL_ID", "TIKTOK_PIXEL_ID"),
        snapchat: val("NEXT_PUBLIC_SNAPCHAT_PIXEL_ID", "SNAPCHAT_PIXEL_ID"),
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
