import { NextResponse } from "next/server";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";
import {
  buildOrderRow,
  composeFullAddress,
  dispatchToGoogleSheets,
  formatOrderDateKSA,
  phoneForSheets,
  type OrderRowLine,
  type SheetsOrderRow,
} from "@/lib/webhooks/google-sheets";
import { resolveCatalogProductsByIds } from "@/lib/catalog/resolver";
import { lineTotal } from "@/lib/pricing";
import { sumMoney, pickLocalized } from "@/lib/format";
import { validateSaudiPhone } from "@/lib/phone";
import { getProductSku } from "@/lib/sku";
import { productHref } from "@/lib/product-href";
import { siteConfig } from "@/data/site";
import type { CartLineSource, CodOrderInput, Money } from "@/lib/types";

/**
 * POST /api/orders
 *
 * Accepts a *minimum-friction* COD order (name + Saudi phone + cart) from the
 * storefront and:
 *   1. Validates server-side (never trust the client).
 *   2. Recomputes line totals using the canonical `lib/pricing` engine so
 *      tier-based bundle prices (e.g. 1=199, 2=279, 3=349) can't be tampered
 *      with from devtools.
 *   3. Fans out to all configured webhook destinations in parallel:
 *        • Generic signed webhook (CRM/ERP)
 *        • Shipping partner (Aramex/SMSA hand-off)
 *        • Google Sheets row append (zero-infra ops dashboard)
 *   4. Returns the order id + minimal echo so the storefront can transition
 *      to the post-purchase upsell screen.
 *
 * Persistence is intentionally out of scope here — wire your DB of choice
 * (Postgres / Supabase / Mongo) at the marked extension point.
 */
