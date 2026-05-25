import { notFound } from "next/navigation";
import Link from "next/link";
import { NavBar } from "@/app/_components/NavBar";
import { MetaChip } from "@/app/_components/MetaChip";
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
        <PreviewHeader
          storeId={storeId}
          productId={productId}
          slug={product.slug}
          title={product.title.en || product.title.ar || product.slug}
        />

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

/* ─── Header ─────────────────────────────────────────────────── */

/**
 * Preview header — card-style chrome matching the C1/C2 rhythm
 * (`/runs/[runId]`, `/drafts/[draftId]`) so the operator flow reads
 * as one coherent surface.
 *
 * The "View on storefront" link points at the same Studio domain's
 * `/p/<slug>` route — which `@/app/p/[slug]/page.tsx` resolves to the
 * latest current published snapshot for the slug. Opens in a new tab
 * so the operator can compare the Studio preview side-by-side with
 * the live storefront render. `target="_blank"` carries `rel="noopener
 * noreferrer"` per platform-wide hygiene rules.
 *
 * Next.js auto-prefixes basePath on `<Link href>`, so a deployment
 * mounted at `/studio` resolves the link to `/studio/p/<slug>` without
 * extra wiring.
 */
function PreviewHeader(props: {
  storeId: string;
  productId: string;
  slug: string;
  title: string;
}) {
  const detailHref = `/products/${encodeURIComponent(props.storeId)}/${encodeURIComponent(props.productId)}`;
  const storefrontHref = `/p/${encodeURIComponent(props.slug)}`;
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "22px 24px",
        boxShadow:
          "inset 0 1px 0 color-mix(in srgb, var(--text) 4%, transparent)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Link
          href={detailHref}
          style={{
            color: "var(--text-faint)",
            fontSize: 12,
            transition: "color var(--transition-fast) var(--ease-out)",
          }}
        >
          ← Back to detail
        </Link>
        <span className="tag tag-accent">{props.storeId}</span>
        <span
          className="tag"
          title="Studio-native render. Mirrors the storefront PDP."
        >
          Preview
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minWidth: 0,
            flex: "1 1 360px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: "clamp(24px, 3vw, 28px)",
              letterSpacing: "-0.4px",
              lineHeight: 1.15,
              wordBreak: "break-word",
            }}
          >
            {props.title}
          </h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 14px",
              alignItems: "baseline",
              fontSize: 12,
              color: "var(--text-dim)",
              marginTop: 2,
            }}
          >
            <MetaChip label="Slug">
              <code className="code" style={{ fontSize: 11 }}>
                /p/{props.slug}
              </code>
            </MetaChip>
            <MetaChip label="Id">
              <code className="code" style={{ fontSize: 11 }}>
                {props.productId}
              </code>
            </MetaChip>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={storefrontHref}
            className="btn btn-accent"
            target="_blank"
            rel="noopener noreferrer"
            title="Open the live storefront PDP in a new tab for side-by-side comparison"
          >
            View on storefront ↗
          </Link>
          <Link href={detailHref} className="btn">
            Back to detail
          </Link>
        </div>
      </div>
    </header>
  );
}
