/**
 * TEMPORARY runtime-investigation page (M12 / Step 2 — image debug).
 *
 * Purpose: prove the ACTUAL runtime values for an AI-generated
 * product in production, end-to-end, with zero new fallbacks.
 *
 * Open in production (incognito):
 *   https://elfanaa.com/debug-catalog?slug=<the-ai-gen-slug>
 *
 * It reports, for the real published row:
 *   1. Whether the DB is configured + the raw catalog row.
 *   2. The exact Product object the loader returns (same call the
 *      PDP makes: `loadCatalogProductBySlug`).
 *   3. `product.images` verbatim + the raw `images[0].src` string.
 *   4. The branch `pickImageStrategy` selects for that src.
 *   5. The real <ProductGallery> and <ProductCard> rendered with
 *      the live product — inspect the DOM to see the final emitted
 *      `<img src>` and confirm SafeProductImage executed.
 *   6. Four hand-built data-URL encodings of the SAME placeholder
 *      artwork rendered as bare <img> — whichever ones show the
 *      icon prove what the browser's renderer accepts.
 *
 * DELETE THIS ROUTE once the investigation concludes. It only reads
 * catalog data (already public on /shop), so there's no data-leak
 * risk, but it should not live in the product long-term.
 */

import { loadCatalogProductBySlug } from "@/lib/catalog/loader";
import { isAdminDbConfigured, prisma } from "@/lib/admin/db";
import { pickImageStrategy } from "@/components/product/SafeProductImage";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductCard } from "@/components/product/ProductCard";
import { PLACEHOLDER_PRODUCT_IMAGE } from "@/lib/product-image";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<{ slug?: string }> };

/** Decode the current placeholder back to raw SVG markup so we can
 *  re-encode it four different ways for the browser A/B test. */
function placeholderMarkup(): string {
  const src = PLACEHOLDER_PRODUCT_IMAGE.src;
  const comma = src.indexOf(",");
  return decodeURIComponent(src.slice(comma + 1));
}

function encodings(markup: string) {
  return [
    {
      label: "A. CURRENT deployed form  (image/svg+xml;utf8, + percent-encoded)",
      src: "data:image/svg+xml;utf8," + encodeURIComponent(markup),
    },
    {
      label: "B. No charset param        (image/svg+xml, + percent-encoded)",
      src: "data:image/svg+xml," + encodeURIComponent(markup),
    },
    {
      label: "C. charset=utf-8           (image/svg+xml;charset=utf-8, + percent-encoded)",
      src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup),
    },
    {
      label: "D. base64                  (image/svg+xml;base64, ...)",
      src: "data:image/svg+xml;base64," + Buffer.from(markup, "utf8").toString("base64"),
    },
  ];
}

export default async function DebugCatalogPage({ searchParams }: Props) {
  const { slug } = await searchParams;

  if (!slug) {
    return (
      <pre style={{ padding: 24, fontFamily: "monospace" }}>
        Add ?slug=&lt;ai-generated-slug&gt; to the URL.
        {"\n"}Example: /debug-catalog?slug=run_mppso2qi_39ymcaws
      </pre>
    );
  }

  // 1 — raw DB row (the real production row, no merge/synthesis yet).
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
      dbRowJson = "DB read threw: " + (err instanceof Error ? err.message : String(err));
    }
  }

  // 2 — the exact Product the PDP renders from.
  const product = await loadCatalogProductBySlug(slug);

  // 3 — images verbatim.
  const imagesJson = product ? JSON.stringify(product.images, null, 2) : "(product is null)";
  const firstSrc = product?.images?.[0]?.src ?? "(none)";

  // 4 — which SafeProductImage branch fires for that src.
  const strategyFill = product ? pickImageStrategy(firstSrc, true, false) : "(n/a)";
  const strategyNoFill = product ? pickImageStrategy(firstSrc, false, false) : "(n/a)";

  const variants = encodings(placeholderMarkup());
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

      <h2 style={h2}>2 · product.images (verbatim) + raw images[0].src</h2>
      <div style={box}>{imagesJson}</div>
      <div style={box}>
        images[0].src ={"\n"}
        {firstSrc}
        {"\n\n"}startsWith(&quot;data:&quot;) = {String(firstSrc.startsWith("data:"))}
        {"\n"}startsWith(&quot;https://&quot;) = {String(firstSrc.startsWith("https://"))}
        {"\n"}length = {firstSrc.length}
      </div>

      <h2 style={h2}>3 · pickImageStrategy(firstSrc, …)</h2>
      <div style={box}>
        fill=true  → {strategyFill}
        {"\n"}fill=false → {strategyNoFill}
        {"\n\n"}(&quot;img-fill&quot;/&quot;img-fixed&quot; ⇒ plain &lt;img&gt;, bypasses next/image)
        {"\n"}(&quot;next-image&quot; ⇒ routed through /_next/image optimizer)
      </div>

      <h2 style={h2}>
        4 · Real &lt;ProductGallery&gt; (inspect the DOM for the emitted &lt;img src&gt;)
      </h2>
      <div style={{ maxWidth: 360, border: "1px dashed #bbb", padding: 12 }}>
        {product ? <ProductGallery product={product} /> : "(no product)"}
      </div>

      <h2 style={h2}>5 · Real &lt;ProductCard&gt;</h2>
      <div style={{ maxWidth: 280, border: "1px dashed #bbb", padding: 12 }}>
        {product ? <ProductCard product={product} /> : "(no product)"}
      </div>

      <h2 style={h2}>
        6 · Bare &lt;img&gt; A/B: which data-URL encoding does THIS browser render?
      </h2>
      <p style={{ fontFamily: "system-ui", color: "#555", margin: 0 }}>
        Each box below is a plain <code>&lt;img&gt;</code> (no next/image, no
        React wrapper) pointing at the SAME artwork encoded four ways. Whichever
        boxes show the brown &quot;image pending&quot; icon are the encodings the
        browser accepts.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
          marginTop: 16,
        }}
      >
        {variants.map((v) => (
          <div key={v.label} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, marginBottom: 8 }}>
              {v.label}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.src}
              alt={v.label}
              width={140}
              height={140}
              style={{ background: "#fff", border: "1px solid #eee" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
