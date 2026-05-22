import type { LocalisedText, MediaRef } from "@platform/builder-schema";

/**
 * Renderer helpers.
 *
 * These are PURE FUNCTIONS — no React imports — used by both the
 * server-rendered sections and the metadata builder.
 */

/**
 * Pick a text from a locale pair, preferring the requested locale,
 * falling back to the other locale, then to empty string.
 */
export function pickLocale(
  text: LocalisedText | undefined,
  primary: "ar" | "en",
): string {
  if (!text) return "";
  const p = text[primary];
  if (p && p.trim()) return p;
  const other = primary === "ar" ? text.en : text.ar;
  if (other && other.trim()) return other;
  return "";
}

/**
 * Returns true when a locale-pair text has at least one non-empty
 * value. Used to skip rendering empty headings instead of emitting
 * `<h2></h2>`.
 */
export function hasText(text: LocalisedText | undefined): boolean {
  if (!text) return false;
  return Boolean((text.ar && text.ar.trim()) || (text.en && text.en.trim()));
}

/**
 * Map a media kind to the canonical HTML element used in the
 * runtime renderer.
 */
export function mediaTag(media: MediaRef): "img" | "video" {
  return media.kind === "video" ? "video" : "img";
}

/**
 * RTL detection for an Arabic-first runtime.
 *
 *   • If primary === "ar" → "rtl"
 *   • Otherwise → "ltr"
 *
 * Sections respect this through `dir` props.
 */
export function dirForLocale(primary: "ar" | "en"): "ltr" | "rtl" {
  return primary === "ar" ? "rtl" : "ltr";
}

/**
 * Build a tiny set of CSS class names — kept here so unit tests
 * can assert structure without depending on a global stylesheet.
 *
 * Prefix:
 *   • `pfp-` = platform-renderer
 */
export const cls = {
  page: "pfp-page",
  section: "pfp-section",
  inner: "pfp-inner",
  eyebrow: "pfp-eyebrow",
  title: "pfp-title",
  subtitle: "pfp-subtitle",
  hero: "pfp-hero",
  heroCopy: "pfp-hero__copy",
  heroMedia: "pfp-hero__media",
  benefits: "pfp-benefits",
  benefitsGrid: "pfp-benefits__grid",
  benefitsItem: "pfp-benefits__item",
  beforeAfter: "pfp-before-after",
  pair: "pfp-pair",
  pairFrame: "pfp-pair__frame",
  pairLabel: "pfp-pair__label",
  testimonials: "pfp-testimonials",
  testimonialsGrid: "pfp-testimonials__grid",
  testimonialsItem: "pfp-testimonials__item",
  cta: "pfp-cta",
  ctaBtn: "pfp-cta__btn",
  ctaBtnPrimary: "pfp-cta__btn--primary",
  ctaBtnOutline: "pfp-cta__btn--outline",
  ctaBtnSoft: "pfp-cta__btn--soft",
  faq: "pfp-faq",
  faqItem: "pfp-faq__item",
  sticky: "pfp-sticky",
  stickyBtn: "pfp-sticky__btn",
  video: "pfp-video",
  videoFrame: "pfp-video__frame",
  gallery: "pfp-gallery",
  galleryGrid: "pfp-gallery__grid",
  galleryItem: "pfp-gallery__item",
  richText: "pfp-rich-text",
  richTextNarrow: "pfp-rich-text--narrow",
  richTextWide: "pfp-rich-text--wide",
};
