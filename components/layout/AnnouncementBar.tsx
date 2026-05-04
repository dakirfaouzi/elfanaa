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
    <div className="bg-ink text-bg">
      <div className="mx-auto flex h-9 max-w-[1440px] items-center justify-center gap-6 px-4 text-[12px] tracking-wide md:gap-10">
        {items.map(({ icon: Icon, text, visibility }) => (
          <span
            key={text}
            className={`inline-flex items-center gap-2 ${visibility}`}
          >
            <Icon className="size-3.5 opacity-80" strokeWidth={1.6} />
            <span>{text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
