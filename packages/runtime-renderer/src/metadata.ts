import type { DraftDocument } from "@platform/builder-schema";
import { pickLocale } from "./helpers";

/**
 * Build Next.js `Metadata` for a draft / published product.
 *
 * Output shape is intentionally framework-agnostic — apps/studio
 * (Next.js) imports `buildPageMetadata` and assigns the result to
 * `export const metadata`, but the same shape works for any other
 * framework that consumes plain objects.
 *
 * # Picks
 *
 *   • `title`       ← meta.title
 *   • `description` ← meta.description (or first Hero subtitle)
 *   • `ogImage`     ← meta.ogImage OR first Hero media OR first Gallery item
 *   • `keywords`    ← meta.keywords (joined as comma list)
 */

export interface PageMetadata {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  keywords?: string[];
  locale?: string;
}

export function buildPageMetadata(
  doc: DraftDocument,
  opts: { primary?: "ar" | "en" } = {},
): PageMetadata {
  const primary = opts.primary ?? "ar";
  const title = pickLocale(doc.meta.title, primary);

  let description = pickLocale(doc.meta.description, primary);
  if (!description) {
    const hero = doc.sections.find((s) => s.kind === "hero");
    if (hero && hero.kind === "hero") {
      description = pickLocale(hero.subtitle, primary);
    }
  }

  let ogImage = doc.meta.ogImage;
  if (!ogImage) {
    const hero = doc.sections.find((s) => s.kind === "hero");
    if (hero && hero.kind === "hero" && hero.media) {
      ogImage = hero.media.desktopSrc;
    }
  }
  if (!ogImage) {
    const gallery = doc.sections.find((s) => s.kind === "image_gallery");
    if (gallery && gallery.kind === "image_gallery" && gallery.items.length > 0) {
      ogImage = gallery.items[0].desktopSrc;
    }
  }

  return {
    title,
    description: description || undefined,
    ogTitle: title,
    ogDescription: description || undefined,
    ogImage,
    keywords: doc.meta.keywords.length > 0 ? doc.meta.keywords.slice() : undefined,
    locale: primary === "ar" ? "ar_SA" : "en_US",
  };
}
