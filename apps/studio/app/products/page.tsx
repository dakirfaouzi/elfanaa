import Link from "next/link";
import { NavBar } from "../_components/NavBar";
import { EmptyState } from "../_components/EmptyState";
import { CorruptedBadge, PublishedBadge } from "../_components/StatusBadge";
import { RelativeTime } from "../_components/RelativeTime";
import { PreviewImage } from "../_components/preview/PreviewImage";
import {
  listProducts,
  listPublishedStores,
  type ProductSummary,
} from "@/lib/studio/product-loader";

export const dynamic = "force-dynamic";

/**
 * Products browser — lists every publisher artefact under
 * `.platform-data/products/<storeId>/`.
 *
 * # What the operator sees
 *
 *   • Card-style page header (matches the C1/C2 rhythm) with a counts
 *     strip — total products + total stores at a glance.
 *   • One section per store (only `fanaa` ships today).
 *   • Cards sorted most-recently-published first, each carrying a
 *     4:5 hero thumbnail, bilingual title pair, slug chip, niche tag,
 *     and a "Published <relative>" timestamp that refreshes itself.
 *   • Corrupt files surface a focused `Corrupted` badge so they
 *     don't hide in the listing.
 *   • Empty state CTAs straight back into Intake so a new operator
 *     can start the workflow without grepping for CLI commands.
 *
 * Server component — no client JS in the page shell. The card
 * thumbnails and `<RelativeTime>` are the only client islands;
 * everything else renders synchronously from disk.
 */
export default async function ProductsPage() {
  const storeIds = await listPublishedStores();
  const grouped = await Promise.all(
    storeIds.map(async (storeId) => ({
      storeId,
      products: await listProducts(storeId),
    })),
  );
  const totalProducts = grouped.reduce(
    (acc, group) => acc + group.products.length,
    0,
  );

  return (
    <div className="shell">
      <NavBar active="products" />
      <main className="shell-main">
        <PageHeader
          storeCount={storeIds.length}
          productCount={totalProducts}
        />

        {storeIds.length === 0 || totalProducts === 0 ? (
          <EmptyState
            title="No products published yet"
            body="Run a pipeline from Intake to generate a UniversalProduct, then publish it from the run detail view. Published bundles land here, ready for the storefront."
            cta={{ href: "/intake", label: "Start in Intake" }}
          />
        ) : (
          grouped.map(({ storeId, products }) => (
            <StoreSection
              key={storeId}
              storeId={storeId}
              products={products}
            />
          ))
        )}
      </main>
    </div>
  );
}

/* ─── Header ─────────────────────────────────────────────────── */

function PageHeader(props: { storeCount: number; productCount: number }) {
  return (
    <header
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow:
          "inset 0 1px 0 color-mix(in srgb, var(--text) 4%, transparent)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="section-eyebrow">Catalog</span>
          <h1
            style={{
              margin: 0,
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: "clamp(26px, 3.2vw, 32px)",
              letterSpacing: "-0.4px",
              lineHeight: 1.1,
            }}
          >
            Products
          </h1>
          <p className="text-dim" style={{ margin: 0, fontSize: 13 }}>
            Published bundles ready for the storefront.
          </p>
        </div>
        <CountsStrip
          productCount={props.productCount}
          storeCount={props.storeCount}
        />
      </div>
    </header>
  );
}

function CountsStrip(props: { productCount: number; storeCount: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 0,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--bg-elev)",
        overflow: "hidden",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <CountCell label="Products" value={props.productCount} />
      <CountCellDivider />
      <CountCell label="Stores" value={props.storeCount} />
    </div>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "8px 18px",
        minWidth: 78,
      }}
    >
      <span
        style={{
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1,
          color: "var(--text)",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--text-faint)",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function CountCellDivider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        background: "var(--border)",
      }}
    />
  );
}

/* ─── Store section ──────────────────────────────────────────── */

