import { NextResponse } from "next/server";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";
import { dispatchToGoogleSheets, type SheetsOrderRow } from "@/lib/webhooks/google-sheets";
import { getProductById } from "@/data/products";
import { lineTotal } from "@/lib/pricing";
import { sumMoney, pickLocalized } from "@/lib/format";
import { validateSaudiPhone } from "@/lib/phone";
import type { CodOrderInput, Money } from "@/lib/types";

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
  // Each line is tagged `source: "base"` so downstream systems can distinguish
  // them from upsell lines added later via /api/orders/[id]/upsell.
  const lineDetails = input.cart.lines
    .map((line) => {
      const product = getProductById(line.productId);
      if (!product) return null;
      const total = lineTotal(product, line.quantity);
      return {
        productId: product.id,
        title: product.title,
        unitPrice: product.price,
        quantity: line.quantity,
        lineTotal: total,
        source: "base" as const,
      };
    })
    .filter(<T>(x: T): x is NonNullable<T> => Boolean(x));

  const subtotal: Money =
    sumMoney(lineDetails.map((l) => l.lineTotal)) ?? {
      amount: 0,
      currency: input.cart.currency,
    };

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
    lines: lineDetails,
    totals: { subtotal, total: subtotal },
  };

  // ─── Persistence extension point ──────────────────────────────────────────
  // await db.orders.insert(order);
  // ──────────────────────────────────────────────────────────────────────────

  // Sheets row — one source of operational truth even when CRM is down.
  // Per-item subtotals are baked into the items string so a non-technical
  // teammate can read the row without joining other tabs.
  const sheetsRow: SheetsOrderRow = {
    receivedAt: order.createdAt,
    orderId: order.id,
    fullName: order.customer.fullName,
    phone: order.customer.phone,
    phoneE164: order.customer.phoneE164 ?? "",
    items: lineDetails
      .map(
        (l) =>
          `${pickLocalized(l.title, "ar")} × ${l.quantity} (${(
            l.lineTotal.amount / 100
          ).toFixed(0)} ${l.lineTotal.currency})`
      )
      .join(" · "),
    itemCount: lineDetails.reduce((acc, l) => acc + l.quantity, 0),
    subtotal: subtotal.amount / 100,
    currency: subtotal.currency,
    paymentMethod: "cod",
    locale: order.locale,
    source: req.headers.get("referer") ?? "direct",
  };

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
    dispatchToGoogleSheets({
      url: process.env.GOOGLE_SHEETS_WEBHOOK_URL,
      apiKey: process.env.GOOGLE_SHEETS_API_KEY,
      row: sheetsRow,
    }),
  ]);

  // Return the FULL receipt — the storefront persists this to sessionStorage
  // and the thank-you page renders it without a second round-trip.
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
      lines: order.lines,
      totals: order.totals,
    },
  });
}
