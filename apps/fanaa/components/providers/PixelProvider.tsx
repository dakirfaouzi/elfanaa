"use client";

import { useEffect } from "react";
import { bootPixels, resolvePixelIds, type PixelIdsInput } from "@/lib/pixels";

const FALLBACK_DELAY_MS = 4000;
const INTERACTION_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
const RUNTIME_CONFIG_URL = "/api/public-config";

/**
 * Defers pixel boot until the user actually interacts with the page,
 * with a 4-second fallback so passive sessions still report.
 *
 * Why defer:
 *   • Meta/TikTok/Snap scripts add ~120 KB of JS each.
 *   • Loading them eagerly breaks Lighthouse Performance and pushes FCP.
 *   • First-interaction is the canonical signal a user is "engaged".
 *
 * Why fallback:
 *   • Bots, ad-impression bursts, and customers who landed mid-scroll
 *     wouldn't otherwise pixel — losing top-of-funnel attribution.
 *
 * Runtime IDs:
 *   • `NEXT_PUBLIC_*` is inlined at build time. When a deploy provides the
 *     pixel IDs only as runtime env (the common Docker/EasyPanel case), the
 *     bundle bakes empty strings and pixels never boot. We therefore fetch
 *     the IDs from `/api/public-config` (read server-side from the live env)
 *     and merge them over any build-time values before booting. The fetch is
 *     warmed on mount so it's ready by first interaction; the deferred-boot
 *     behaviour itself is unchanged.
 *
 * Mount once in `app/providers.tsx`. The provider has no UI surface;
 * it only wires effects.
 */
export function PixelProvider() {
  useEffect(() => {
    let booted = false;

    // Warm the runtime config once; reuse the same in-flight promise so first
    // interaction never triggers a second request.
    let configPromise: Promise<PixelIdsInput | null> | null = null;
    const loadRuntimeIds = (): Promise<PixelIdsInput | null> => {
      if (!configPromise) {
        configPromise = fetch(RUNTIME_CONFIG_URL, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) =>
            j && typeof j === "object" && j.pixels
              ? (j.pixels as PixelIdsInput)
              : null,
          )
          .catch(() => null);
      }
      return configPromise;
    };
    void loadRuntimeIds();

    const onFirstSignal = () => {
      if (booted) return;
      booted = true;
      window.clearTimeout(timer);
      for (const ev of INTERACTION_EVENTS) {
        window.removeEventListener(ev, onFirstSignal);
      }
      // Resolve runtime IDs (falling back to build-time inlined values), then
      // hand off to the unchanged boot path.
      void loadRuntimeIds().then((runtime) => {
        bootPixels(resolvePixelIds(runtime));
      });
    };

    for (const ev of INTERACTION_EVENTS) {
      window.addEventListener(ev, onFirstSignal, {
        once: true,
        passive: true,
      });
    }
    const timer = window.setTimeout(onFirstSignal, FALLBACK_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      for (const ev of INTERACTION_EVENTS) {
        window.removeEventListener(ev, onFirstSignal);
      }
    };
  }, []);

  return null;
}
