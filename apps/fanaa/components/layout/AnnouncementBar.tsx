"use client";

import { useEffect, useState } from "react";
import { Truck, ShieldCheck, BadgeCheck } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";

/**
 * Top-of-page announcement bar.
 *
 * Reads its copy from `dict.announcement` so the strings live next to the
 * rest of the i18n surface (no hard-coded localisation in components).
 *
 * Density curve:
 *   • Mobile — a single pillar that ROTATES through all three messages every
 *     few seconds. Phones therefore get the full trust story (free shipping →
 *     returns → COD) without crowding the 10px-tall band. This is the fix for
 *     the audit finding that mobile only ever saw the free-shipping line.
 *   • `sm` upward — the static multi-pillar row returns: free shipping +
 *     14-day returns, with the COD pillar joining from `md`.
 */
const ROTATE_MS = 3800;

export function AnnouncementBar() {
  const { t } = useLocale();

  const items = [
    { icon: Truck, text: t.announcement.freeShipping, visibility: "hidden sm:inline-flex" },
    { icon: ShieldCheck, text: t.announcement.returns, visibility: "hidden sm:inline-flex" },
    { icon: BadgeCheck, text: t.announcement.cod, visibility: "hidden md:inline-flex" },
  ] as const;

  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setActive((i) => (i + 1) % items.length),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [items.length]);

  const Current = items[active];

  return (
    /*
     * Espresso band with a whisper-thin gold hairline at the bottom so
     * the announcement strip reads as the first frame of the editorial
     * palette, not a generic black banner. Subtle radial accent pulls
     * the rose-gold into the bar so mobile shoppers feel the brand from
     * the first pixel.
     */
    <div className="relative overflow-hidden border-b border-accent/15 bg-ink text-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_140%_at_50%_-20%,rgba(199,162,124,0.18),transparent_60%)]"
      />
      <div className="relative mx-auto flex h-10 max-w-[1440px] items-center justify-center gap-6 px-4 text-[12.5px] tracking-wide md:gap-10">
        {/* Mobile — single rotating pillar (keyed so it fades on each change). */}
        <span
          key={active}
          className="inline-flex animate-fade-in items-center gap-2 sm:hidden"
        >
          <Current.icon className="size-3.5 text-accent/85" strokeWidth={1.6} />
          <span className="text-bg/90">{Current.text}</span>
        </span>

        {/* sm+ — static multi-pillar density row. */}
        {items.map(({ icon: Icon, text, visibility }) => (
          <span key={text} className={`items-center gap-2 ${visibility}`}>
            <Icon className="size-3.5 text-accent/85" strokeWidth={1.6} />
            <span className="text-bg/90">{text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
