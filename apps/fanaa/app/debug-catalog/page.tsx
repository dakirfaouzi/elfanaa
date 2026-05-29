/**
 * TEMPORARY runtime-investigation page (M12 / Step 2 — image debug).
 *
 * Hardened so it CANNOT 500: every server-side step is wrapped in
 * try/catch and every client-component render is wrapped in a
 * <DebugBoundary> that prints the real Error message + stack inline.
 * The goal is to convert the opaque "Digest: …" 500 into the actual
 * exception text.
 *
 * Open in production (incognito):
 *   https://elfanaa.com/debug-catalog?slug=<the-ai-gen-slug>
 *
 * DELETE THIS ROUTE once the investigation concludes.
 */

import { loadCatalogProductBySlug } from "@/lib/catalog/loader";
import { isAdminDbConfigured, prisma } from "@/lib/admin/db";
import { pickImageStrategy } from "@/components/product/SafeProductImage";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductCard } from "@/components/product/ProductCard";
import { PLACEHOLDER_PRODUCT_IMAGE } from "@/lib/product-image";
import type { Product } from "@/lib/types";
import { DebugBoundary } from "./DebugBoundary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<{ slug?: string }> };

function errText(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}\n\n${err.stack ?? "(no stack)"}`;
  }
  return String(err);
}

const box: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 12,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  background: "#f6f6f6",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 12,
  margin: "8px 0 24px",
};
const h2: React.CSSProperties = { marginTop: 32, fontFamily: "system-ui" };

export default async function DebugCatalogPage({ searchParams }: Props) {
  const { slug } = await searchParams;

  if (!slug) {
    return (
      <pre style={{ padding: 24, fontFamily: "monospace" }}>
        Add ?slug=&lt;ai-generated-slug&gt; to the URL.
        {"\n"}Example: /debug-catalog?slug=run_mppn2yd3_tkres2c7
      </pre>
    );
  }

  // ── 1 · raw DB row ─────────────────────────────────────────────────
  let dbRowJson = "(db not configured)";
  let dbRowImageKeys = "(n/a)";
  if (isAdminDbConfigured) {
    try {
      const row = (await prisma.storefrontCatalogProduct.findFirst({
        where: { storeId: "fanaa", slug },
      })) as Record<string, unknown> | null;
      dbRowJson = JSON.stringify(row, null, 2);
      dbRowImageKeys = row
        ? Object.keys(row)
            .filter((k) => /image|photo|img|media|asset/i.test(k))
            .join(", ") || "(NO image-like columns exist on the row)"
        : "(no row found for this slug)";
    } catch (err) {
      dbRowJson = "DB read threw:\n" + errText(err);
    }
  }

  // ── 2 · the exact Product the PDP renders from ─────────────────────
  let product: Product | null = null;
  let loaderError: string | null = null;
  try {
    product = await loadCatalogProductBySlug(slug);
  } catch (err) {
    loaderError = errText(err);
  }

  // ── 3 · images + strategy ──────────────────────────────────────────
  let imagesJson = "(not computed)";
  let firstSrc = "(none)";
  let strategyFill = "(n/a)";
  let strategyNoFill = "(n/a)";
  let computeError: string | null = null;
  try {
    if (product) {
      imagesJson = JSON.stringify(product.images, null, 2);
      firstSrc = product.images?.[0]?.src ?? "(none)";
      strategyFill = pickImageStrategy(firstSrc, true, false);
      strategyNoFill = pickImageStrategy(firstSrc, false, false);
    }
  } catch (err) {
    computeError = errText(err);
  }

  // ── 6 · bare-img encodings (built defensively) ─────────────────────
  let variants: Array<{ label: string; src: string }> = [];
  let encodeError: string | null = null;
  try {
    const src = PLACEHOLDER_PRODUCT_IMAGE.src;
    const markup = decodeURIComponent(src.slice(src.indexOf(",") + 1));
    variants = [
      { label: "A. CURRENT (svg+xml;utf8, + percent)", src: "data:image/svg+xml;utf8," + encodeURIComponent(markup) },
      { label: "B. no param  (svg+xml, + percent)", src: "data:image/svg+xml," + encodeURIComponent(markup) },
      { label: "C. charset=utf-8 (+ percent)", src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup) },
      { label: "D. base64", src: "data:image/svg+xml;base64," + Buffer.from(markup, "utf8").toString("base64") },
    ];
  } catch (err) {
    encodeError = errText(err);
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontFamily: "system-ui" }}>Catalog image runtime trace</h1>
      <p style={{ fontFamily: "system-ui", color: "#555" }}>
        slug = <strong>{slug}</strong> · db configured ={" "}
        <strong>{String(isAdminDbConfigured)}</strong> · product resolved ={" "}
        <strong>{String(Boolean(product))}</strong>
      </p>

      <h2 style={h2}>1 · Raw storefront_catalog_product row</h2>
      <p style={{ fontFamily: "system-ui", margin: 0 }}>
        Image-like columns on the row: <strong>{dbRowImageKeys}</strong>
      </p>
      <div style={box}>{dbRowJson}</div>

      <h2 style={h2}>2 · loadCatalogProductBySlug() result</h2>
      {loaderError ? (
        <div style={{ ...box, borderColor: "#c0392b", background: "#fff5f5" }}>
          LOADER THREW:{"\n"}
          {loaderError}
        </div>
      ) : (
        <div style={box}>{imagesJson}</div>
      )}
      {computeError ? (
        <div style={{ ...box, borderColor: "#c0392b", background: "#fff5f5" }}>
          IMAGE/STRATEGY COMPUTE THREW:{"\n"}
          {computeError}
        </div>
      ) : (
        <div style={box}>
          images[0].src ={"\n"}
          {firstSrc}
          {"\n\n"}startsWith(&quot;data:&quot;) = {String(firstSrc.startsWith("data:"))}
          {"\n"}startsWith(&quot;https://&quot;) = {String(firstSrc.startsWith("https://"))}
          {"\n"}length = {firstSrc.length}
        </div>
      )}

      <h2 style={h2}>3 · pickImageStrategy(firstSrc, …)</h2>
      <div style={box}>
        fill=true → {strategyFill}
        {"\n"}fill=false → {strategyNoFill}
      </div>

      <h2 style={h2}>6 · Bare &lt;img&gt; A/B (which data-URL encoding renders?)</h2>
      {encodeError ? (
        <div style={{ ...box, borderColor: "#c0392b", background: "#fff5f5" }}>
          ENCODE THREW:{"\n"}
          {encodeError}
        </div>
      ) : (
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 16 }}
        >
          {variants.map((v) => (
            <div key={v.label} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
              <div style={{ fontFamily: "monospace", fontSize: 11, marginBottom: 8 }}>{v.label}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.src} alt={v.label} width={140} height={140} style={{ background: "#fff", border: "1px solid #eee" }} />
            </div>
          ))}
        </div>
      )}

      <h2 style={h2}>4 · Real &lt;ProductGallery&gt; (inspect DOM for emitted &lt;img src&gt;)</h2>
      <div style={{ maxWidth: 360, border: "1px dashed #bbb", padding: 12 }}>
        {product ? (
          <DebugBoundary label="ProductGallery">
            <ProductGallery product={product} />
          </DebugBoundary>
        ) : (
          "(no product)"
        )}
      </div>

      <h2 style={h2}>5 · Real &lt;ProductCard&gt;</h2>
      <div style={{ maxWidth: 280, border: "1px dashed #bbb", padding: 12 }}>
        {product ? (
          <DebugBoundary label="ProductCard">
            <ProductCard product={product} />
          </DebugBoundary>
        ) : (
          "(no product)"
        )}
      </div>
    </div>
  );
}
