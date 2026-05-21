"use client";

import { Truck, ShieldCheck, BadgeCheck } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";

/**
 * Top-of-page announcement bar.
 *
 * Reads its copy from `dict.announcement` so the strings live next to the
 * rest of the i18n surface (no hard-coded localisation in components).
 *
 * Mobile shows the single most-impactful message (free shipping). From
 * `sm` upward we add the 14-day-returns line, and from `md` upward the
 * COD pillar — preserving white space on small screens, and trust-density
 * on desktop. Premium ecommerce sites (Article, Pottery Barn, Rivers)
 * all follow this density curve.
 */
export function AnnouncementBar() {
  const { t } = useLocale();
  const items = [
    {
      icon: Truck,
      text: t.announcement.freeShipping,
      visibility: "block",
    },
    {
      icon: ShieldCheck,
      text: t.announcement.returns,
      visibility: "hidden sm:inline-flex",
    },
    {
      icon: BadgeCheck,
      text: t.announcement.cod,
      visibility: "hidden md:inline-flex",
    },
  ] as const;

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
        {items.map(({ icon: Icon, text, visibility }) => (
          <span
            key={text}
            className={`inline-flex items-center gap-2 ${visibility}`}
          >
            <Icon className="size-3.5 text-accent/85" strokeWidth={1.6} />
            <span className="text-bg/90">{text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
