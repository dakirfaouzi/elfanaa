import { notFound } from "next/navigation";
import Link from "next/link";
import { NavBar } from "@/app/_components/NavBar";
import { CorruptedBadge, PublishedBadge } from "@/app/_components/StatusBadge";
import { MetaChip } from "@/app/_components/MetaChip";
import { RelativeTime } from "@/app/_components/RelativeTime";
import { readProduct } from "@/lib/studio/product-loader";
import {
  buildHeroProps,
  buildGalleryProps,
  buildBenefitsProps,
  buildIngredientsProps,
  buildReviewsProps,
  buildFaqProps,
  buildOfferTiersProps,
  buildTaxonomyProps,
  buildNicheProps,
  buildProvenanceProps,
  buildHooksProps,
  buildSpecsProps,
} from "@/lib/studio/preview-props";
import { Hero } from "@/app/_components/preview/Hero";
import { Gallery } from "@/app/_components/preview/Gallery";
import { Benefits } from "@/app/_components/preview/Benefits";
import { Ingredients } from "@/app/_components/preview/Ingredients";
import { Reviews } from "@/app/_components/preview/Reviews";
import { Faq } from "@/app/_components/preview/Faq";
import { OfferTiers } from "@/app/_components/preview/OfferTiers";
import { Specifications } from "@/app/_components/preview/Specifications";
import { Hooks } from "@/app/_components/preview/Hooks";

export const dynamic = "force-dynamic";

/**
 * Product detail — the operator's "is this bundle good?" cockpit.
 *
 * Renders the structured sections (hero, gallery, benefits, ingredients,
 * reviews, FAQ, offer tiers, taxonomy, ad hooks, provenance) plus a
 * link to the isolated `/preview` page (storefront-style render) and
 * the publish-preview action.
 *
 * # Why one page instead of separate tabs
 *
 * The bundle is small enough (kilobytes) that rendering it all once
 * is faster than gating each section behind a tab + roundtrip. The
 * page also doubles as a permalink that survives Studio restarts —
 * operators bookmark these.
 *
 * # Corrupt handling
 *
 * If the bundle file failed to validate, we render a focused error
 * panel with the validation reason instead of crashing. The operator
 * can still see the file path + raw reason to debug.
 */
