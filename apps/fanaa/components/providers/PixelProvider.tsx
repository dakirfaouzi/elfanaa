"use client";

import { useEffect } from "react";
import { bootPixels } from "@/lib/pixels";

const FALLBACK_DELAY_MS = 4000;
const INTERACTION_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

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
 * Mount once in `app/providers.tsx`. The provider has no UI surface;
 * it only wires effects.
 */
export function PixelProvider() {
  useEffect(() => {
    let booted = false;
    const onFirstSignal = () => {
      if (booted) return;
      booted = true;
      bootPixels();
      for (const ev of INTERACTION_EVENTS) {
        window.removeEventListener(ev, onFirstSignal);
      }
      window.clearTimeout(timer);
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
