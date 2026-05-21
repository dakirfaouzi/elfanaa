import Link from "next/link";
import { NavBar } from "../_components/NavBar";
import { EmptyState } from "../_components/EmptyState";
import { CorruptedBadge, PublishedBadge } from "../_components/StatusBadge";
import {
  listProducts,
  listPublishedStores,
  type ProductSummary,
} from "@/lib/studio/product-loader";

export const dynamic = "force-dynamic";

/**
 * Products browser — lists every M7 publisher artefact under
 * `.platform-data/products/<storeId>/`.
 *
 * # What the operator sees
 *
 *   • One section per store (only `fanaa` ships in M7).
 *   • Cards sorted most-recently-published first.
 *   • Corrupt files flagged with a `Corrupted` badge so they don't
 *     hide in the listing.
 *   • Empty state with a hint pointing to the M7 CLI when nothing
 *     has been published yet.
 *
 * Server component — no client JS. Fetches the bundles synchronously
 * from disk on every request (M8 has no DB; this is fine for the
 * single-operator scale).
 */
export default async function ProductsPage() {
  const storeIds = await listPublishedStores();

  return (
    <div className="shell">
      <NavBar active="products" />
      <main className="shell-main">
        <PageHeader storeCount={storeIds.length} />

        {storeIds.length === 0 ? (
          <EmptyState
            title="No products published yet"
            body="Run the M7 publisher CLI to materialise a UniversalProduct from a worker run into .platform-data/products/."
            hint={{
              label: "Publish from a run",
              command:
                "pnpm --filter @platform/publishers publish:local --run-id <runId>",
            }}
          />
        ) : (
          await Promise.all(
            storeIds.map(async (storeId) => {
              const products = await listProducts(storeId);
              return <StoreSection key={storeId} storeId={storeId} products={products} />;
            }),
          )
        )}
      </main>
    </div>
  );
}

function PageHeader({ storeCount }: { storeCount: number }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="section-eyebrow">M8 · Studio</span>
      <h1
        style={{
          margin: 0,
          fontFamily: "ui-serif, Georgia, serif",
          fontSize: "clamp(24px, 3vw, 32px)",
          letterSpacing: -0.4,
        }}
      >
        Products
      </h1>
      <p className="text-dim" style={{ margin: 0, fontSize: 14 }}>
        Bundles materialised by FanaaPublisher under{" "}
        <code className="code">.platform-data/products/</code>
        {storeCount > 0 ? ` · ${storeCount} store${storeCount === 1 ? "" : "s"}` : ""}.
      </p>
    </header>
  );
}

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
      <header style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ margin: 0, fontFamily: "ui-serif, Georgia, serif", fontSize: 20 }}>
          {props.storeId}
        </h2>
        <span className="text-dim" style={{ fontSize: 13 }}>
          {props.products.length} product{props.products.length === 1 ? "" : "s"}
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

function ProductCard({ product }: { product: ProductSummary }) {
  const isCorrupted = Boolean(product.corrupted);
  const href = `/products/${encodeURIComponent(product.storeId)}/${encodeURIComponent(product.productId)}`;
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        color: "var(--text)",
        textDecoration: "none",
        transition: "border-color 120ms ease",
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span className="text-faint" style={{ fontSize: 11, letterSpacing: 0.16 }}>
          {product.productId}
        </span>
        {isCorrupted ? <CorruptedBadge /> : <PublishedBadge />}
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <strong style={{ fontFamily: "ui-serif, Georgia, serif", fontSize: 16 }}>
          {product.title.en || product.title.ar || product.slug}
        </strong>
        {product.title.ar && (
          <span dir="rtl" className="text-dim" style={{ fontSize: 13 }}>
            {product.title.ar}
          </span>
        )}
      </div>
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--text-faint)",
        }}
      >
        <span>{product.niche || "—"}</span>
        <span>{product.publishedAt ? new Date(product.publishedAt).toISOString().split("T")[0] : "—"}</span>
      </footer>
      {isCorrupted && (
        <span className="text-dim" style={{ fontSize: 12 }}>
          Reason: <code className="code">{product.corrupted?.reason}</code>
        </span>
      )}
    </Link>
  );
}
