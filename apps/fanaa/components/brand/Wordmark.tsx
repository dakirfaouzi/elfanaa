"use client";

import { useLocale } from "@/hooks/useLocale";
import { siteConfig } from "@/data/site";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { LogoSize, LogoTone } from "./brand.config";
import { LOGO_SCALE } from "./brand.config";

type Props = {
  size?: LogoSize;
  tone?: LogoTone;
  className?: string;
};

/**
 * The brand wordmark — "فناء" / "FANAA".
 *
 * Locale-aware typography:
 *   • Arabic uses the classical Naskh display face (`font-arabic-display`),
 *     mapped to **Amiri** in `app/layout.tsx`. The Naskh letterforms
 *     keep the wordmark feeling premium and authentically Arabic, but
 *     the shorter glyph ("فناء" — three letters) reads cleaner in
 *     beauty packaging contexts than the older "الفناء" (five letters).
 *   • Latin uses **Cormorant Garamond** with editorial small-caps tracking
 *     (`0.18–0.22em`). The tracking value scales with size — larger
 *     wordmarks can carry tighter spacing.
 *
 * No outlines, no gradients, no italics. The wordmark is sacred.
 */
export function Wordmark({ size = "md", tone = "auto", className }: Props) {
  const { locale } = useLocale();
  const scale = LOGO_SCALE[size];
  const text = pickLocalized(siteConfig.name, locale);
  const isArabic = locale === "ar";

  return (
    <span
      className={cn(
        "block leading-none",
        scale.wordmarkClass,
        tone === "light" ? "text-bg" : "text-ink",
        // Amiri ships in 400 / 700 only — `font-bold` maps to the
        // weight Amiri actually contains, no synthetic bolding.
        // Cormorant Garamond looks calmest at 600 for the wordmark.
        isArabic
          ? "font-arabic-display font-bold tracking-[0.02em]"
          : `font-display font-semibold ${scale.latinTrackingClass}`,
        className
      )}
    >
      {text}
    </span>
  );
}
