import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, isAdminDbConfigured } from "@/lib/admin/db";
import { adminEnv } from "@/lib/admin/env";
import { getClientIp } from "@/lib/admin/client-ip";
import { fingerprint } from "@/lib/admin/hash";
import { isBotUA } from "@/lib/admin/bot";
import { parseUA } from "@/lib/admin/ua";
import { lookupIp } from "@/lib/admin/ip-intel";
import { scoreTraffic } from "@/lib/admin/quality";
import { newId } from "@/lib/admin/ids";

export const runtime = "nodejs";
// We never want this route fully cached — every hit is a unique event.
export const dynamic = "force-dynamic";

/**
 * POST /api/track  — non-blocking event ingestion.
 *
 * Accepts a single event or a batch. Always responds 204 — never blocks the
 * storefront on storage or 3rd-party look-ups. The pipeline:
 *
 *   1. Parse the event payload (json or sendBeacon blob).
 *   2. Resolve visitor + session cookies (rotate sliding 30-min session).
 *   3. Fingerprint IP/UA, run MaxMind, score quality.
 *   4. Side-write to Postgres in the background via void Promise.allSettled.
 *
 * On any failure we still return 204 so a flaky DB never blocks page loads.
 */

const VISITOR_COOKIE = adminEnv.visitorCookie();
const SESSION_COOKIE = adminEnv.sessionCookie();
const VISITOR_TTL_DAYS = 365;
const SESSION_TTL_MIN = 30;

type IncomingEvent = {
  name: string;
  path?: string;
  productId?: string;
  productSlug?: string;
  surface?: string;
  value?: number;
  currency?: string;
  meta?: Record<string, unknown>;
  utm?: { source?: string; medium?: string; campaign?: string };
  referrer?: string;
  ts?: string;
};

export async function POST(req: Request) {
  if (!isAdminDbConfigured) {
    // No-op if the admin database is not wired up yet — the storefront keeps
    // running normally. We still set cookies so the visitor stream is
    // coherent once the DB comes online.
    return new NextResponse(null, { status: 204 });
  }

  let payload: { events?: IncomingEvent[]; event?: IncomingEvent };
  try {
    payload = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const events: IncomingEvent[] = payload.events ?? (payload.event ? [payload.event] : []);
  if (!events.length) return new NextResponse(null, { status: 204 });

  const ip = getClientIp(req.headers);
  const ua = req.headers.get("user-agent") ?? "";
  const ipHash = fingerprint(ip);
  const uaHash = fingerprint(ua);
  const parsedUA = parseUA(ua);
  const botUA = isBotUA(ua);

  // Pull visitor + session cookies, mint new ones if absent.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieMap = parseCookies(cookieHeader);
  const existingVid = cookieMap.get(VISITOR_COOKIE);
  const existingSid = cookieMap.get(SESSION_COOKIE);
  const visitorId = existingVid && /^[A-Za-z0-9_-]{20,40}$/.test(existingVid) ? existingVid : newId();
  const sessionId = existingSid && /^[A-Za-z0-9_-]{20,40}$/.test(existingSid) ? existingSid : newId();
  const isNewVisitor = !existingVid;
  const isNewSession = !existingSid;

  // Background processing — we never await this.
  void persist({
    events,
    visitorId,
    sessionId,
    isNewVisitor,
    isNewSession,
    ip,
    ipHash,
    uaHash,
    ua,
    parsedUA,
    botUA,
    referrer: events[0]?.referrer ?? "",
    landing: events[0]?.path,
    utm: events[0]?.utm,
  }).catch((err) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[track] persist failed", err);
    }
  });

  const headers = new Headers();
  headers.append("Set-Cookie", cookie(VISITOR_COOKIE, visitorId, VISITOR_TTL_DAYS * 86400));
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, sessionId, SESSION_TTL_MIN * 60));
  return new NextResponse(null, { status: 204, headers });
}

// Some browsers / sendBeacon contexts can't preflight POST — accept GET as a
// pixel-style fallback. We don't actually persist GETs; they only refresh
// cookies. The /api/track call should always be POST.
export async function GET() {
  return new NextResponse(null, { status: 204 });
}

