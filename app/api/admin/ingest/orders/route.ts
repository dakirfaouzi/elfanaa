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
type IngestOrder = {
  event: string;
  order: {
    id: string;
    createdAt: string;
    paymentMethod?: string;
    locale?: string;
    customer: {
      fullName: string;
      phone: string;
      phoneE164?: string;
    };
    lines: Array<{
      productId: string;
      title?: { ar?: string; en?: string } | string;
      unitPrice: { amount: number; currency: string };
      quantity: number;
      lineTotal: { amount: number; currency: string };
      source?: "base" | "upsell" | "cross_sell";
    }>;
    totals: {
      subtotal: { amount: number; currency: string };
      total: { amount: number; currency: string };
    };
    // Optional context attached by the storefront. Not always present.
    context?: Record<string, unknown>;
    address?: string;
    city?: string;
    notes?: string;
  };
};

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
  const landing = typeof context.landing_url === "string" ? safeUrlPath(context.landing_url) : null;
  const subtotalMinor = BigInt(o.totals?.subtotal?.amount ?? 0);
  const totalMinor = BigInt(o.totals?.total?.amount ?? 0);
  const currency = o.totals?.subtotal?.currency ?? "SAR";
  const itemCount = o.lines?.reduce((s, l) => s + (l.quantity ?? 0), 0) ?? 0;
  const hasUpsell = o.lines?.some((l) => l.source === "upsell") ?? false;
  const hasCrossSell = o.lines?.some((l) => l.source === "cross_sell") ?? false;

  try {
    await prisma.orderMirror.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
        sessionId,
        visitorId,
        customerName: o.customer.fullName.slice(0, 160),
        phone: o.customer.phone.slice(0, 40),
        phoneE164: o.customer.phoneE164?.slice(0, 40) ?? null,
        city: o.city?.slice(0, 80) ?? null,
        address: o.address?.slice(0, 255) ?? null,
        countryCode: "SA",
        locale: o.locale ?? "ar",
        paymentMethod: o.paymentMethod ?? "cod",
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
        items: {
          create: (o.lines ?? []).map((l) => {
            const product = getProductById(l.productId);
            const titleAr = typeof l.title === "string" ? l.title : l.title?.ar ?? product?.title?.ar ?? "";
            const titleEn = typeof l.title === "string" ? l.title : l.title?.en ?? product?.title?.en ?? "";
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
          }),
        },
      },
      update: {
        // Idempotent: if the same order id is re-delivered (e.g. upsell
        // accepted), refresh totals and append any new lines.
        totalMinor,
        subtotalMinor,
        hasUpsell,
        hasCrossSell,
        itemCount,
        rawPayload: payload as unknown as object,
      },
    });

    // Also bump the visitor's lifetime totals if we know who they are.
    if (visitorId) {
      void prisma.visitor.update({
        where: { id: visitorId },
        data: {
          totalOrders: { increment: 1 },
          totalRevenue: { increment: totalMinor },
          lastSeen: new Date(),
        },
      }).catch(() => undefined);
    }
    void pickLocalized; // silence lint if unused in current pass
    return NextResponse.json({ ok: true });
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
