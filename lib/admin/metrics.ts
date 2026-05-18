import { prisma } from "./db";
import { resolveRange, type DateRange } from "./date-range";

/**
 * Single source of truth for the dashboard's analytical aggregations.
 *
 * Every query here filters by `isValid = true` so analytics only reflect
 * real GCC humans. The Traffic Quality page is the only surface that opts
 * in to seeing the unfiltered stream.
 */

export function pctDelta(curr: number, prev: number): number | null {
  if (!prev) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export async function getOverview(range: DateRange) {
  const { from, to, prevFrom, prevTo } = range;

  const [sessions, valid, prevSessions, prevValid] = await Promise.all([
    prisma.session.count({ where: { startedAt: { gte: from, lte: to } } }),
    prisma.session.count({ where: { startedAt: { gte: from, lte: to }, isValid: true } }),
    prisma.session.count({ where: { startedAt: { gte: prevFrom, lte: prevTo } } }),
    prisma.session.count({
      where: { startedAt: { gte: prevFrom, lte: prevTo }, isValid: true },
    }),
  ]);

  const [visitors, prevVisitors] = await Promise.all([
    prisma.visitor.count({ where: { lastSeen: { gte: from, lte: to } } }),
    prisma.visitor.count({ where: { lastSeen: { gte: prevFrom, lte: prevTo } } }),
  ]);

  const eventCounts = await prisma.event.groupBy({
    by: ["name"],
    where: { ts: { gte: from, lte: to }, isValid: true },
    _count: { _all: true },
  });
  const prevEventCounts = await prisma.event.groupBy({
    by: ["name"],
    where: { ts: { gte: prevFrom, lte: prevTo }, isValid: true },
    _count: { _all: true },
  });

  const byName = (rows: typeof eventCounts) =>
    Object.fromEntries(rows.map((r) => [r.name, r._count._all])) as Record<string, number>;
  const ec = byName(eventCounts);
  const pec = byName(prevEventCounts);

  const productViews = ec["product_view"] ?? 0;
  const ctaClicks = ec["cta_click"] ?? 0;
  const addToCart = ec["add_to_cart"] ?? 0;
  const checkoutOpen = ec["checkout_open"] ?? 0;
  const orderSubmits = ec["order_submit"] ?? 0;
  const orderSuccess = ec["order_success"] ?? 0;
  const upsellViews = ec["upsell_view"] ?? 0;
  const upsellAccepts = ec["upsell_accept"] ?? 0;
  const crossSellAccepts = ec["cross_sell_accept"] ?? 0;

  const [orderAgg, prevOrderAgg, repeatVisitors, totalVisitorsWithOrders] = await Promise.all([
    prisma.orderMirror.aggregate({
      where: { createdAt: { gte: from, lte: to } },
      _sum: { totalMinor: true, itemCount: true },
      _count: { _all: true },
    }),
    prisma.orderMirror.aggregate({
      where: { createdAt: { gte: prevFrom, lte: prevTo } },
      _sum: { totalMinor: true },
      _count: { _all: true },
    }),
    prisma.visitor.count({
      where: { totalOrders: { gt: 1 }, lastSeen: { gte: from, lte: to } },
    }),
    prisma.visitor.count({
      where: { totalOrders: { gt: 0 }, lastSeen: { gte: from, lte: to } },
    }),
  ]);

  const orders = orderAgg._count._all;
  const revenue = Number(orderAgg._sum.totalMinor ?? 0);
  const prevOrders = prevOrderAgg._count._all;
  const prevRevenue = Number(prevOrderAgg._sum.totalMinor ?? 0);
  const aov = orders ? Math.round(revenue / orders) : 0;
  const rpv = valid ? Math.round(revenue / valid) : 0;

  const conversionRate = valid ? (orders / valid) * 100 : 0;
  const checkoutConv = checkoutOpen ? (orders / checkoutOpen) * 100 : 0;
  const upsellRate = upsellViews ? (upsellAccepts / upsellViews) * 100 : 0;
  const repeatRate = totalVisitorsWithOrders
    ? (repeatVisitors / totalVisitorsWithOrders) * 100
    : 0;

  return {
    range: { from, to, prevFrom, prevTo, preset: range.preset },
    sessions: { value: sessions, delta: pctDelta(sessions, prevSessions) },
    visitors: { value: visitors, delta: pctDelta(visitors, prevVisitors) },
    validVisitors: { value: valid, delta: pctDelta(valid, prevValid) },
    orders: { value: orders, delta: pctDelta(orders, prevOrders) },
    revenueMinor: { value: revenue, delta: pctDelta(revenue, prevRevenue) },
    aovMinor: aov,
    rpvMinor: rpv,
    conversionRate: round1(conversionRate),
    checkoutConversionRate: round1(checkoutConv),
    upsellRate: round1(upsellRate),
    repeatRate: round1(repeatRate),
    productViews,
    ctaClicks,
    addToCart,
    checkoutOpen,
    orderSubmits,
    orderSuccess,
    upsellViews,
    upsellAccepts,
    crossSellAccepts,
    eventCounts: ec,
    prevEventCounts: pec,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Daily time series for the headline revenue + sessions chart. */
export async function getDailyTrend(range: DateRange) {
  const { from, to } = range;
  // Postgres date_trunc — Prisma's groupBy can't do this in pure ORM yet.
  const rows = await prisma.$queryRaw<
    Array<{ day: Date; sessions: bigint; valid: bigint; orders: bigint; revenue: bigint }>
  >`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', ${from}::timestamptz),
        date_trunc('day', ${to}::timestamptz),
        interval '1 day'
      ) AS day
    ),
    sess AS (
      SELECT date_trunc('day', started_at) AS day,
             COUNT(*) AS sessions,
             SUM(CASE WHEN is_valid THEN 1 ELSE 0 END) AS valid
      FROM session
      WHERE started_at >= ${from} AND started_at <= ${to}
      GROUP BY 1
    ),
    ords AS (
      SELECT date_trunc('day', created_at) AS day,
             COUNT(*) AS orders,
             SUM(total_minor) AS revenue
      FROM order_mirror
      WHERE created_at >= ${from} AND created_at <= ${to}
      GROUP BY 1
    )
    SELECT d.day,
           COALESCE(sess.sessions, 0)::bigint  AS sessions,
           COALESCE(sess.valid, 0)::bigint     AS valid,
           COALESCE(ords.orders, 0)::bigint    AS orders,
           COALESCE(ords.revenue, 0)::bigint   AS revenue
      FROM days d
      LEFT JOIN sess ON sess.day = d.day
      LEFT JOIN ords ON ords.day = d.day
      ORDER BY d.day;
  `;
  return rows.map((r) => ({
    day: new Date(r.day).toISOString().slice(0, 10),
    sessions: Number(r.sessions),
    valid: Number(r.valid),
    orders: Number(r.orders),
    revenueMinor: Number(r.revenue),
  }));
}

export async function getTopProducts(range: DateRange, limit = 8) {
  const rows = await prisma.orderMirrorItem.groupBy({
    by: ["productId", "productSlug", "title"],
    where: { order: { createdAt: { gte: range.from, lte: range.to } } },
    _sum: { totalMinor: true, quantity: true },
    _count: { _all: true },
    orderBy: { _sum: { totalMinor: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({
    productId: r.productId,
    slug: r.productSlug,
    title: r.title,
    revenueMinor: Number(r._sum.totalMinor ?? 0),
    units: Number(r._sum.quantity ?? 0),
    orders: r._count._all,
  }));
}

export async function getTopLandingPages(range: DateRange, limit = 8) {
  const rows = await prisma.$queryRaw<
    Array<{ path: string; sessions: bigint; orders: bigint }>
  >`
    SELECT s.landing_path AS path,
           COUNT(*) FILTER (WHERE s.is_valid)::bigint AS sessions,
           COUNT(o.id)::bigint                       AS orders
      FROM session s
      LEFT JOIN order_mirror o ON o.session_id = s.id
     WHERE s.started_at >= ${range.from}
       AND s.started_at <= ${range.to}
       AND s.landing_path IS NOT NULL
     GROUP BY 1
     ORDER BY sessions DESC
     LIMIT ${limit};
  `;
  return rows.map((r) => ({
    path: r.path,
    sessions: Number(r.sessions),
    orders: Number(r.orders),
    cr: r.sessions > 0n ? round1((Number(r.orders) / Number(r.sessions)) * 100) : 0,
  }));
}

export async function getTopCities(range: DateRange, limit = 8) {
  const rows = await prisma.session.groupBy({
    by: ["city", "countryCode"],
    where: { startedAt: { gte: range.from, lte: range.to }, isValid: true, city: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({
    city: r.city,
    countryCode: r.countryCode,
    sessions: r._count._all,
  }));
}

export async function getTrafficSources(range: DateRange) {
  const rows = await prisma.session.groupBy({
    by: ["utmSource"],
    where: { startedAt: { gte: range.from, lte: range.to }, isValid: true },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
  return rows.map((r) => ({ source: r.utmSource ?? "direct", sessions: r._count._all }));
}

export async function getDeviceMix(range: DateRange) {
  const rows = await prisma.session.groupBy({
    by: ["device"],
    where: { startedAt: { gte: range.from, lte: range.to }, isValid: true },
    _count: { _all: true },
  });
  return rows.map((r) => ({ device: r.device ?? "unknown", sessions: r._count._all }));
}

/** Funnel — events from product view → order success. */
export async function getFunnel(range: DateRange) {
  const { from, to } = range;
  const stages = [
    "product_view",
    "cta_click",
    "add_to_cart",
    "checkout_open",
    "order_submit",
    "order_success",
  ] as const;

  const rows = await prisma.event.groupBy({
    by: ["name"],
    where: { ts: { gte: from, lte: to }, isValid: true, name: { in: stages as unknown as string[] } },
    _count: { _all: true },
  });
  const by = Object.fromEntries(rows.map((r) => [r.name, r._count._all])) as Record<string, number>;
  const series = stages.map((s) => ({ stage: s, count: by[s] ?? 0 }));

  // Drop-offs relative to previous stage.
  const withDrop = series.map((s, i) => {
    const prev = i === 0 ? s.count : series[i - 1].count;
    const dropRate = prev > 0 ? round1(((prev - s.count) / prev) * 100) : 0;
    return { ...s, dropRate };
  });

  // Upsell sub-funnel.
  const upsellViews = by["upsell_view"] ?? 0;
  const upsellAccepts = by["upsell_accept"] ?? 0;
  return { stages: withDrop, upsellViews, upsellAccepts };
}

export async function getProductPerformance(range: DateRange) {
  const { from, to } = range;
  // Server-side joinable shape — events + orders combined per product.
  const rows = await prisma.$queryRaw<
    Array<{
      product_id: string;
      product_slug: string | null;
      views: bigint;
      cta_clicks: bigint;
      add_to_carts: bigint;
      orders: bigint;
      units: bigint;
      revenue: bigint;
    }>
  >`
    WITH ev AS (
      SELECT product_id,
             MAX(product_slug) AS product_slug,
             COUNT(*) FILTER (WHERE name = 'product_view')  AS views,
             COUNT(*) FILTER (WHERE name = 'cta_click')     AS cta_clicks,
             COUNT(*) FILTER (WHERE name = 'add_to_cart')   AS add_to_carts
        FROM event
       WHERE ts >= ${from} AND ts <= ${to}
         AND is_valid
         AND product_id IS NOT NULL
       GROUP BY product_id
    ),
    ord AS (
      SELECT oi.product_id,
             COUNT(DISTINCT o.id) AS orders,
             SUM(oi.quantity)     AS units,
             SUM(oi.total_minor)  AS revenue
        FROM order_mirror_item oi
        JOIN order_mirror o ON o.id = oi.order_id
       WHERE o.created_at >= ${from} AND o.created_at <= ${to}
       GROUP BY oi.product_id
    )
    SELECT COALESCE(ev.product_id, ord.product_id)::text  AS product_id,
           ev.product_slug,
           COALESCE(ev.views, 0)::bigint                  AS views,
           COALESCE(ev.cta_clicks, 0)::bigint             AS cta_clicks,
           COALESCE(ev.add_to_carts, 0)::bigint           AS add_to_carts,
           COALESCE(ord.orders, 0)::bigint                AS orders,
           COALESCE(ord.units, 0)::bigint                 AS units,
           COALESCE(ord.revenue, 0)::bigint               AS revenue
      FROM ev
      FULL OUTER JOIN ord ON ord.product_id = ev.product_id
     ORDER BY revenue DESC NULLS LAST, views DESC;
  `;
  return rows.map((r) => {
    const views = Number(r.views);
    const orders = Number(r.orders);
    return {
      productId: r.product_id,
      slug: r.product_slug,
      views,
      ctaClicks: Number(r.cta_clicks),
      addToCarts: Number(r.add_to_carts),
      orders,
      units: Number(r.units),
      revenueMinor: Number(r.revenue),
      ctr: views > 0 ? round1((Number(r.cta_clicks) / views) * 100) : 0,
      conversionRate: views > 0 ? round1((orders / views) * 100) : 0,
      aovMinor: orders > 0 ? Math.round(Number(r.revenue) / orders) : 0,
    };
  });
}

export async function getGeoBreakdown(range: DateRange) {
  const { from, to } = range;
  const cities = await prisma.session.groupBy({
    by: ["countryCode", "region", "city"],
    where: { startedAt: { gte: from, lte: to }, isValid: true, city: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: 30,
  });
  const isps = await prisma.session.groupBy({
    by: ["isp"],
    where: { startedAt: { gte: from, lte: to }, isValid: true, isp: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: 15,
  });
  const browsers = await prisma.session.groupBy({
    by: ["browser"],
    where: { startedAt: { gte: from, lte: to }, isValid: true },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: 8,
  });
  const oses = await prisma.session.groupBy({
    by: ["os"],
    where: { startedAt: { gte: from, lte: to }, isValid: true },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: 8,
  });
  return {
    cities: cities.map((r) => ({
      country: r.countryCode,
      region: r.region,
      city: r.city,
      sessions: r._count._all,
    })),
    isps: isps.map((r) => ({ isp: r.isp, sessions: r._count._all })),
    browsers: browsers.map((r) => ({ browser: r.browser ?? "Unknown", sessions: r._count._all })),
    oses: oses.map((r) => ({ os: r.os ?? "Unknown", sessions: r._count._all })),
  };
}

export async function getTrafficQuality(range: DateRange) {
  const { from, to } = range;
  const [total, invalid, vpn, proxy, tor, hosting, bot, anonymous] = await Promise.all([
    prisma.session.count({ where: { startedAt: { gte: from, lte: to } } }),
    prisma.session.count({ where: { startedAt: { gte: from, lte: to }, isValid: false } }),
    prisma.session.count({ where: { startedAt: { gte: from, lte: to }, isVpn: true } }),
    prisma.session.count({ where: { startedAt: { gte: from, lte: to }, isProxy: true } }),
    prisma.session.count({ where: { startedAt: { gte: from, lte: to }, isTor: true } }),
    prisma.session.count({ where: { startedAt: { gte: from, lte: to }, isHosting: true } }),
    prisma.session.count({ where: { startedAt: { gte: from, lte: to }, isBot: true } }),
    prisma.trafficQuality.count({
      where: {
        isAnonymous: true,
        session: { startedAt: { gte: from, lte: to } },
      },
    }),
  ]);
  const recent = await prisma.session.findMany({
    where: { startedAt: { gte: from, lte: to }, isValid: false },
    include: { traffic: true },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return {
    total,
    invalid,
    vpn,
    proxy,
    tor,
    hosting,
    bot,
    anonymous,
    samples: recent.map((s) => ({
      id: s.id,
      ts: s.startedAt,
      country: s.countryCode,
      city: s.city,
      isp: s.isp,
      device: s.device,
      browser: s.browser,
      os: s.os,
      score: s.qualityScore,
      flags: (s.traffic?.flags as string[] | null) ?? [],
      reason: s.traffic?.reason ?? null,
    })),
  };
}

export { resolveRange };
