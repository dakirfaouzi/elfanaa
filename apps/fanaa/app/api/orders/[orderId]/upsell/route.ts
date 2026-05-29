import { NextResponse } from "next/server";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";
import {
  buildOrderRow,
  dispatchToGoogleSheets,
  type OrderRowLine,
  type SheetsOrderUpdateRow,
  type SheetsUpsellRow,
} from "@/lib/webhooks/google-sheets";
import {
  resolveCatalogProductById,
  resolveCatalogProductsByIds,
} from "@/lib/catalog/resolver";
import { POST_PURCHASE_OFFER_PRICE } from "@/lib/upsell/strategy";
import { pickLocalized } from "@/lib/format";
import { getProductSku } from "@/lib/sku";
import { productHref } from "@/lib/product-href";
import { siteConfig } from "@/data/site";
import type { Locale, Money } from "@/lib/types";

/**
 * POST /api/orders/:orderId/upsell
 *
 * Accepts a post-purchase one-click offer and appends it to the existing
 * COD order. Same payment, same delivery — the customer commits with one
 * tap and we never touch their wallet again.
 *
 * Server-trusted pricing: the route ignores any price the client might send
 * and re-applies the canonical `POST_PURCHASE_OFFER_PRICE` constant.
 *
 * Multi-upsell support
 * --------------------
 * This route is the SINGLE-TIER fallback (no FastAPI). It is stateless
 * by design — orders are not persisted in Next.js. To still support
 * multi-upsell / multi-cross-sell stacking, the client passes its
 * existing receipt snapshot in the request body as `priorLines`. We
 * append the new upsell, then send `kind: "order_update"` to Sheets
 * with the FULL final state. No fixed-slot truncation.
 *
 * Backward compat: if `priorLines` is missing (older bundle), we fall
 * back to the legacy `kind: "upsell"` payload that the Apps Script's
 * `_handleUpsell` still understands.
 */

type PriorLine = {
  productId: string;
  quantity: number;
  source?: "base" | "upsell" | "cross_sell";
  unitPriceMinor?: number;
};

type AcceptUpsellInput = {
  productId: string;
  locale: Locale;
  /** Optional snapshot of every line already on the order. Sent by the
   * checkout client (it has the receipt from POST /api/orders) so the
   * stateless fallback can rebuild the full final state. */
  priorLines?: PriorLine[];
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await ctx.params;
  if (!orderId) {
    return NextResponse.json({ error: "missing_order_id" }, { status: 400 });
  }

  let input: AcceptUpsellInput;
  try {
    input = (await req.json()) as AcceptUpsellInput;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  /*
   * Resolve the upsell offer through the Phase 2.5 bridge so an
   * AI-generated product (published from Studio without a snapshot
   * row) can be selected as the post-purchase offer. The current
   * `selectPostPurchaseUpsell` strategy only returns snapshot
   * products, so in practice this snapshot-first lookup hits the
   * fast path. The DB fallback is here for forward compatibility
   * when AI-gen products start landing in the upsell candidate
   * pool (Phase 2.6+).
   */
  const product = await resolveCatalogProductById(input?.productId ?? "");
  if (!product) {
    return NextResponse.json({ error: "unknown_product" }, { status: 422 });
  }

  const acceptedAt = new Date().toISOString();

  const upsellLine = {
    productId: product.id,
    title: product.title,
    /** Server-trusted offer price — clients cannot override. */
    unitPrice: POST_PURCHASE_OFFER_PRICE,
    quantity: 1,
    lineTotal: POST_PURCHASE_OFFER_PRICE,
    source: "post_purchase_upsell" as const,
  };

  const event = {
    event: "order.upsell_accepted" as const,
    orderId,
    acceptedAt,
    line: upsellLine,
    locale: input.locale,
  };

  // Build the FULL final state from the client-supplied prior snapshot
  // + the just-accepted upsell. If the snapshot is missing (older
  // bundle, direct API hit), fall back to the legacy single-upsell
  // shape so the row still updates.
  const dispatchSheets = async () => {
    if (input.priorLines && input.priorLines.length > 0) {
      const allLines: OrderRowLine[] = [];
      let totalMinor = 0;
      /*
       * Phase 2.5: resolve through the bridge so AI-generated lines
       * that survived the order POST also survive the upsell rebuild
       * — without this, an AI-gen product would silently disappear
       * from the Sheets `order_update` row, breaking ops parity
       * between the order POST and the upsell follow-up.
       */
      const priorResolved = await resolveCatalogProductsByIds(
        input.priorLines.map((pl) => pl.productId),
      );
      for (let i = 0; i < input.priorLines.length; i += 1) {
        const pl = input.priorLines[i];
        const p = priorResolved[i];
        if (!p) continue;
        const url = `${siteConfig.url.replace(/\/$/, "")}${productHref(p)}`;
        const unitMinor = pl.unitPriceMinor ?? p.price.amount;
        totalMinor += unitMinor * pl.quantity;
        allLines.push({
          sku: getProductSku(p),
          name: pickLocalized(p.title, "ar"),
          quantity: pl.quantity,
          url,
          source:
            pl.source === "upsell" || pl.source === "cross_sell"
              ? pl.source
              : "base",
        });
      }
      // Append the new upsell line.
      const upsellMoney: Money = POST_PURCHASE_OFFER_PRICE;
      totalMinor += upsellMoney.amount;
      allLines.push({
        sku: getProductSku(product),
        name: pickLocalized(product.title, "ar"),
        quantity: 1,
        url: `${siteConfig.url.replace(/\/$/, "")}${productHref(product)}`,
        source: "upsell",
      });

      const dyn = buildOrderRow(allLines);
      const updateRow: SheetsOrderUpdateRow = {
        kind: "order_update",
        orderId,
        sku: dyn.sku,
        productName: dyn.productName,
        totalQuantity: dyn.totalQuantity,
        productUrl: dyn.productUrl,
        variantPrice: Math.round(totalMinor / 100),
        currency: "SAR",
      };
      return dispatchToGoogleSheets({
        url: process.env.GOOGLE_SHEETS_WEBHOOK_URL,
        apiKey: process.env.GOOGLE_SHEETS_API_KEY,
        row: updateRow,
      });
    }

    // Legacy fallback — no snapshot, Apps Script's _handleUpsell still
    // understands this shape. Will only stack correctly for the FIRST
    // upsell; we log loud so any stale bundle hitting this branch is
    // surfaced to ops.
    console.warn(
      "[upsell] no priorLines snapshot — falling back to legacy upsell payload",
      { orderId },
    );
    const legacyRow: SheetsUpsellRow = {
      kind: "upsell",
      orderId,
      upsellSku: getProductSku(product),
      upsellProductName: pickLocalized(product.title, "ar"),
      upsellQuantity: 1,
      upsellPrice: Math.round(POST_PURCHASE_OFFER_PRICE.amount / 100),
      currency: "SAR",
    };
    return dispatchToGoogleSheets({
      url: process.env.GOOGLE_SHEETS_WEBHOOK_URL,
      apiKey: process.env.GOOGLE_SHEETS_API_KEY,
      row: legacyRow,
    });
  };

  await Promise.allSettled([
    dispatchWebhook({
      url: process.env.ORDERS_WEBHOOK_URL,
      payload: event,
      secret: process.env.WEBHOOK_SECRET,
    }),
    dispatchSheets(),
  ]);

  return NextResponse.json({
    ok: true,
    orderId,
    line: upsellLine,
  });
}