export default async function ProductDetailPage(props: {
  params: Promise<{ storeId: string; productId: string }>;
}) {
  const { storeId, productId } = await props.params;
  const result = await readProduct(storeId, productId);

  if (result.status === "not_found") notFound();

  if (result.status === "corrupted") {
    return (
      <div className="shell">
        <NavBar active="products" />
        <main className="shell-main">
          <CorruptedHeader storeId={storeId} productId={productId} />
          <section className="section-card">
            <span className="section-eyebrow">Validation failed</span>
            <h2>This bundle could not be loaded.</h2>
            <p className="text-dim" style={{ margin: 0, fontSize: 14 }}>
              The on-disk JSON at{" "}
              <code className="code">{result.filePath}</code> failed validation.
              Reason: <code className="code">{result.reason}</code>.
            </p>
            {result.details && (
              <pre
                style={{
                  background: "var(--bg-elev)",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}
              >
                {result.details}
              </pre>
            )}
          </section>
        </main>
      </div>
    );
  }

  const bundle = result.bundle;
  const product = bundle.universalProduct;
  const fanaa = bundle.fanaaExtension;
  const niche = bundle.beautyWellnessExtension;

  return (
    <div className="shell">
      <NavBar active="products" />
      <main className="shell-main">
        <DetailHeader
          storeId={storeId}
          productId={productId}
          bundle={bundle}
        />
        <Hero props={buildHeroProps(product, fanaa)} />
        <OfferTiersOptional props={buildOfferTiersProps(fanaa)} />
        <TaxonomyCard props={buildTaxonomyProps(fanaa)} />
        <NicheCard props={buildNicheProps(niche)} />
        <Benefits props={buildBenefitsProps(product)} />
        <Ingredients props={buildIngredientsProps(product)} />
        <Specifications props={buildSpecsProps(product)} />
        <Reviews props={buildReviewsProps(product)} />
        <Faq props={buildFaqProps(product)} />
        <Hooks props={buildHooksProps(product)} />
        <Gallery props={buildGalleryProps(product)} />
        <ProvenanceCard props={buildProvenanceProps(product)} />
      </main>
    </div>
  );
}

/* ─── Header + secondary cards (kept local since they're page-specific) ─── */

function DetailHeader(props: {
  storeId: string;
  productId: string;
  bundle: NonNullable<Awaited<ReturnType<typeof readProduct>> & { status: "ok" }>["bundle"];
}) {
  const product = props.bundle.universalProduct;
  const titleEn = product.title.en;
  const titleAr = product.title.ar;
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
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/products"
          style={{
            color: "var(--text-faint)",
            fontSize: 12,
            transition: "color var(--transition-fast) var(--ease-out)",
          }}
        >
          ← Products
        </Link>
        <PublishedBadge />
        <span className="tag tag-accent">{props.storeId}</span>
        <span className="tag">{props.bundle.publisher}</span>
        <span className="tag tag-info">v{props.bundle.bundleVersion}</span>
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
              fontSize: 26,
              letterSpacing: "-0.4px",
              lineHeight: 1.15,
              wordBreak: "break-word",
            }}
          >
            {titleEn || titleAr || product.slug}
          </h1>
          {titleEn && titleAr && (
            <span
              dir="rtl"
              className="text-dim"
              style={{ fontSize: 14, lineHeight: 1.35 }}
            >
              {titleAr}
            </span>
          )}
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
                /p/{product.slug}
              </code>
            </MetaChip>
            <MetaChip label="Id">
              <code className="code" style={{ fontSize: 11 }}>
                {product.id}
              </code>
            </MetaChip>
            {product.niche && (
              <MetaChip label="Niche">
                <span style={{ fontSize: 12 }}>
                  {product.niche.replace(/_/g, " ")}
                </span>
              </MetaChip>
            )}
            {props.bundle.publishedAt && (
              <MetaChip label="Published">
                <RelativeTime
                  value={props.bundle.publishedAt}
                  style={{ fontSize: 12 }}
                />
              </MetaChip>
            )}
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
            href={`/products/${encodeURIComponent(props.storeId)}/${encodeURIComponent(props.productId)}/preview`}
            className="btn btn-accent"
          >
            Open preview
          </Link>
          {props.bundle.runId && (
            <Link
              href={`/runs/${encodeURIComponent(props.bundle.runId)}`}
              className="btn"
            >
              View run
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function CorruptedHeader(props: { storeId: string; productId: string }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <CorruptedBadge />
      <h1 style={{ margin: 0, fontFamily: "ui-serif, Georgia, serif", fontSize: 22 }}>
        {props.productId}
      </h1>
      <span className="text-dim" style={{ fontSize: 13 }}>
        Store: <code className="code">{props.storeId}</code>
      </span>
    </header>
  );
}

function OfferTiersOptional({
  props,
}: {
  props: ReturnType<typeof buildOfferTiersProps>;
}) {
  if (!props) return null;
  return <OfferTiers props={props} />;
}

function TaxonomyCard({ props }: { props: ReturnType<typeof buildTaxonomyProps> }) {
  return (
    <section className="section-card">
      <span className="section-eyebrow">Fanaa extension</span>
      <h2>Taxonomy & SKU</h2>
      <dl className="kv-grid">
        <dt>SKU</dt>
        <dd>
          <code className="code">{props.sku ?? "—"}</code>
        </dd>
        <dt>Product type</dt>
        <dd>{props.productType ?? "—"}</dd>
        <dt>Target</dt>
        <dd>{props.target ?? "—"}</dd>
        <dt>Problems</dt>
        <dd>
          {props.problems.length === 0
            ? "—"
            : props.problems.map((p) => (
                <span key={p} className="tag tag-info" style={{ marginRight: 4 }}>
                  {p}
                </span>
              ))}
        </dd>
        <dt>Collection</dt>
        <dd>{props.collection ?? "—"}</dd>
        <dt>Upsells</dt>
        <dd>
          {props.upsellIds.length === 0 ? "—" : props.upsellIds.join(", ")}
        </dd>
        <dt>Stock left</dt>
        <dd>{props.stockLeft ?? "—"}</dd>
        <dt>Recent buyers</dt>
        <dd>{props.recentBuyers ?? "—"}</dd>
      </dl>
    </section>
  );
}

function NicheCard({ props }: { props: ReturnType<typeof buildNicheProps> }) {
  if (!props) return null;
  return (
    <section className="section-card">
      <span className="section-eyebrow">Beauty / wellness</span>
      <h2>Niche extension</h2>
      <dl className="kv-grid">
        <dt>Skin types</dt>
        <dd>
          {props.skinTypes.length === 0
            ? "—"
            : props.skinTypes.map((s) => (
                <span key={s} className="tag" style={{ marginRight: 4 }}>
                  {s}
                </span>
              ))}
        </dd>
        <dt>Concerns</dt>
        <dd>
          {props.concerns.length === 0
            ? "—"
            : props.concerns.map((c) => (
                <span key={c} className="tag tag-info" style={{ marginRight: 4 }}>
                  {c}
                </span>
              ))}
        </dd>
        <dt>Routine</dt>
        <dd>
          {props.routine.length === 0 ? (
            "—"
          ) : (
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              {props.routine.map((r) => (
                <li key={r.order} style={{ fontSize: 13 }}>
                  {r.step.en || r.step.ar}
                </li>
              ))}
            </ol>
          )}
        </dd>
      </dl>
    </section>
  );
}

function ProvenanceCard(props: {
  props: ReturnType<typeof buildProvenanceProps>;
}) {
  return (
    <section className="section-card">
      <span className="section-eyebrow">Pipeline metadata</span>
      <h2>Provenance</h2>
      <dl className="kv-grid">
        <dt>Supplier URL</dt>
        <dd>
          <a href={props.props.supplierUrl} target="_blank" rel="noopener noreferrer">
            {props.props.supplierUrl}
          </a>
        </dd>
        <dt>Scraped at</dt>
        <dd>
          <code className="code">{props.props.scrapedAt}</code>
        </dd>
        <dt>Generated at</dt>
        <dd>
          <code className="code">{props.props.generatedAt}</code>
        </dd>
        <dt>Generation run</dt>
        <dd>
          <Link href={`/runs/${encodeURIComponent(props.props.generationRunId)}`}>
            {props.props.generationRunId}
          </Link>
        </dd>
        <dt>Uploaded images</dt>
        <dd>
          {props.props.uploadedImages.length === 0
            ? "—"
            : props.props.uploadedImages.map((u, i) => (
                <code key={i} className="code" style={{ display: "block" }}>
                  {u}
                </code>
              ))}
        </dd>
      </dl>
    </section>
  );
}
