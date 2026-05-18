import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductBenefits } from "@/components/product/ProductBenefits";
import { ProductLifestyle } from "@/components/product/ProductLifestyle";
import { ProductReviews } from "@/components/product/ProductReviews";
import { ProductFAQ } from "@/components/product/ProductFAQ";
import { ProductIngredients } from "@/components/product/ProductIngredients";
import { ProductDetails } from "./ProductDetails";
import { RelatedProducts } from "@/components/sections/RelatedProducts";
import { getProductBySlug, getRelatedProducts, products } from "@/data/products";
import { pickLocalized } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

/*
 * Static params exclude products with a bespoke `landingPath`
 * (e.g. Sugarbear → /sugarbear). Those routes own their canonical URL
 * and the generic PDP is collapsed onto them via:
 *   • next.config.mjs `redirects()`  → edge 308 (preferred path)
 *   • runtime `permanentRedirect()`  → safety net inside this route
 * Pre-rendering the dynamic page for them would just waste a static
 * shell that nobody can ever actually see.
 */
export function generateStaticParams() {
  return products
    .filter((p) => !p.landingPath)
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
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
      images: product.images.map((i) => i.src),
    },
  };
}

/**
 * Product Detail Page — the funnel's main conversion surface.
 *
 * Composition order is deliberate (premium DTC playbook — Article, Aesop,
 * Goop, Public Goods):
 *
 *   1. Gallery + Details  — the buyer needs to see the piece *and* the
 *                           offer in the same scroll. Side-by-side on
 *                           desktop, stacked on mobile.
 *   2. Benefits           — translates features into emotional outcomes.
 *   3. Lifestyle          — alternating image/text band; sells the vibe.
 *   4. Reviews            — qualitative + quantitative social proof.
 *   5. FAQ                — handles objections in line.
 *   6. Related products   — keeps the customer in the catalog if they
 *                           weren't ready to buy *this* SKU yet.
 */
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
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
   */
  if (product.landingPath) {
    permanentRedirect(product.landingPath);
  }

  const related = getRelatedProducts(product.id);

  return (
    <div className="pb-24 md:pb-0">
      <Container>
        <div className="grid gap-10 pb-10 pt-6 sm:pt-8 md:grid-cols-2 md:gap-12 md:py-16 lg:gap-16 lg:py-20">
          <ProductGallery product={product} />
          <ProductDetails product={product} />
        </div>
      </Container>

      <ProductBenefits product={product} />

      <ProductIngredients product={product} />

      <ProductLifestyle product={product} />

      <ProductReviews product={product} />

      <ProductFAQ product={product} />

      <RelatedProducts products={related} />
    </div>
  );
}
