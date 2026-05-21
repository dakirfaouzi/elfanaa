import { NextResponse } from "next/server";
import { prisma, isAdminDbConfigured } from "@/lib/admin/db";
import { adminEnv } from "@/lib/admin/env";
import { verifySignature } from "@/lib/webhooks/verify";
import {
  WEBHOOK_HEADER_TIMESTAMP,
  WEBHOOK_HEADER_SIGNATURE,
} from "@/lib/brand";
import { getProductById } from "@/data/products";
import { pickLocalized } from "@/lib/format";
import { getClientIp } from "@/lib/admin/client-ip";
import { fingerprint } from "@/lib/admin/hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Order ingestion sink.
 *
 * Point the existing ORDERS_WEBHOOK_URL at this route. Every successful COD
 * order will fan out here with the standard HMAC envelope:
 *
 *   POST /api/admin/ingest/orders
 *   x-elfanaa-timestamp: <unix>
 *   x-elfanaa-signature: <hex>
 *   { event: "order.created", order: { ... } }
 *
 * We mirror it into Postgres for the dashboard. The existing /api/orders
 * route is NOT modified — this is a pure subscriber.
 *
 * On any failure we return 200 (the dispatcher will record `{ ok: true }`
 * but our internal log captures the reason). Refusing the webhook would
 * incorrectly mark orders as failed in operations dashboards downstream.
 */

// This route is admin-internal but the middleware excludes /api/admin/auth/*
// — we exclude /api/admin/ingest/* as a separate path under the matcher,
// signed by HMAC instead of admin JWT.
//
// Schema is intentionally permissive on the wire. Both upstreams write
// here through `ORDERS_WEBHOOK_URL`:
//
//   • Next.js fallback (`app/api/orders/route.ts`) — camelCase
//     `lines[]` with `unitPrice: { amount, currency }`.
//   • FastAPI (`backend/app/services/orders.py::_order_to_payload`) —
//     now emits BOTH camelCase `lines[]` AND snake_case `items[]` with
//     `unit_price_minor`. Before that fix the admin DB stored 0-item
//     orders for FastAPI-served traffic.
//
// `normaliseLines` below collapses any shape to the single internal
// `IngestLine` shape so the rest of the route never has to branch.
type IngestLine = {
  productId: string;
  title?: { ar?: string; en?: string } | string;
  unitPrice: { amount: number; currency: string };
  quantity: number;
  lineTotal: { amount: number; currency: string };
  source?: "base" | "upsell" | "cross_sell";
  /** Per-product canonical URL — optional, archived in rawPayload. */
  url?: string;
};

type RawLine =
  | IngestLine
  | {
      // FastAPI snake_case shape — same data, different keys.
      product_id?: string;
      title?: { ar?: string; en?: string } | string;
      unit_price_minor?: number;
      line_total_minor?: number;
      currency?: string;
      quantity?: number;
      source?: "base" | "upsell" | "cross_sell";
      url?: string;
    };

type IngestOrder = {
  event: string;
  order: {
    id: string;
    createdAt?: string;
    created_at?: string;
    paymentMethod?: string;
    payment_method?: string;
    locale?: string;
    customer: {
      fullName?: string;
      full_name?: string;
      phone?: string;
      phoneE164?: string;
      phone_e164?: string;
    };
    lines?: RawLine[];
    items?: RawLine[];
    totals?: {
      subtotal?: { amount?: number; currency?: string };
      total?: { amount?: number; currency?: string };
      subtotal_minor?: number;
      total_minor?: number;
      currency?: string;
    };
    // Optional context attached by the storefront. Not always present.
    context?: Record<string, unknown>;
    address?: string;
    city?: string;
    notes?: string;
  };
};

/**
 * Collapses Next.js camelCase + FastAPI snake_case line shapes onto
 * the single internal `IngestLine` shape. Missing fields default to
 * zeros / "SAR" rather than being dropped — the goal is "never
 * silently lose a product" (the brief's hard rule).
 */
