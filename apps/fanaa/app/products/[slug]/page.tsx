import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductSections } from "@/components/product/ProductSections";
import { ProductDetails } from "./ProductDetails";
import { RelatedProducts } from "@/components/sections/RelatedProducts";
import { products as snapshotProducts } from "@/lib/catalog/snapshot";
import {
  loadCatalogProductBySlug,
  loadRelatedCatalogProducts,
} from "@/lib/catalog/loader";
import { buildPdpJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";
import { pickLocalized } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

/*
 * ISR window for the PDP. The hybrid catalog loader (M12 / Step 2)
 * overlays operator-edited commerce metadata from
 * `storefront_catalog_product` onto the build-time snapshot, so price
 * / badge / rating / stock edits land within ~60s without a redeploy.
 * If the DB is unreachable the loader returns the snapshot unchanged
 * and the page stays online — same behaviour shipped in Step 1.
 */
export const revalidate = 60;

/*
 * Static params exclude products with a bespoke `landingPath`
 * (e.g. Sugarbear → /sugarbear). Those routes own their canonical URL
 * and the generic PDP is collapsed onto them via:
 *   • next.config.mjs `redirects()`  → edge 308 (preferred path)
 *   • runtime `permanentRedirect()`  → safety net inside this route
 * Pre-rendering the dynamic page for them would just waste a static
 * shell that nobody can ever actually see.
 *
 * NOTE: `generateStaticParams` runs at BUILD TIME, before the live
 * catalog loader can talk to the DB. We deliberately seed it from
 * the snapshot — the snapshot is the authoritative list of curated
 * slugs that need a prerendered shell. Any DB-only AI-generated
 * slugs added later get served via on-demand ISR through the
 * `revalidate` window above; they don't need to be in the
 * prerender manifest.
 */
export function generateStaticParams() {
  return snapshotProducts
    .filter((p) => !p.landingPath)
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadCatalogProductBySlug(slug);
  if (!product) return {};
  // OG metadata uses the brand-language title in English (Arabic at this layer
  // confuses some social previews). The Arabic copy is the on-page experience.
  const title = pickLocalized(product.title, "en");
  const description = pickLocalized(product.description, "en");
  return {
    title,
    description,
    // If this product owns a bespoke landing page, the canonical URL is
    // there — point all search engines at /sugarbear (or whichever path)
    // even if they crawl the legacy /products/<slug> route during the
    // transition window.
    alternates: product.landingPath
      ? { canonical: product.landingPath }
      : undefined,
    openGraph: {
      title,
      description,
      ...(product.landingPath ? { url: product.landingPath } : {}),
      /*
       * OG images must be absolute-resolvable string URLs. We filter
       * out:
       *   • Undefined entries (hardened against legacy / malformed
       *     `product.images` shapes — see ProductGallery for the same
       *     defensive pattern).
       *   • `data:` URLs (the storefront placeholder, when an AI-gen
       *     product hasn't been backfilled with photography yet). OG
       *     scrapers (Facebook, Twitter, Slack) can't resolve data
       *     URLs — emitting them would produce broken previews on
       *     every social share. Better to ship an empty `images`
       *     array and let the scraper fall back to the site-default
       *     OG image than serve a guaranteed-broken thumbnail.
       */
      images: (product.images ?? [])
        .filter((i): i is NonNullable<typeof i> => Boolean(i))
        .map((i) => i.src)
        .filter((src) => !src.startsWith("data:")),
    },
  };
}

/**
 * Product Detail Page — the funnel's main conversion surface.
 *
 * Composition order is deliberate (premium DTC playbook — Article, Aesop,
 * Goop, Public Goods):
 *
 *   1. Gallery + Details  — the commerce shell. The buyer needs to see the
 *                           piece *and* the offer in the same scroll.
 *                           Side-by-side on desktop, stacked on mobile.
 *   2. ProductSections    — the dynamic "story" stack (Step 4 / ADR-S4-1).
 *                           For AI-published products this renders the
 *                           pipeline's chosen section order + grounded
 *                           content (mechanism, results, founder's note,
 *                           comparison, objections, guarantee …). For curated
 *                           products it degrades to the legacy fixed order
 *                           (benefits → ingredients → lifestyle → reviews →
 *                           FAQ) with zero visual change.
 *   3. Related products   — keeps the customer in the catalog if they
 *                           weren't ready to buy *this* SKU yet.
 */
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await loadCatalogProductBySlug(slug);
  if (!product) notFound();

  /*
   * Runtime safety net for the bespoke-landing pattern.
   *
   * The primary redirect lives in `next.config.mjs` (edge-level 308),
   * but we also enforce it here so that:
   *   • Internal navigation never accidentally renders the generic PDP
   *     for a SKU that has a hand-crafted landing page.
   *   • Dev/preview environments where the static redirect rule isn't
   *     yet picked up still collapse to the canonical URL.
   *   • Any future product that opts into `landingPath` is protected
   *     even before its next.config entry ships.
   *
   * `permanentRedirect` emits a true 308, preserving SEO equity.
   *
   * The hybrid catalog loader (M12 / Step 2) treats `landingPath` as
   * commerce metadata that can be edited from Studio without a code
   * deploy. The DB value wins when present, snapshot fallback
   * otherwise — this redirect honours either source.
   */
  if (product.landingPath) {
    permanentRedirect(product.landingPath);
  }

  const related = await loadRelatedCatalogProducts(product.id);

  // Structured data (Sprint B #3) — Product/Offer always; AggregateRating,
  // Review[], and FAQPage only when backed by real data that the page renders.
  const jsonLd = serializeJsonLd(buildPdpJsonLd(product));

  return (
    <div className="pb-24 md:pb-0">
      <script
        type="application/ld+json"
        // Server-rendered, no user-controlled HTML; `<` is escaped in
        // serializeJsonLd so a stray "</script>" can't break out.
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <Container>
        <div className="grid gap-10 pb-10 pt-6 sm:pt-8 md:grid-cols-2 md:gap-12 md:py-16 lg:gap-16 lg:py-20">
          <ProductGallery product={product} />
          <ProductDetails product={product} />
        </div>
      </Container>

      <ProductSections product={product} />

      <RelatedProducts products={related} />
    </div>
  );
}
