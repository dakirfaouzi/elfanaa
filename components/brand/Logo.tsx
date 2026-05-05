"use client";

import Link from "next/link";
import { useLocale } from "@/hooks/useLocale";
import { siteConfig } from "@/data/site";
import { pickLocalized } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { Wordmark } from "./Wordmark";
import { Flourish } from "./Flourish";
import {
  DEFAULT_TAGLINE_MODE,
  LOGO_SCALE,
  type LogoSize,
  type LogoTone,
  type LogoVariant,
  type TaglineMode,
} from "./brand.config";

type Props = {
  /**
   * Brand presentation:
   *   • `primary`   — mark + wordmark (+ tagline in stacked/inline mode).
   *                   The "full" lockup. Use in the hero, footer, and any
   *                   editorial brand moment.
   *   • `secondary` — wordmark only. Use in the header (paired with the
   *                   mark via `withMark`), navigation bars, and tight UI.
   *   • `icon`      — mark only. Use for favicons, app tiles, loading
   *                   states, and very small surfaces.
   */
  variant?: LogoVariant;
  /** Visual scale — `md` matches the header, `lg/xl` are hero/about. */
  size?: LogoSize;
  /**
   * Override the variant's default tagline placement.
   *
   *   • `auto`     — the default for the variant (primary→stacked, others→hidden).
   *   • `stacked`  — wordmark on top, tagline beneath (Hero pattern).
   *   • `inline`   — wordmark + flourish + tagline on a single row (Footer pattern).
   *   • `hidden`   — never show the tagline.
   */
  tagline?: TaglineMode;
  /**
   * Optional classes applied to the tagline element. Common pattern:
   * `"hidden md:inline"` so the tagline rides along on desktop only.
   */
  taglineClassName?: string;
  /**
   * `light` flips the wordmark to alabaster and softens the mark/tagline
   * so the lockup reads on dark/photo backgrounds (the homepage hero).
   * `auto` (default) inherits brand ink for use on alabaster surfaces,
   * and paints the mark + tagline in rose copper.
   */
  tone?: LogoTone;
  /** Render as a non-link — for use inside h1s, OG renders, etc. */
  asStatic?: boolean;
  /**
   * Pair the wordmark with the mark, even on the `secondary` variant.
   * Defaults to `true` for `primary`, `false` for `secondary`.
   */
  withMark?: boolean;
  className?: string;
};

/**
 * The FANAA brand lockup.
 *
 * Why a dedicated component:
 *   • The brand surface needs to feel *identical* across the header,
 *     footer, hero, and OG image. One component = zero drift.
 *   • Locale-aware typography: Amiri (classical Naskh) for Arabic,
 *     Cormorant Garamond (small-caps tracking) for Latin.
 *   • Variant + tagline modes keep the brand-tagline pairing consistent
 *     without forking layout code at the call site.
 *
 * The mark sits on the *optical baseline* of the wordmark — a small
 * detail premium brands always get right. The tagline pairs with a
 * decorative flourish (`<Flourish />`) when stacked, mirroring the
 * master logo's two-rule ornament.
 */
export function Logo({
  variant = "primary",
  size = "md",
  tagline = "auto",
  taglineClassName,
  tone = "auto",
  asStatic = false,
  withMark,
  className,
}: Props) {
  const { locale } = useLocale();
  const scale = LOGO_SCALE[size];
  const wordmarkText = pickLocalized(siteConfig.name, locale);
  const taglineText = pickLocalized(siteConfig.tagline, locale);
  const isArabic = locale === "ar";

  // Resolve tagline + mark visibility from variant + explicit overrides.
  const taglineMode: TaglineMode =
    tagline === "auto" ? DEFAULT_TAGLINE_MODE[variant] : tagline;
  const showMark = withMark ?? variant !== "secondary";
  const showWordmark = variant !== "icon";
  const showTagline = taglineMode !== "hidden" && variant !== "icon";

  const taglineClass = cn(
    "font-medium leading-snug",
    scale.taglineClass,
    tone === "light" ? "text-bg/70" : "text-accent",
    // Arabic doesn't benefit from uppercase tracking — it actively hurts
    // legibility. Latin gets the small-caps register.
    isArabic ? "tracking-normal" : "uppercase tracking-[0.16em]"
  );

  const markEl = showMark && (
    <BrandMark
      size={scale.markPx}
      className={tone === "light" ? "text-bg" : "text-accent"}
      aria-hidden
    />
  );

  let inner: React.ReactNode;
  if (showWordmark && taglineMode === "stacked" && showTagline) {
    // Stacked = the master-logo composition: mark on top, wordmark below,
    // flourish, then tagline. Aligned to text-start so it sits flush with
    // the hero copy (left in LTR, right in RTL) — no awkward float against
    // start-aligned siblings.
    inner = (
      <span
        className={cn(
          "inline-flex flex-col items-start leading-none",
          // Flex-col already maps `gap-*` to row spacing; no need to
          // rewrite to `gap-y-*`. Keeping the same scale token means
          // header gap and stacked vertical gap stay in sync.
          scale.gapClass,
          className
        )}
      >
        {markEl}
        <Wordmark size={size} tone={tone} />
        {/*
          The flourish appears from `md` upward — on tight mobile screens
          it's visual noise, on desktop it's a brand cue. `taglineClassName`
          is forwarded so callers can hide tagline + flourish together.
        */}
        <Flourish
          width={scale.flourishWidthPx}
          className={cn(
            "mt-3 hidden md:block",
            tone === "light" && "text-bg/40",
            taglineClassName
          )}
        />
        <span
          className={cn(
            scale.taglineSpacingClass,
            taglineClass,
            taglineClassName
          )}
        >
          {taglineText}
        </span>
      </span>
    );
  } else if (showWordmark && taglineMode === "inline" && showTagline) {
    // Inline = footer pattern. Mark + (wordmark + em-dash + tagline) on a
    // single row, with the tagline collapsing on small screens via
    // `taglineClassName` so the em-dash never orphans.
    inner = (
      <span
        className={cn("inline-flex items-center", scale.gapClass, className)}
      >
        {markEl}
        <span className="inline-flex flex-wrap items-baseline gap-x-2 leading-none">
          <Wordmark size={size} tone={tone} />
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
    // Default = horizontal mark + wordmark (header pattern). When the
    // wordmark is hidden (icon variant), only the mark renders.
    inner = (
      <span
        className={cn("inline-flex items-center", scale.gapClass, className)}
      >
        {markEl}
        {showWordmark && <Wordmark size={size} tone={tone} />}
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
