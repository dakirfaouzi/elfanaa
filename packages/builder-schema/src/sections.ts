import { z } from "zod";
import { MediaRefSchema } from "./media";

/**
 * The 10 canonical Studio section types (M11 brief).
 *
 *   1. Hero
 *   2. Benefits
 *   3. BeforeAfter
 *   4. Testimonials
 *   5. CTA
 *   6. FAQ
 *   7. StickyCTA
 *   8. Video
 *   9. ImageGallery
 *  10. RichText
 *
 * # Design rules these schemas follow
 *
 * - **Single discriminated union** keyed by `kind`. The reducer, the
 *   runtime renderer, and the section editor all switch on `kind`.
 *   Adding a new section type means: add a new variant here, add an
 *   editor component, add a renderer component, ship.
 *
 * - **Every section carries a stable `id`** (ULID-ish, 26 chars).
 *   The id is generated at insert time and never changes — it's
 *   what the reducer uses to address sections during reorder /
 *   duplicate / delete operations.
 *
 * - **Every section carries `enabled` (bool)** so operators can
 *   hide a section without deleting it. The runtime renderer
 *   skips disabled sections entirely.
 *
 * - **Field caps are conservative** (titles ≤ 200, body ≤ 2000,
 *   array sizes ≤ 50). These match what the AI pipeline emits
 *   and what the runtime renderer can lay out without breaking
 *   on mobile.
 *
 * - **Empty media slots are NOT allowed** — sections that take a
 *   media reference store `null` when empty. This makes the
 *   reducer + renderer treat "no media" uniformly.
 *
 * # Why no rich HTML
 *
 * The RichText section stores plain text with optional **bold**
 * markers (markdown-lite). The runtime renderer escapes anything
 * else. We DO NOT accept arbitrary HTML — XSS risk, SSR
 * mismatch risk, store-mode-incompatibility risk.
 */

const SectionId = z.string().min(1).max(64);

const LocalisedTextSchema = z.object({
  ar: z.string().max(2000).optional(),
  en: z.string().max(2000).optional(),
});
export type LocalisedText = z.infer<typeof LocalisedTextSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 1. Hero
// ─────────────────────────────────────────────────────────────────────────

export const HeroSectionSchema = z.object({
  id: SectionId,
  kind: z.literal("hero"),
  enabled: z.boolean().default(true),
  title: LocalisedTextSchema,
  subtitle: LocalisedTextSchema.optional(),
  ctaLabel: LocalisedTextSchema.optional(),
  ctaHref: z.string().max(2048).optional(),
  media: MediaRefSchema.nullable().default(null),
  /** "left" | "center" — used by the renderer for layout. */
  align: z.enum(["left", "center"]).default("center"),
});
export type HeroSection = z.infer<typeof HeroSectionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 2. Benefits
// ─────────────────────────────────────────────────────────────────────────

const BenefitItemSchema = z.object({
  id: SectionId,
  icon: z.string().max(64).optional(),
  title: LocalisedTextSchema,
  body: LocalisedTextSchema.optional(),
});
export type BenefitItem = z.infer<typeof BenefitItemSchema>;

export const BenefitsSectionSchema = z.object({
  id: SectionId,
  kind: z.literal("benefits"),
  enabled: z.boolean().default(true),
  eyebrow: LocalisedTextSchema.optional(),
  title: LocalisedTextSchema.optional(),
  items: z.array(BenefitItemSchema).max(12).default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
});
export type BenefitsSection = z.infer<typeof BenefitsSectionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 3. BeforeAfter
// ─────────────────────────────────────────────────────────────────────────

const BeforeAfterPairSchema = z.object({
  id: SectionId,
  before: MediaRefSchema,
  after: MediaRefSchema,
  caption: LocalisedTextSchema.optional(),
});
export type BeforeAfterPair = z.infer<typeof BeforeAfterPairSchema>;

export const BeforeAfterSectionSchema = z.object({
  id: SectionId,
  kind: z.literal("before_after"),
  enabled: z.boolean().default(true),
  title: LocalisedTextSchema.optional(),
  pairs: z.array(BeforeAfterPairSchema).max(8).default([]),
  /** "side_by_side" | "stacked" — desktop layout hint. */
  layout: z.enum(["side_by_side", "stacked"]).default("side_by_side"),
});
export type BeforeAfterSection = z.infer<typeof BeforeAfterSectionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 4. Testimonials
// ─────────────────────────────────────────────────────────────────────────

const TestimonialItemSchema = z.object({
  id: SectionId,
  author: z.string().max(160),
  city: z.string().max(80).optional(),
  rating: z
    .number()
    .min(1)
    .max(5)
    .optional(),
  quote: LocalisedTextSchema,
  avatar: MediaRefSchema.nullable().default(null),
});
export type TestimonialItem = z.infer<typeof TestimonialItemSchema>;