function StoreSection(props: { storeId: string; products: ProductSummary[] }) {
  if (props.products.length === 0) {
    return (
      <section className="section-card">
        <span className="section-eyebrow">{props.storeId}</span>
        <p className="text-dim" style={{ margin: 0, fontSize: 13 }}>
          No products published yet for this store.
        </p>
      </section>
    );
  }
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header
        style={{ display: "flex", alignItems: "baseline", gap: 10 }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: 20,
            letterSpacing: "-0.2px",
          }}
        >
          {props.storeId}
        </h2>
        <span className="text-dim" style={{ fontSize: 13 }}>
          {props.products.length} product
          {props.products.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="product-grid">
        {props.products.map((p) => (
          <ProductCard key={p.productId} product={p} />
        ))}
      </div>
    </section>
  );
}

/* ─── Card ───────────────────────────────────────────────────── */

function ProductCard({ product }: { product: ProductSummary }) {
  const isCorrupted = Boolean(product.corrupted);
  // C3.1 — the legacy detail page (/products/[storeId]/[productId])
  // only knows how to read FS-backed bundles. DB-published products
  // (M11 publish-from-builder flow) live in `studio_published_product`
  // and don't have a detail-page reader, so we link them directly to
  // the storefront route (`/p/<slug>`) on the Studio domain. Next.js
  // auto-prefixes basePath on <Link>, so under /studio this resolves
  // to /studio/p/<slug> without any extra wiring.
  const isDbSourced = product.source === "db";
  const href = isDbSourced
    ? `/p/${encodeURIComponent(product.slug)}`
    : `/products/${encodeURIComponent(product.storeId)}/${encodeURIComponent(product.productId)}`;
  const displayTitle =
    product.title.en || product.title.ar || product.slug || product.productId;
  const arabicTitle =
    product.title.ar && product.title.ar !== displayTitle
      ? product.title.ar
      : null;

  return (
    <Link
      href={href}
      className={`product-card${isCorrupted ? " is-corrupted" : ""}`}
    >
      <CardThumbnail product={product} corrupted={isCorrupted} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
            flex: 1,
          }}
        >
          <strong
            style={{
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: 16,
              lineHeight: 1.25,
              wordBreak: "break-word",
            }}
          >
            {displayTitle}
          </strong>
          {arabicTitle && (
            <span
              dir="rtl"
              className="text-dim"
              style={{ fontSize: 13, lineHeight: 1.3 }}
            >
              {arabicTitle}
            </span>
          )}
        </div>
        {isCorrupted ? <CorruptedBadge /> : <PublishedBadge />}
      </div>

      {/* Slug + niche chips. Hidden when both are empty so corrupted
          cards collapse cleanly instead of showing two empty tags. */}
      {(product.slug || product.niche) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
          }}
        >
          {product.slug && (
            <code
              className="code"
              style={{
                fontSize: 11,
                padding: "2px 6px",
                background: "var(--bg-elev)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-dim)",
              }}
            >
              /p/{product.slug}
            </code>
          )}
          {product.niche && (
            <span className="tag tag-info" style={{ fontSize: 11 }}>
              {product.niche.replace(/_/g, " ")}
            </span>
          )}
        </div>
      )}

      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: "var(--text-faint)",
          marginTop: "auto",
          paddingTop: 4,
        }}
      >
        <span style={{ fontFamily: "ui-monospace, monospace" }}>
          {product.productId}
        </span>
        {product.publishedAt ? (
          <RelativeTime value={product.publishedAt} prefix="Published " />
        ) : (
          <span>—</span>
        )}
      </footer>

      {isCorrupted && (
        <span className="text-dim" style={{ fontSize: 12 }}>
          Reason:{" "}
          <code className="code">{product.corrupted?.reason}</code>
        </span>
      )}
    </Link>
  );
}

function CardThumbnail({
  product,
  corrupted,
}: {
  product: ProductSummary;
  corrupted: boolean;
}) {
  // Corrupted bundle or missing image → fall back to a neutral
  // "asset pending" frame so every card occupies the same vertical
  // slot. Operators rely on the rhythm to scan a long list.
  if (corrupted || !product.heroImage) {
    return (
      <div className="image-frame">
        <div className="image-placeholder">
          <span aria-hidden style={{ fontSize: 22 }}>
            ◇
          </span>
          <span>{corrupted ? "bundle corrupted" : "no image"}</span>
        </div>
      </div>
    );
  }
  return (
    <PreviewImage
      src={product.heroImage.resolvedSrc}
      rawSrc={product.heroImage.src}
      alt={product.heroImage.alt}
      placeholder={product.heroImage.placeholder}
    />
  );
}