export async function POST(req: Request) {
  // Misrouting guard. In two-tier mode (NEXT_PUBLIC_API_BASE_URL is set)
  // this route should never receive traffic — the storefront posts
  // directly to FastAPI where Postgres, pixel CAPI, MaxMind, and the
  // canonical Sheets dispatch all live. If we land here in two-tier
  // mode, something is wrong: either the client bundle was built
  // without the NEXT_PUBLIC_API_BASE_URL build ARG (so `apiUrl()` fell
  // back to "/api/orders"), or a stale tab is hitting an older bundle.
  // Log loudly so EasyPanel app logs catch the regression instantly.
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    console.warn("[order] ⚠ fallback route hit in two-tier deploy", {
      backend: process.env.NEXT_PUBLIC_API_BASE_URL,
      hint:
        "Browser POSTed to /api/orders even though NEXT_PUBLIC_API_BASE_URL " +
        "is set. The likely cause is that the client bundle was built " +
        "without that variable inlined — set NEXT_PUBLIC_API_BASE_URL as " +
        "a BUILD argument (Dockerfile builder stage / docker-compose " +
        "elfanaa_web.build.args / EasyPanel Build Arguments tab) and " +
        "redeploy. Until then this fallback will still create the order " +
        "but Google Sheets dispatch may be skipped if GOOGLE_SHEETS_* " +
        "env vars only live on the API service.",
    });
  }

  let input: CodOrderInput;
  try {
    input = (await req.json()) as CodOrderInput;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const phoneCheck = validateSaudiPhone(input?.phone ?? "");
  const errors: string[] = [];
  if (!input?.fullName || input.fullName.trim().length < 2) errors.push("fullName");
  if (!phoneCheck.ok) errors.push(`phone:${phoneCheck.reason}`);
  if (!input?.cart?.lines?.length) errors.push("cart");

  if (errors.length) {
    return NextResponse.json({ error: "invalid_input", errors }, { status: 422 });
  }

  // Tier-aware re-pricing. The client's reported amounts are ignored.
  // The per-line `source` is carried through from the cart payload so
  // cross-sell items added in the cart drawer end up in the cross-sell
  // slot of the Sheets row instead of being silently bucketed as base.
  //
  // Unknown product ids are a HARD ERROR (422). Previously this route
  // silently filtered them out via `.filter(Boolean)` — exactly the
  // bug that erased the BASE product from `/sugarbear` orders in
  // production (catalog drift between storefront and a stale FastAPI
  // catalog mirror). Failing loud is the only way to keep the
  // storefront and the backend re-pricer in lockstep.
  //
  // Phase 2.5 ("bridge the catalog split"): resolution flows through
  // `resolveCatalogProductsByIds` — snapshot-first, hybrid loader as
  // fallback. Snapshot products resolve with ZERO behavioural change
  // (same O(1) array find, no DB hit, same race-safety contract from
  // `lib/catalog/snapshot.ts`). AI-generated products (absent from
  // the snapshot but present in `storefront_catalog_product`) now
  // resolve via the loader instead of producing a 422. The batch
  // helper guarantees AT MOST ONE DB hit per request (the underlying
  // `loadAllCatalogProducts` is wrapped in `React.cache`).
  const lineIds = input.cart.lines.map((l) => l.productId);
  const resolvedProducts = await resolveCatalogProductsByIds(lineIds);

  const unknownIds: string[] = [];
  const lineDetailsRaw = input.cart.lines.map((line, i) => {
    const product = resolvedProducts[i];
    if (!product) {
      unknownIds.push(line.productId);
      return null;
    }
    const total = lineTotal(product, line.quantity);
    // `source` defaults to "base" when absent so legacy clients
    // (older bundles, persisted carts) continue to behave exactly
    // as they did before the 3-slot upgrade.
    const source: CartLineSource =
      line.source === "cross_sell" ? "cross_sell" : "base";
    return {
      productId: product.id,
      title: product.title,
      unitPrice: product.price,
      quantity: line.quantity,
      lineTotal: total,
      source,
    };
  });

  if (unknownIds.length > 0) {
    console.error("[order] rejected — unknown product ids", {
      ids: unknownIds,
      hint:
        "Storefront sent product ids the Next.js catalog cannot resolve. " +
        "Mirror data/products.ts on the API side and redeploy.",
    });
    return NextResponse.json(
      {
        error: "product_unknown",
        errors: unknownIds.map((id) => `product:${id}`),
      },
      { status: 422 },
    );
  }

  const lineDetails = lineDetailsRaw.filter(
    <T>(x: T): x is NonNullable<T> => Boolean(x),
  );

  // Slot-0 invariant: if the cart has lines, the base slot must be
  // populated. If every surviving line is tagged `cross_sell` (e.g.
  // the customer removed the original base product before checkout),
  // promote the first one back to `base` so the Sheets row reads
  // "X/0/0" instead of the regression-shape "0/0/X" and the receipt
  // on the Thank-you page has a primary product to render.
  if (
    lineDetails.length > 0 &&
    !lineDetails.some((l) => l.source === "base")
  ) {
    const orphan = lineDetails.find((l) => l.source === "cross_sell");
    if (orphan) {
      console.info(
        "[order] promoting orphan cross-sell to base slot — no base in cart",
        { productId: orphan.productId },
      );
      orphan.source = "base";
    }
  }

  const subtotal: Money =
    sumMoney(lineDetails.map((l) => l.lineTotal)) ?? {
      amount: 0,
      currency: input.cart.currency,
    };

  // Shipping address — captured by the COD popup. Mirrors the FastAPI
  // service (`backend/app/services/orders.py::_order_to_payload`) so
  // every outbound webhook (admin ingest mirror, CRM, shipping
  // partner) sees the customer's full address. The Sheets row builder
  // below uses the same source via `composeFullAddress`.
  const shipCity = (input.city ?? "").trim() || undefined;
  const shipAddress = (input.address ?? "").trim() || undefined;

  const order = {
    id: `cod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    paymentMethod: "cod" as const,
    customer: {
      fullName: input.fullName.trim(),
      phone: phoneCheck.ok ? phoneCheck.normalised : input.phone,
      phoneE164: phoneCheck.ok ? phoneCheck.e164 : undefined,
    },
    locale: input.locale,
    city: shipCity,
    address: shipAddress,
    lines: lineDetails,
    totals: { subtotal, total: subtotal },
  };

  // ─── Persistence extension point ──────────────────────────────────────────
  // await db.orders.insert(order);
  // ──────────────────────────────────────────────────────────────────────────

  // Sheets row — single operational source of truth even when CRM is down.
  // Layout mirrors `Fanaa_Store Orders - Feuille 1.csv` exactly, so a
  // non-technical teammate can scan a row left-to-right and see the
  // entire order without joining tabs.
  //
  // FULLY DYNAMIC row builder: one slash-separated segment per accepted
  // line, no fixed-slot ceiling. Order inside each cell is deterministic
  // (base → upsell → cross_sell, insertion order within each bucket) so
  // SKU / Product name / Quantity / URL columns stay aligned.
  //
  // Examples for the /sugarbear funnel:
  //   • Sugarbear x3, no cross-sell                 → totalQuantity "3"
  //   • Sugarbear x1 + cross-sell x1                → totalQuantity "1/1"
  //   • Sugarbear x1 + 2 upsells + 3 cross-sell    → totalQuantity "1/1/1/3"
  //                                                 (later, after upsells
  //                                                 accept the FastAPI side
  //                                                 sends `kind:"order_update"`
  //                                                 with the full state and
  //                                                 the Apps Script overwrites
  //                                                 the row atomically.)
  // Sheets row builder — re-resolve through the same Phase 2.5
  // bridge so AI-generated SKUs land on the row with their real SKU
  // / URL instead of the legacy `FN-UNKNOWN-<id>` fallback. Every
  // id here was already accepted by the re-pricer above, so the
  // resolver MUST find each one — the `?? null` defensive shape
  // stays because we'd rather degrade a row to "UNKNOWN" than crash
  // the order fan-out. The batch resolver reuses the `React.cache`d
  // catalog list, so this is still a single DB hit per request.
  const rowProductLookup = await resolveCatalogProductsByIds(
    lineDetails.map((l) => l.productId),
  );
  const orderRowLines: OrderRowLine[] = lineDetails.map((l, i) => {
    const product = rowProductLookup[i];
    return {
      sku: product ? getProductSku(product) : `FN-UNKNOWN-${l.productId}`,
      name: product
        ? pickLocalized(product.title, "ar")
        : pickLocalized(l.title, "ar"),
      quantity: l.quantity,
      url: product
        ? `${siteConfig.url.replace(/\/$/, "")}${productHref(product)}`
        : "",
      source: l.source,
    };
  });
  const dynamicRow = buildOrderRow(orderRowLines);
  // Fallback to the referer (legacy single-URL behaviour) ONLY when
  // every line omitted its per-product URL — otherwise the dynamic
  // join wins.
  const productUrlCell =
    dynamicRow.productUrl.replace(/\//g, "").trim() === ""
      ? req.headers.get("referer") ?? ""
      : dynamicRow.productUrl;

  const sheetsRow: SheetsOrderRow = {
    kind: "order",
    orderId: order.id,
    orderDate: formatOrderDateKSA(order.createdAt),
    country: "KSA",
    fullName: order.customer.fullName,
    phone: phoneForSheets(order.customer.phoneE164 ?? order.customer.phone),
    fullAddress: composeFullAddress(input.city, input.address),
    productUrl: productUrlCell,
    sku: dynamicRow.sku,
    productName: dynamicRow.productName,
    totalQuantity: dynamicRow.totalQuantity,
    variantPrice: Math.round(subtotal.amount / 100),
    currency: "SAR",
  };

  // ── Google Sheets row append — AWAITED ────────────────────────────────
  // The ops dashboard must contain the row BEFORE the customer lands on
  // the upsell screen. Order creation succeeds even if this fails (the
  // dispatcher swallows its own exceptions and logs them).
  console.info("[order] → dispatching base order to sheets", {
    orderId: order.id,
    sku: sheetsRow.sku,
    totalQuantity: sheetsRow.totalQuantity,
    variantPrice: sheetsRow.variantPrice,
    productUrl: sheetsRow.productUrl,
  });
  const sheetsResult = await dispatchToGoogleSheets({
    url: process.env.GOOGLE_SHEETS_WEBHOOK_URL,
    apiKey: process.env.GOOGLE_SHEETS_API_KEY,
    row: sheetsRow,
  });
  if (!sheetsResult.ok) {
    console.error("[order] sheets dispatch failed — order kept", {
      orderId: order.id,
      result: sheetsResult,
    });
  }

  // ── Non-blocking side effects: CRM + shipping webhooks ────────────────
  // These do not affect buyer UX. allSettled keeps a single slow downstream
  // from blocking the route's response.
  await Promise.allSettled([
    dispatchWebhook({
      url: process.env.ORDERS_WEBHOOK_URL,
      payload: { event: "order.created", order },
      secret: process.env.WEBHOOK_SECRET,
    }),
    dispatchWebhook({
      url: process.env.SHIPPING_WEBHOOK_URL,
      payload: { event: "shipment.requested", order },
      secret: process.env.WEBHOOK_SECRET,
    }),
  ]);

  // Return the FULL receipt — the storefront persists this to sessionStorage
  // and the thank-you page renders it without a second round-trip.
  //
  // Receipt lines carry the storefront's `ReceiptLineSource` contract
  // (`"base" | "post_purchase_upsell"`) — `cross_sell` is a backend-only
  // distinction used for Sheets slot placement, so we collapse it to
  // `"base"` here. Without this, the receipt persisted to sessionStorage
  // would contain values the `OrderReceipt` component doesn't know how
  // to render.
  const receiptLines = order.lines.map((l) => ({
    productId: l.productId,
    title: l.title,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
    lineTotal: l.lineTotal,
    source: "base" as const,
  }));

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    productIds: lineDetails.map((l) => l.productId),
    receipt: {
      orderId: order.id,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      locale: order.locale,
      customer: order.customer,
      lines: receiptLines,
      totals: order.totals,
    },
  });
}
