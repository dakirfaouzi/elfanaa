import type { DraftDocument, MediaRef, Section } from "@platform/builder-schema";
import { resolveAssetUrl } from "./asset-url";

/**
 * Walk a DraftDocument and return a NEW document where every media src
 * has been translated through `resolveAssetUrl()`.
 *
 * # Why a Studio-side walker (and not a renderer prop)
 *
 * `@platform/runtime-renderer` is a shared package — its `<Media>`
 * component intentionally writes whatever value is in `desktopSrc` into
 * `<img src>` without any branching. Threading a `resolveSrc` callback
 * through every section renderer would force a breaking-ish API change
 * on the shared package, with zero benefit for consumers that already
 * hand it absolute URLs.
 *
 * Instead, the two Studio mount sites (the builder preview pane and the
 * `/p/<slug>` storefront route) run the document through this walker
 * BEFORE passing it to `<DraftRenderer>`. The renderer keeps its
 * "render whatever URL you give me" contract; the resolution policy
 * lives next to the proxy route in the Studio package.
 *
 * # What's resolved
 *
 *   • `meta.ogImage` (string)
 *   • Every `MediaRef.desktopSrc`, `MediaRef.mobileSrc`, `MediaRef.poster`
 *     on these section kinds:
 *       hero          → media
 *       before_after  → pairs[].before, pairs[].after
 *       testimonials  → items[].avatar
 *       video         → media (and media.poster)
 *       image_gallery → items[]
 *
 * Sections without media (`benefits`, `cta`, `faq`, `sticky_cta`,
 * `rich_text`) pass through unchanged.
 *
 * # Immutability
 *
 * The walker returns a fresh object graph; the input document is
 * unchanged. This matters in the builder preview pane where the live
 * draft state is the source of truth — mutating it would break
 * controlled-component invariants.
 */
export function resolveDocumentSrcs(doc: DraftDocument): DraftDocument {
  return {
    ...doc,
    meta:
      doc.meta.ogImage !== undefined && doc.meta.ogImage !== null
        ? { ...doc.meta, ogImage: resolveAssetUrl(doc.meta.ogImage) }
        : doc.meta,
    sections: doc.sections.map(resolveSection),
  };
}

function resolveSection(section: Section): Section {
  switch (section.kind) {
    case "hero":
      return { ...section, media: resolveMediaRefOrNull(section.media) };
    case "before_after":
      return {
        ...section,
        pairs: section.pairs.map((pair) => ({
          ...pair,
          before: resolveMediaRef(pair.before),
          after: resolveMediaRef(pair.after),
        })),
      };
    case "testimonials":
      return {
        ...section,
        items: section.items.map((item) => ({
          ...item,
          avatar: resolveMediaRefOrNull(item.avatar),
        })),
      };
    case "video":
      return { ...section, media: resolveMediaRefOrNull(section.media) };
    case "image_gallery":
      return {
        ...section,
        items: section.items.map(resolveMediaRef),
      };
    // Sections without media — return unchanged.
    case "benefits":
    case "cta":
    case "faq":
    case "sticky_cta":
    case "rich_text":
      return section;
  }
}

/**
 * Resolve every URL-carrying field on a MediaRef. The schema requires
 * `desktopSrc.min(1)`; we preserve that contract by only writing a
 * non-empty value back when the resolver produces one (otherwise the
 * `<img>` would render an empty src, which browsers ignore — but
 * downstream consumers that re-validate the doc would reject).
 *
 * `width`/`height`/`alt`/`assetId` are not URLs, so they pass through.
 */
function resolveMediaRef(media: MediaRef): MediaRef {
  const next: MediaRef = {
    ...media,
    desktopSrc: resolveAssetUrl(media.desktopSrc) || media.desktopSrc,
  };
  if (media.mobileSrc !== undefined) {
    const resolved = resolveAssetUrl(media.mobileSrc);
    if (resolved) next.mobileSrc = resolved;
  }
  if (media.poster !== undefined) {
    const resolved = resolveAssetUrl(media.poster);
    if (resolved) next.poster = resolved;
  }
  return next;
}

function resolveMediaRefOrNull(
  media: MediaRef | null | undefined,
): MediaRef | null {
  if (!media) return null;
  return resolveMediaRef(media);
}