function normaliseLines(raw: RawLine[] | undefined): IngestLine[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((r) => {
    const camel = r as IngestLine;
    const snake = r as Exclude<RawLine, IngestLine>;
    const productId = camel.productId ?? snake.product_id ?? "";
    const currency =
      camel.unitPrice?.currency ?? snake.currency ?? "SAR";
    const unitAmount =
      camel.unitPrice?.amount ?? snake.unit_price_minor ?? 0;
    const totalAmount =
      camel.lineTotal?.amount ?? snake.line_total_minor ?? 0;
    return {
      productId,
      title: camel.title ?? snake.title,
      unitPrice: { amount: unitAmount, currency },
      lineTotal: { amount: totalAmount, currency },
      quantity: camel.quantity ?? snake.quantity ?? 1,
      source: camel.source ?? snake.source,
      url: camel.url ?? snake.url,
    };
  });
}

function normaliseTotals(t: IngestOrder["order"]["totals"], fallbackCurrency: string) {
  const subtotalMinor = BigInt(
    t?.subtotal?.amount ?? t?.subtotal_minor ?? 0,
  );
  const totalMinor = BigInt(t?.total?.amount ?? t?.total_minor ?? 0);
  const currency =
    t?.subtotal?.currency ?? t?.total?.currency ?? t?.currency ?? fallbackCurrency;
  return { subtotalMinor, totalMinor, currency };
}

