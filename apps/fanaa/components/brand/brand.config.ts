/**
 * FANAA — Brand identity rules (single source of truth).
 *
 * Everything that describes *how* the brand should be presented lives
 * here. The components in this folder consume these constants; one file
 * to touch when typography, sizes, or spacing rules need to evolve.
 *
 * Usage rules — recap of the brand surfaces:
 *   • Header:  use the simplified primary lockup (mark + wordmark, tagline
 *              hidden on mobile, visible from `md` upward).
 *   • Footer:  use the full primary lockup (mark + wordmark + inline
 *              tagline). The footer is a brand moment, not a nav strip.
 *   • Hero:    use the full primary lockup with the *stacked* tagline,
 *              `tone="light"` for legibility on photography.
 *   • Favicon: the icon-only variant (mark) at `app/icon.svg`.
 *   • Body copy: NEVER place the lockup mid-flow — refer to "فناء" as
 *              text, never as an inline image.
 *   • Co-branding: leave clearspace ≥ the height of the mark on every
 *              side. Never crop, recolour outside the approved palette,
 *              or apply drop shadows.
 *
 * Minimum sizes (don't go below these — fidelity collapses):
 *   • Primary lockup (mark + wordmark): 96px wide.
 *   • Mark only: 16px (favicon limit).
 *   • Wordmark only: 64px wide.
 *
 * Approved palette tokens (see `styles/tokens.css`):
 *   • Wordmark on light surfaces  → `text-ink`
 *   • Wordmark on dark surfaces   → `text-bg`
 *   • Mark + tagline + flourish   → `text-accent` (rose copper)
 *
 * Forbidden:
 *   • Outlining the wordmark.
 *   • Adding gradients to the mark.
 *   • Rotating, skewing, or italicising the lockup.
 *   • Replacing the Arabic wordmark with a transliteration mid-paragraph.
 */

/** Render variants exposed by `<Logo />`. */
export type LogoVariant = "primary" | "secondary" | "icon";

/** Visual scale exposed by `<Logo />`. */
export type LogoSize = "sm" | "md" | "lg" | "xl";

/** Tagline placement relative to the wordmark. */
export type TaglineMode = "auto" | "stacked" | "inline" | "hidden";

/** Surface tone — lets a single component live on cream and on photo BGs. */
export type LogoTone = "auto" | "light";

/**
 * Per-size scale knobs. Single source of truth for header / footer / hero
 * sizing — change once, propagate everywhere.
 *
 * `gap` is the inline spacing between mark and wordmark; tracked in
 * Tailwind classes so it inherits design-token spacing.
 */
export const LOGO_SCALE: Record<
  LogoSize,
  {
    wordmarkClass: string;
    markPx: number;
    taglineClass: string;
    gapClass: string;
    latinTrackingClass: string;
    taglineSpacingClass: string;
    flourishWidthPx: number;
  }
> = {
  sm: {
    wordmarkClass: "text-base md:text-lg",
    markPx: 20,
    taglineClass: "text-[10px] md:text-[11px]",
    gapClass: "gap-2",
    latinTrackingClass: "tracking-[0.18em]",
    taglineSpacingClass: "mt-1",
    flourishWidthPx: 64,
  },
  md: {
    wordmarkClass: "text-xl md:text-[22px]",
    markPx: 26,
    taglineClass: "text-[11px] md:text-xs",
    gapClass: "gap-2.5",
    latinTrackingClass: "tracking-[0.2em]",
    taglineSpacingClass: "mt-1.5",
    flourishWidthPx: 88,
  },
  lg: {
    wordmarkClass: "text-3xl md:text-4xl",
    markPx: 36,
    taglineClass: "text-xs md:text-sm",
    gapClass: "gap-3.5",
    latinTrackingClass: "tracking-[0.22em]",
    taglineSpacingClass: "mt-2",
    flourishWidthPx: 128,
  },
  xl: {
    wordmarkClass: "text-4xl md:text-5xl",
    markPx: 48,
    taglineClass: "text-sm md:text-base",
    gapClass: "gap-4",
    latinTrackingClass: "tracking-[0.22em]",
    taglineSpacingClass: "mt-2.5",
    flourishWidthPx: 160,
  },
} as const;

/**
 * Default tagline placement per variant. Overridable via the `tagline`
 * prop — `"auto"` resolves to one of these.
 */
export const DEFAULT_TAGLINE_MODE: Record<LogoVariant, TaglineMode> = {
  primary: "stacked",
  secondary: "hidden",
  icon: "hidden",
};

/**
 * Minimum render sizes — UI lints / Storybook stories can read these
 * to flag undersized usage in components.
 */
export const LOGO_MIN_SIZE_PX = {
  primary: 96,
  secondary: 64,
  icon: 16,
} as const;
