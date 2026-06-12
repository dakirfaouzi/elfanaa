"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/hooks/useLocale";
import { siteConfig } from "@/data/site";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Flourish } from "./Flourish";
import {
  DEFAULT_TAGLINE_MODE,
  LOGO_SCALE,
  type LogoSize,
  type LogoTone,
  type LogoVariant,
  type TaglineMode,
} from "./brand.config";

/**
 * The brand logo is a horizontal lockup (lotus mark + "فناء" wordmark) in a
 * single transparent PNG. Its intrinsic pixels drive the aspect ratio; we
 * fix the rendered HEIGHT per size token and let the width scale, so the
 * proportions are never stretched or cropped.
 */
const LOGO_INTRINSIC = { w: 1024, h: 682 } as const;

/**
 * Rendered height per size token, responsive (mobile → desktop). Heights
 * only; width auto-derives from the intrinsic ratio so the lockup is never
 * stretched or cropped. The header sizes (`md`) stay within the existing
 * navbar height — bigger logo, same bar.
 *   • md  → 40px mobile / 56px desktop (header + footer)
 *   • lg  → 56px mobile / 80px desktop (About / brand moments)
 */
const LOGO_DISPLAY: Record<LogoSize, { heightClass: string; sizes: string }> = {
  sm: { heightClass: "h-8 md:h-9", sizes: "(min-width: 768px) 56px, 48px" },
  md: { heightClass: "h-10 md:h-14", sizes: "(min-width: 768px) 90px, 64px" },
  lg: { heightClass: "h-14 md:h-20", sizes: "(min-width: 768px) 124px, 88px" },
  xl: { heightClass: "h-16 md:h-24", sizes: "(min-width: 768px) 150px, 100px" },
};

/** The brand logo asset (transparent PNG) — see `public/brand/logo.png`. */
const BADGE_SRC = "/brand/logo.png";

type Props = {
  /**
   * Brand presentation:
   *   • `primary`   — badge (+ tagline in stacked/inline mode). The "full"
   *                   lockup. Use in the hero, footer, and editorial moments.
   *   • `secondary` — badge only. Use in tight nav bars / UI.
   *   • `icon`      — badge only. Use for app tiles, loading states.
   *
   * The brand badge already contains both the mark and the "فناء" wordmark,
   * so all variants render the same image — the variant only governs whether
   * the tagline rides alongside it.
   */
  variant?: LogoVariant;
  /** Visual scale — `md` matches the header, `lg/xl` are hero/about. */
  size?: LogoSize;
  /**
   * Override the variant's default tagline placement.
   *   • `auto`     — variant default (primary→stacked, others→hidden).
   *   • `stacked`  — badge on top, tagline beneath (Hero/About pattern).
   *   • `inline`   — badge + flourish + tagline on a single row (Footer).
   *   • `hidden`   — never show the tagline.
   */
  tagline?: TaglineMode;
  /** Optional classes applied to the tagline element. */
  taglineClassName?: string;
  /**
   * `light` softens the tagline so the lockup reads on dark/photo
   * backgrounds. The badge artwork itself is fixed-colour (rose-gold +
   * espresso on transparent) and renders identically on any surface.
   */
  tone?: LogoTone;
  /** Render as a non-link — for use inside h1s, OG renders, etc. */
  asStatic?: boolean;
  /** Retained for API compatibility — the badge always carries the mark. */
  withMark?: boolean;
  className?: string;
};

/**
 * The FANAA brand lockup.
 *
 * Renders the horizontal brand lockup (`public/brand/logo.png` — lotus +
 * "فناء") consistently across the header, footer, and About hero so the
 * brand surface feels identical everywhere — one component, zero drift.
 * The tagline pairs with a decorative flourish (`<Flourish />`) when
 * stacked, mirroring the master logo's two-rule ornament.
 */
export function Logo({
  variant = "primary",
  size = "md",
  tagline = "auto",
  taglineClassName,
  tone = "auto",
  asStatic = false,
  withMark: _withMark,
  className,
}: Props) {
  const { locale } = useLocale();
  const scale = LOGO_SCALE[size];
  const wordmarkText = pickLocalized(siteConfig.name, locale);
  const taglineText = pickLocalized(siteConfig.tagline, locale);
  const isArabic = locale === "ar";

  const taglineMode: TaglineMode =
    tagline === "auto" ? DEFAULT_TAGLINE_MODE[variant] : tagline;
  const showTagline = taglineMode !== "hidden" && variant !== "icon";

  const taglineClass = cn(
    "font-medium leading-snug",
    scale.taglineClass,
    tone === "light" ? "text-bg/70" : "text-accent",
    isArabic ? "tracking-normal" : "uppercase tracking-[0.16em]"
  );

  const display = LOGO_DISPLAY[size];
  const badgeEl = (
    <Image
      src={BADGE_SRC}
      alt={wordmarkText}
      width={LOGO_INTRINSIC.w}
      height={LOGO_INTRINSIC.h}
      sizes={display.sizes}
      priority={size === "md"}
      className={cn("inline-block w-auto shrink-0 object-contain", display.heightClass)}
    />
  );

  let inner: React.ReactNode;
  if (taglineMode === "stacked" && showTagline) {
    // Stacked = the master-logo composition: badge on top, flourish, tagline.
    inner = (
      <span
        className={cn(
          "inline-flex flex-col items-start leading-none",
          scale.gapClass,
          className
        )}
      >
        {badgeEl}
        <Flourish
          width={scale.flourishWidthPx}
          className={cn(
            "mt-3 hidden md:block",
            tone === "light" && "text-bg/40",
            taglineClassName
          )}
        />
        <span
          className={cn(scale.taglineSpacingClass, taglineClass, taglineClassName)}
        >
          {taglineText}
        </span>
      </span>
    );
  } else if (taglineMode === "inline" && showTagline) {
    // Inline = footer pattern. Badge + (em-dash + tagline) on a single row.
    inner = (
      <span className={cn("inline-flex items-center", scale.gapClass, className)}>
        {badgeEl}
        <span className="inline-flex flex-wrap items-baseline gap-x-2 leading-none">
          <span
            aria-hidden
            className={cn(
              "select-none text-base/none",
              tone === "light" ? "text-bg/40" : "text-muted/50",
              taglineClassName
            )}
          >
            —
          </span>
          <span className={cn(taglineClass, taglineClassName)}>
            {taglineText}
          </span>
        </span>
      </span>
    );
  } else {
    // Default = badge only (header pattern, icon variant).
    inner = (
      <span className={cn("inline-flex items-center", scale.gapClass, className)}>
        {badgeEl}
      </span>
    );
  }

  if (asStatic) {
    return <span className="inline-block">{inner}</span>;
  }

  return (
    <Link
      href="/"
      aria-label={
        showTagline ? `${wordmarkText} — ${taglineText}` : wordmarkText
      }
      className="inline-block rounded-sm transition-opacity duration-200 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {inner}
    </Link>
  );
}
