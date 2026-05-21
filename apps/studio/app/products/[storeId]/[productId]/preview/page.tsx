import { notFound } from "next/navigation";
import Link from "next/link";
import { NavBar } from "@/app/_components/NavBar";
import { readProduct } from "@/lib/studio/product-loader";
import {
  buildHeroProps,
  buildGalleryProps,
  buildBenefitsProps,
  buildIngredientsProps,
  buildReviewsProps,
  buildFaqProps,
  buildOfferTiersProps,
} from "@/lib/studio/preview-props";
import { Hero } from "@/app/_components/preview/Hero";
import { Gallery } from "@/app/_components/preview/Gallery";
import { Benefits } from "@/app/_components/preview/Benefits";
import { Ingredients } from "@/app/_components/preview/Ingredients";
import { Reviews } from "@/app/_components/preview/Reviews";
import { Faq } from "@/app/_components/preview/Faq";
import { OfferTiers } from "@/app/_components/preview/OfferTiers";

export const dynamic = "force-dynamic";

/**
 * Isolated preview renderer.
 *
 * Renders ONLY the customer-facing sections in the order a PDP would
 * typically present them — hero → offer tiers → benefits → ingredients
 * → reviews → FAQ → gallery. No taxonomy, no provenance, no debug
 * scaffolding. Used by the operator to visually QA the bundle before
 * publishing.
 *
 * # Hard isolation rule
 *
 * This page does NOT import from apps/fanaa. It uses ONLY the M3
 * UniversalProduct shape and the M8 preview components, both of
 * which live inside `apps/studio/`. That keeps M8 honest about the
 * "preview-only, no storefront integration" constraint.
 *
 * # Future
 *
 * M9 wires a richer preview that mounts the apps/fanaa PDP component
 * tree in-memory (PLATFORM.md §10 "FanaaPublisher.preview"). M8 ships
 * the simpler version — same content, Studio-native chrome.
 */
export default async function PreviewPage(props: {
  params: Promise<{ storeId: string; productId: string }>;
}) {
  const { storeId, productId } = await props.params;
  const result = await readProduct(storeId, productId);

  if (result.status !== "ok") notFound();

  const bundle = result.bundle;
  const product = bundle.universalProduct;
  const fanaa = bundle.fanaaExtension;
  const offerTiers = buildOfferTiersProps(fanaa);

  return (
    <div className="shell">
      <NavBar active="products" />
      <main className="shell-main">
        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Link
            href={`/products/${encodeURIComponent(storeId)}/${encodeURIComponent(productId)}`}
            style={{ fontSize: 12, color: "var(--text-faint)" }}
          >
            ← Back to detail
          </Link>
          <h1
            style={{
              margin: 0,
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: "clamp(22px, 3vw, 28px)",
              letterSpacing: -0.4,
            }}
          >
            Preview
          </h1>
          <span className="text-dim" style={{ fontSize: 13 }}>
            Studio-native render. Storefront integration arrives in M9.
          </span>
        </header>

        <Hero props={buildHeroProps(product, fanaa)} />
        {offerTiers && <OfferTiers props={offerTiers} />}
        <Benefits props={buildBenefitsProps(product)} />
        <Ingredients props={buildIngredientsProps(product)} />
        <Reviews props={buildReviewsProps(product)} />
        <Faq props={buildFaqProps(product)} />
        <Gallery props={buildGalleryProps(product)} />
      </main>
    </div>
  );
}
