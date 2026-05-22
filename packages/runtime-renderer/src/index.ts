/**
 * @platform/runtime-renderer — public API.
 *
 * Server-safe React renderer for DraftDocument / PublishedProduct
 * snapshots. Used by:
 *
 *   • apps/studio — /p/[slug] route + builder preview pane
 *   • apps/fanaa — wired in M12+ when the operator opts in
 *
 * Stylesheet:  `import "@platform/runtime-renderer/css"` to opt in
 * to the small responsive layer; layouts otherwise rely on inline
 * styles emitted by the section components.
 */

export { DraftRenderer } from "./DraftRenderer";
export type { DraftRendererProps } from "./DraftRenderer";
export { Media } from "./Media";
export type { MediaProps } from "./Media";
export {
  renderSection,
  HeroRenderer,
  BenefitsRenderer,
  BeforeAfterRenderer,
  TestimonialsRenderer,
  CtaRenderer,
  FaqRenderer,
  StickyCtaRenderer,
  VideoRenderer,
  ImageGalleryRenderer,
  RichTextRenderer,
} from "./sections";
export { buildPageMetadata } from "./metadata";
export type { PageMetadata } from "./metadata";
export { pickLocale, hasText, dirForLocale, cls } from "./helpers";