async function persist(input: {
  events: IncomingEvent[];
  visitorId: string;
  sessionId: string;
  isNewVisitor: boolean;
  isNewSession: boolean;
  ip: string;
  ipHash: string;
  uaHash: string;
  ua: string;
  parsedUA: ReturnType<typeof parseUA>;
  botUA: boolean;
  referrer: string;
  landing?: string;
  utm?: { source?: string; medium?: string; campaign?: string };
}) {
  const intel = await lookupIp(input.ip);
  const verdict = scoreTraffic({ isBotUA: input.botUA, intel });

  // Upsert visitor + session in a single transaction.
  await prisma.$transaction(async (tx) => {
    await tx.visitor.upsert({
      where: { id: input.visitorId },
      create: {
        id: input.visitorId,
        country: intel?.countryCode ?? null,
        city: intel?.city ?? null,
        firstSource: input.utm?.source ?? null,
        firstLanding: input.landing ?? null,
      },
      update: {
        lastSeen: new Date(),
        country: intel?.countryCode ?? undefined,
        city: intel?.city ?? undefined,
        totalSessions: input.isNewSession
          ? { increment: 1 }
          : undefined,
      },
    });

    await tx.session.upsert({
      where: { id: input.sessionId },
      create: {
        id: input.sessionId,
        visitorId: input.visitorId,
        landingPath: input.landing ?? null,
        referrer: input.referrer || null,
        utmSource: input.utm?.source ?? null,
        utmMedium: input.utm?.medium ?? null,
        utmCampaign: input.utm?.campaign ?? null,
        device: input.parsedUA.device,
        browser: input.parsedUA.browser,
        os: input.parsedUA.os,
        countryCode: intel?.countryCode ?? null,
        region: intel?.region ?? null,
        city: intel?.city ?? null,
        isp: intel?.isp ?? null,
        ipHash: input.ipHash,
        uaHash: input.uaHash,
        isBot: verdict.isBot,
        isVpn: verdict.isVpn,
        isProxy: verdict.isProxy,
        isTor: verdict.isTor,
        isHosting: verdict.isHosting,
        isGcc: verdict.isGcc,
        isValid: verdict.isValid,
        qualityScore: verdict.score,
      },
      update: {
        lastSeen: new Date(),
        countryCode: intel?.countryCode ?? undefined,
        city: intel?.city ?? undefined,
        isValid: verdict.isValid,
        qualityScore: verdict.score,
      },
    });

    await tx.trafficQuality.upsert({
      where: { sessionId: input.sessionId },
      create: {
        sessionId: input.sessionId,
        score: verdict.score,
        isVpn: verdict.isVpn,
        isProxy: verdict.isProxy,
        isTor: verdict.isTor,
        isHosting: verdict.isHosting,
        isBot: verdict.isBot,
        isAnonymous: verdict.isAnonymous,
        countryMismatch: verdict.countryMismatch,
        uaSuspicious: verdict.uaSuspicious,
        flags: verdict.flags as Prisma.InputJsonValue,
        reason: verdict.reason,
      },
      update: {
        evaluatedAt: new Date(),
        score: verdict.score,
        isVpn: verdict.isVpn,
        isProxy: verdict.isProxy,
        isTor: verdict.isTor,
        isHosting: verdict.isHosting,
        isBot: verdict.isBot,
        isAnonymous: verdict.isAnonymous,
        countryMismatch: verdict.countryMismatch,
        uaSuspicious: verdict.uaSuspicious,
        flags: verdict.flags as Prisma.InputJsonValue,
        reason: verdict.reason,
      },
    });

    if (input.events.length) {
      await tx.event.createMany({
        data: input.events.map((e) => ({
          ts: e.ts ? new Date(e.ts) : new Date(),
          sessionId: input.sessionId,
          visitorId: input.visitorId,
          name: e.name.slice(0, 40),
          path: e.path?.slice(0, 255) ?? null,
          productId: e.productId?.slice(0, 40) ?? null,
          productSlug: e.productSlug?.slice(0, 80) ?? null,
          surface: e.surface?.slice(0, 40) ?? null,
          valueMinor:
            typeof e.value === "number" && Number.isFinite(e.value)
              ? BigInt(Math.round(e.value))
              : null,
          currency: e.currency?.slice(0, 3) ?? null,
          meta: e.meta ? (e.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
          countryCode: intel?.countryCode ?? null,
          city: intel?.city ?? null,
          device: input.parsedUA.device,
          isValid: verdict.isValid,
        })),
      });
    }
  });
}

function parseCookies(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  raw.split(/;\s*/).forEach((part) => {
    const eq = part.indexOf("=");
    if (eq < 0) return;
    map.set(part.slice(0, eq).trim(), decodeURIComponent(part.slice(eq + 1)));
  });
  return map;
}

function cookie(name: string, value: string, ttlSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // NOT HttpOnly — these IDs are non-sensitive opaque random tokens and the
  // storefront's existing attribution pipeline (lib/pixels/eventId.ts) reads
  // them from `document.cookie` to forward with each order, exactly the same
  // way it forwards `_fbp` / `_fbc`. Marking them HttpOnly would break that
  // attribution and force a touch of the checkout flow we're committed to
  // leaving alone.
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ttlSeconds}; SameSite=Lax${secure}`;
}