export async function POST(req: Request) {
  const raw = await req.text();
  const ts = Number(req.headers.get(WEBHOOK_HEADER_TIMESTAMP) ?? 0);
  const sig = req.headers.get(WEBHOOK_HEADER_SIGNATURE) ?? "";
  const secret = adminEnv.webhookSecret();

  if (!secret || !ts || !sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 401 });
  }
  if (!verifySignature(raw, secret, ts, sig)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  if (!isAdminDbConfigured) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let payload: IngestOrder;
  try {
    payload = JSON.parse(raw) as IngestOrder;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (payload.event !== "order.created" || !payload.order?.id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const o = payload.order;
  const context = (o.context ?? {}) as Record<string, unknown>;
  const sessionId = typeof context.session_id === "string" ? context.session_id : null;
  const visitorId = typeof context.visitor_id === "string" ? context.visitor_id : null;
  const landing =
    typeof context.landing_url === "string"
      ? safeUrlPath(context.landing_url)
      : null;

  // Accept either `lines` (camelCase, both Next.js and updated FastAPI)
  // or `items` (snake-case, legacy FastAPI). `normaliseLines` collapses
  // both shapes onto the single internal contract. Preferring `lines`
  // matches the brief's "thank-you page is already correct — the loss
  // happens downstream" — we never want this route to be the truncation
  // point either.
  const rawLines = o.lines ?? o.items ?? [];
  const lines = normaliseLines(rawLines);

  const { subtotalMinor, totalMinor, currency } = normaliseTotals(o.totals, "SAR");
  const itemCount = lines.reduce((s, l) => s + (l.quantity ?? 0), 0);
  const hasUpsell = lines.some((l) => l.source === "upsell");
  const hasCrossSell = lines.some((l) => l.source === "cross_sell");

  const createdAtIso = o.createdAt ?? o.created_at;
  const paymentMethod = o.paymentMethod ?? o.payment_method ?? "cod";

  // Customer fields — accept either camelCase or snake_case.
  const customerName = (
    o.customer?.fullName ?? o.customer?.full_name ?? ""
  ).slice(0, 160);
  const customerPhone = (
    o.customer?.phone ?? o.customer?.phoneE164 ?? o.customer?.phone_e164 ?? ""
  ).slice(0, 40);
  const customerPhoneE164 = (
    o.customer?.phoneE164 ?? o.customer?.phone_e164 ?? ""
  ).slice(0, 40) || null;

  try {
    // Items must reflect the ORDER'S CURRENT FULL STATE every time
    // (upsell accepted, additional offer accepted, …). Without
    // rebuilding here the admin DB would freeze with whatever shape
    // the `order.created` event carried first time around, and every
    // subsequent re-fire from the FastAPI upsell endpoint would only
    // update totals — items would stay at the original (smaller) set.
    //
    // Strategy: detect whether the row exists (for the visitor-totals
    // delta below) and then upsert; on UPDATE, drop existing items and
    // recreate from the latest payload inside a single transaction.
    // OrderMirrorItem.onDelete is Cascade in the Prisma schema so this
    // is safe.
    const itemsCreatePayload = lines.map((l) => {
      const product = getProductById(l.productId);
      const titleAr =
        typeof l.title === "string"
          ? l.title
          : l.title?.ar ?? product?.title?.ar ?? "";
      const titleEn =
        typeof l.title === "string"
          ? l.title
          : l.title?.en ?? product?.title?.en ?? "";
      const title = (titleAr || titleEn || l.productId).slice(0, 160);
      return {
        productId: l.productId,
        productSlug: product?.slug ?? null,
        title,
        quantity: l.quantity ?? 1,
        unitMinor: BigInt(l.unitPrice?.amount ?? 0),
        totalMinor: BigInt(l.lineTotal?.amount ?? 0),
        source: l.source ?? "base",
      };
    });

    // Snapshot the pre-state OUTSIDE the transaction so we can decide
    // whether to increment the visitor's lifetime counters without
    // double-counting on re-fires.
    const preExisting = await prisma.orderMirror.findUnique({
      where: { id: o.id },
      select: { id: true, totalMinor: true },
    });

    await prisma.$transaction(async (tx) => {
      if (preExisting) {
        await tx.orderMirrorItem.deleteMany({ where: { orderId: o.id } });
        await tx.orderMirror.update({
          where: { id: o.id },
          data: {
            totalMinor,
            subtotalMinor,
            hasUpsell,
            hasCrossSell,
            itemCount,
            paymentMethod,
            city: o.city?.slice(0, 80) ?? null,
            address: o.address?.slice(0, 255) ?? null,
            currency,
            rawPayload: payload as unknown as object,
            items: { create: itemsCreatePayload },
          },
        });
      } else {
        await tx.orderMirror.create({
          data: {
            id: o.id,
            createdAt: createdAtIso ? new Date(createdAtIso) : new Date(),
            sessionId,
            visitorId,
            customerName,
            phone: customerPhone,
            phoneE164: customerPhoneE164,
            city: o.city?.slice(0, 80) ?? null,
            address: o.address?.slice(0, 255) ?? null,
            countryCode: "SA",
            locale: o.locale ?? "ar",
            paymentMethod,
            status: "pending",
            subtotalMinor,
            totalMinor,
            currency,
            itemCount,
            hasUpsell,
            hasCrossSell,
            sourcePath: landing,
            ipHash: fingerprint(getClientIp(req.headers)),
            rawPayload: payload as unknown as object,
            items: { create: itemsCreatePayload },
          },
        });
      }
    });

    // Visitor lifetime totals — only increment on FIRST sighting.
    // On re-fires (upsell accept, additional offers) update the
    // running revenue by the DELTA so the customer's lifetime value
    // reflects the grown order without double-counting.
    if (visitorId) {
      if (preExisting) {
        const delta = totalMinor - preExisting.totalMinor;
        if (delta !== BigInt(0)) {
          void prisma.visitor
            .update({
              where: { id: visitorId },
              data: {
                totalRevenue: { increment: delta },
                lastSeen: new Date(),
              },
            })
            .catch(() => undefined);
        }
      } else {
        void prisma.visitor
          .update({
            where: { id: visitorId },
            data: {
              totalOrders: { increment: 1 },
              totalRevenue: { increment: totalMinor },
              lastSeen: new Date(),
            },
          })
          .catch(() => undefined);
      }
    }
    void pickLocalized; // silence lint if unused in current pass
    return NextResponse.json({
      ok: true,
      lines: lines.length,
      mode: preExisting ? "update" : "create",
    });
  } catch (err) {
    console.error("[admin/ingest/orders] persist failed", err);
    // Always 200 so the outbound dispatcher doesn't mark the order as failed.
    return NextResponse.json({ ok: false, deferred: true });
  }
}

function safeUrlPath(href: string): string | null {
  try {
    const u = new URL(href);
    return (u.pathname + u.search).slice(0, 255);
  } catch {
    return null;
  }
}