export const TestimonialsSectionSchema = z.object({
  id: SectionId,
  kind: z.literal("testimonials"),
  enabled: z.boolean().default(true),
  title: LocalisedTextSchema.optional(),
  items: z.array(TestimonialItemSchema).max(20).default([]),
  display: z.enum(["grid", "carousel"]).default("grid"),
});
export type TestimonialsSection = z.infer<typeof TestimonialsSectionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 5. CTA
// ─────────────────────────────────────────────────────────────────────────

export const CtaSectionSchema = z.object({
  id: SectionId,
  kind: z.literal("cta"),
  enabled: z.boolean().default(true),
  title: LocalisedTextSchema,
  subtitle: LocalisedTextSchema.optional(),
  primaryLabel: LocalisedTextSchema,
  primaryHref: z.string().max(2048),
  secondaryLabel: LocalisedTextSchema.optional(),
  secondaryHref: z.string().max(2048).optional(),
  variant: z.enum(["solid", "outline", "soft"]).default("solid"),
});
export type CtaSection = z.infer<typeof CtaSectionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 6. FAQ
// ─────────────────────────────────────────────────────────────────────────

const FaqItemSchema = z.object({
  id: SectionId,
  question: LocalisedTextSchema,
  answer: LocalisedTextSchema,
});
export type FaqItem = z.infer<typeof FaqItemSchema>;

export const FaqSectionSchema = z.object({
  id: SectionId,
  kind: z.literal("faq"),
  enabled: z.boolean().default(true),
  title: LocalisedTextSchema.optional(),
  items: z.array(FaqItemSchema).max(30).default([]),
});
export type FaqSection = z.infer<typeof FaqSectionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 7. StickyCTA — appears as a fixed bar at the bottom on mobile
// ─────────────────────────────────────────────────────────────────────────

export const StickyCtaSectionSchema = z.object({
  id: SectionId,
  kind: z.literal("sticky_cta"),
  enabled: z.boolean().default(true),
  label: LocalisedTextSchema,
  href: z.string().max(2048),
  /** Bottom offset (px). Mostly 0; >0 when there's a chat widget. */
  bottomOffsetPx: z.number().int().min(0).max(200).default(0),
});
export type StickyCtaSection = z.infer<typeof StickyCtaSectionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 8. Video
// ─────────────────────────────────────────────────────────────────────────

export const VideoSectionSchema = z.object({
  id: SectionId,
  kind: z.literal("video"),
  enabled: z.boolean().default(true),
  title: LocalisedTextSchema.optional(),
  media: MediaRefSchema.nullable().default(null),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
  muted: z.boolean().default(true),
  controls: z.boolean().default(true),
});
export type VideoSection = z.infer<typeof VideoSectionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 9. ImageGallery
// ─────────────────────────────────────────────────────────────────────────

export const ImageGallerySectionSchema = z.object({
  id: SectionId,
  kind: z.literal("image_gallery"),
  enabled: z.boolean().default(true),
  title: LocalisedTextSchema.optional(),
  items: z.array(MediaRefSchema).max(24).default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
});
export type ImageGallerySection = z.infer<typeof ImageGallerySectionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 10. RichText (markdown-lite)
// ─────────────────────────────────────────────────────────────────────────

export const RichTextSectionSchema = z.object({
  id: SectionId,
  kind: z.literal("rich_text"),
  enabled: z.boolean().default(true),
  body: LocalisedTextSchema,
  /** "narrow" | "wide" — column width hint. */
  width: z.enum(["narrow", "wide"]).default("narrow"),
});
export type RichTextSection = z.infer<typeof RichTextSectionSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Discriminated union
// ─────────────────────────────────────────────────────────────────────────

export const SectionSchema = z.discriminatedUnion("kind", [
  HeroSectionSchema,
  BenefitsSectionSchema,
  BeforeAfterSectionSchema,
  TestimonialsSectionSchema,
  CtaSectionSchema,
  FaqSectionSchema,
  StickyCtaSectionSchema,
  VideoSectionSchema,
  ImageGallerySectionSchema,
  RichTextSectionSchema,
]);

export type Section = z.infer<typeof SectionSchema>;

export const SectionKindSchema = z.enum([
  "hero",
  "benefits",
  "before_after",
  "testimonials",
  "cta",
  "faq",
  "sticky_cta",
  "video",
  "image_gallery",
  "rich_text",
]);

export type SectionKind = z.infer<typeof SectionKindSchema>;

/** Human-readable section names for the picker UI. */
export const SECTION_LABELS: Record<SectionKind, string> = {
  hero: "Hero",
  benefits: "Benefits",
  before_after: "Before / After",
  testimonials: "Testimonials",
  cta: "Call to Action",
  faq: "FAQ",
  sticky_cta: "Sticky CTA",
  video: "Video",
  image_gallery: "Image Gallery",
  rich_text: "Rich Text",
};

/** Section kinds that produce visible content on the storefront.
 *  StickyCTA is excluded from the main vertical flow — it renders
 *  separately as an overlay. */
export const STICKY_KINDS: ReadonlySet<SectionKind> = new Set<SectionKind>([
  "sticky_cta",
]);
