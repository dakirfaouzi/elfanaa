import { NextResponse } from "next/server";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";
import {
  dispatchToGoogleSheets,
  type SheetsUpsellRow,
} from "@/lib/webhooks/google-sheets";
import { getProductById } from "@/data/products";
import { POST_PURCHASE_OFFER_PRICE } from "@/lib/upsell/strategy";
import { pickLocalized } from "@/lib/format";
import { getProductSku } from "@/lib/sku";
import type { Locale } from "@/lib/types";

/**
 * POST /api/orders/:orderId/upsell
 *
 * Accepts the post-purchase one-click offer and appends it to the existing
 * COD order. Same payment, same delivery — the customer commits with one
 * tap and we never touch their wallet again.
 *
 * Server-trusted pricing: the route ignores any price the client might send
 * and re-applies the canonical `POST_PURCHASE_OFFER_PRICE` constant. The
 * client cannot up- or down-price the offer via devtools.
 *
 * Side-effects (all fire-and-forget, never block the ack):
 *   • Generic CRM/ERP webhook (`order.upsell_accepted`)
 *   • Google Sheets append (separate row tagged "upsell" so ops can see it
 *     alongside the original order — same orderId, distinct line)
 */

type AcceptUpsellInput = {
  productId: string;
  locale: Locale;
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

  const product = getProductById(input?.productId);
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
    /**
     * Tag so downstream systems can distinguish upsell lines from base lines.
     * Mirrors the `source` tag on base lines from POST /api/orders.
     */
    source: "post_purchase_upsell" as const,
  };

  const event = {
    event: "order.upsell_accepted" as const,
    orderId,
    acceptedAt,
    line: upsellLine,
    locale: input.locale,
  };

  // Sheets payload — Apps Script locates the existing row by orderId and
  // updates SKU / Product name / Total quantity / Variant price in place.
  // Per the brief: the final sheet row must reflect the FINAL real order
  // (base + upsell merged), not a separate upsell entry.
  const sheetsRow: SheetsUpsellRow = {
    kind: "upsell",
    orderId,
    upsellSku: getProductSku(product),
    upsellProductName: pickLocalized(product.title, "ar"),
    upsellQuantity: 1,
    upsellPrice: Math.round(POST_PURCHASE_OFFER_PRICE.amount / 100),
    currency: "SAR",
  };

  await Promise.allSettled([
    dispatchWebhook({
      url: process.env.ORDERS_WEBHOOK_URL,
      payload: event,
      secret: process.env.WEBHOOK_SECRET,
    }),
    dispatchToGoogleSheets({
      url: process.env.GOOGLE_SHEETS_WEBHOOK_URL,
      apiKey: process.env.GOOGLE_SHEETS_API_KEY,
      row: sheetsRow,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    orderId,
    line: upsellLine,
  });
}
