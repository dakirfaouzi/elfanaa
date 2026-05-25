import Link from "next/link";

import { PreviewImage } from "../preview/PreviewImage";
import { RelativeTime } from "../RelativeTime";
import type { ProductSummary } from "@/lib/studio/product-loader";

/**
 * "Recent publishes" horizontal strip on the operator dashboard.
 *
 * Surfaces the most-recently-published products with hero thumbnails
 * so the operator can spot a fresh launch at a glance. Tap-through
 * routes mirror the products-list card behaviour:
 *
 *   • DB-sourced  → `/p/<slug>` on the Studio domain (the canonical
 *                   storefront route, basePath-aware via <Link>).
 *   • FS-sourced  → legacy detail page (`/products/<storeId>/<id>`)
 *                   so the M7 file-only artefacts stay reachable.
 *
 * # Why a horizontal scroll instead of a grid
 *
 * The dashboard is a "glance" surface — five recent publishes need to
 * fit into a narrow horizontal band so the more important triage
 * cards stay above the fold. A horizontal strip is the standard
 * pattern for "most recent" media surfaces (Apple, Linear, Vercel).
 */
export function RecentPublishesStrip(props: {
  products: ReadonlyArray<ProductSummary>;
}) {
  if (props.products.length === 0) {
    // Hidden entirely when nothing's published yet — the empty state
    // is already covered by the KPI strip ("0 live") and the products
    // CTA is in the empty state of `RecentRunsCard`. Repeating it here
    // would clutter the surface.
    return null;
  }

  return (
    <section
      aria-label="Recently published products"
      className="section-card"
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="section-eyebrow">Latest publishes</span>
          <h2>What just shipped</h2>
        </div>
        <Link href="/products" className="btn btn-small">
          Browse catalog
        </Link>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {props.products.map((p) => (
          <RecentPublishTile key={`${p.storeId}/${p.productId}`} product={p} />
        ))}
      </div>
    </section>
  );
}

function RecentPublishTile({ product }: { product: ProductSummary }) {
  // Mirror the linking discipline in /products: DB-sourced products
  // route to /p/<slug>, file-only ones to the legacy detail page.
  const href =
    product.source === "db"
      ? `/p/${encodeURIComponent(product.slug)}`
      : `/products/${encodeURIComponent(product.storeId)}/${encodeURIComponent(product.productId)}`;
  const title =
    product.title.en || product.title.ar || product.slug || product.productId;

  return (
    <Link
      href={href}
      className="product-card"
      style={{ padding: 10, gap: 8 }}
    >
      {product.heroImage ? (
        <PreviewImage
          src={product.heroImage.resolvedSrc}
          rawSrc={product.heroImage.src}
          alt={product.heroImage.alt}
          placeholder={product.heroImage.placeholder}
        />
      ) : (
        <div className="image-frame">
          <div className="image-placeholder">
            <span aria-hidden style={{ fontSize: 22 }}>
              ◇
            </span>
            <span>no image</span>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <strong
          style={{
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: 14,
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={title}
        >
          {title}
        </strong>
        {product.publishedAt ? (
          <RelativeTime
            value={product.publishedAt}
            prefix="Published "
            style={{ fontSize: 11, color: "var(--text-faint)" }}
          />
        ) : null}
      </div>
    </Link>
  );
}
