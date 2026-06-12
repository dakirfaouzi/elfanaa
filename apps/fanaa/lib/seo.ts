import type { Metadata } from "next";
import { siteConfig } from "@/data/site";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { pickLocalized } from "@/lib/format";
import type { Locale } from "@/lib/types";

/**
 * Centralised SEO / metadata builder.
 *
 * All routes pull from here so the brand reads identically on Google,
 * WhatsApp link previews, X/Twitter cards, and Facebook OG. Each route
 * may override `title` / `description` / images via `pageMetadata({...})`.
 *
 * Why a builder (not a constant):
 *   • The metadata depends on `siteConfig` AND the active locale.
 *   • Per-page overrides need to compose with brand defaults.
 *   • Keeping it pure makes it trivially testable.
 */

type PageMetadataInput = {
  /** Page-specific title segment — composed as `{title} · FANAA`. */
  title?: string;
  /** Override the brand description for this page. */
  description?: string;
  /** Override the canonical path for this page. */
  path?: string;
  /**
   * Override the OG image for this page. When omitted, Next.js's file
   * convention (`app/opengraph-image.tsx`) generates a brand-coherent
   * card on the edge — no need to ship a static asset.
   */
  image?: string;
  /** Locale used to pick name/tagline/promise strings. */
  locale?: Locale;
};

export function pageMetadata(input: PageMetadataInput = {}): Metadata {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const brand = pickLocalized(siteConfig.name, locale);
  const tagline = pickLocalized(siteConfig.tagline, locale);
  const promise = pickLocalized(siteConfig.promise, locale);

  const fullTitle = input.title
    ? `${input.title} · ${brand}`
    : `${brand} — ${tagline}`;
  const description = input.description ?? promise;
  const canonical = input.path ?? "/";

  // Only set explicit image arrays when the caller passed one — otherwise
  // we'd shadow the file-based `app/opengraph-image.tsx` route, which
  // Next.js auto-discovers as a brand-coherent default.
  const explicitImage = input.image
    ? [{ url: input.image, width: 1200, height: 630, alt: brand }]
    : undefined;

  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: fullTitle, template: `%s · ${brand}` },
    description,
    applicationName: brand,
    keywords: keywordsFor(locale),
    alternates: {
      canonical,
      languages: {
        "ar-SA": canonical,
        "en-SA": canonical,
        "x-default": canonical,
      },
    },
    openGraph: {
      type: "website",
      siteName: brand,
      title: fullTitle,
      description,
      url: canonical,
      locale: locale === "ar" ? "ar_SA" : "en_SA",
      ...(explicitImage && { images: explicitImage }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(input.image && { images: [input.image] }),
    },
    /*
     * Favicons:
     *
     * The canonical mark lives at `app/icon.png` (with `app/apple-icon.png`
     * for iOS). Next.js's file-based icon convention auto-injects them as
     * `<link rel="icon">` / `<link rel="apple-touch-icon">` — DO NOT pass
     * `icons` here, because the Metadata API would *override* the file
     * convention and silently drop them.
     */
    robots: { index: true, follow: true },
  };
}

/**
 * Site-wide brand keywords. Tuned for KSA Health & Beauty search intent —
 * short, specific, and reflective of the brand's positioning around
 * lab-tested skincare, men's grooming, and women's haircare for the
 * Arabian Peninsula climate.
 */
function keywordsFor(locale: Locale): string[] {
  const ar = [
    "فناء",
    "عناية بالبشرة السعودية",
    "سيروم تفتيح",
    "علاج التبقّع",
    "زيت لحية",
    "عناية رجالية",
    "قناع شعر مرطب",
    "منتجات تجميل للرجال والنساء",
    "مستحضرات تجميل ادفع عند الاستلام",
    "عناية البشرة المناخ السعودي",
  ];
  const en = [
    "Fanaa",
    "Saudi skincare",
    "KSA beauty",
    "dark spot serum Saudi",
    "men's beard oil KSA",
    "deep hair mask Saudi",
    "lab tested skincare Arabia",
    "cash on delivery skincare KSA",
    "Saudi men grooming",
    "Arabian climate skincare",
  ];
  return locale === "ar" ? ar : en;
}

/**
 * Sugar — the homepage uses this directly without overrides.
 * Equivalent to `pageMetadata()` but keeps the import sites readable.
 */
export const siteMetadata = (): Metadata => pageMetadata();

/**
 * The `lang` value the App Router places on `<html lang>` — region-tagged
 * so search engines know it's Saudi-specific (ar-SA / en-SA).
 */
export const htmlLangFor = (locale: Locale): string =>
  locale === "ar" ? "ar-SA" : "en-SA";
