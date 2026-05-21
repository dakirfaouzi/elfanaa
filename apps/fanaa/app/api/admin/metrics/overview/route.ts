import { NextResponse } from "next/server";
import {
  getOverview,
  getDailyTrend,
  getTopProducts,
  getTopLandingPages,
  getTopCities,
  getTrafficSources,
  getDeviceMix,
  resolveRange,
} from "@/lib/admin/metrics";
import { serialise } from "@/lib/admin/serialise";
import { safe, collectErrors } from "@/lib/admin/safe";
import { isAdminDbConfigured, adminDbConfigError } from "@/lib/admin/db";
import type { DateRange } from "@/lib/admin/date-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Empty-state shape matching `getOverview`'s return type exactly. We
 * need `range` to be a real `DateRange` (not null) so the structural
 * type matches — the route always knows the resolved range, so we pass
 * it in when building the fallback.
 */
function emptyOverview(range: DateRange): Awaited<ReturnType<typeof getOverview>> {
  return {
    range,
    sessions: { value: 0, delta: null },
    visitors: { value: 0, delta: null },
    validVisitors: { value: 0, delta: null },
    orders: { value: 0, delta: null },
    revenueMinor: { value: 0, delta: null },
    aovMinor: 0,
    rpvMinor: 0,
    conversionRate: 0,
    checkoutConversionRate: 0,
    upsellRate: 0,
    repeatRate: 0,
    productViews: 0,
    ctaClicks: 0,
    addToCart: 0,
    checkoutOpen: 0,
    orderSubmits: 0,
    orderSuccess: 0,
    upsellViews: 0,
    upsellAccepts: 0,
    crossSellAccepts: 0,
    eventCounts: {},
    prevEventCounts: {},
  };
}

/**
 * GET /api/admin/metrics/overview
 *
 * Every sub-metric runs in its own `safe()` bag. A single failing query
 * (missing table, lock timeout, transient disconnect) degrades only its
 * own slice — the rest of the dashboard still loads. Failures are
 * surfaced to the UI via the `_errors` array so the operator sees
 * exactly what broke instead of a generic 500.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = resolveRange(url.searchParams);

  // Short-circuit if the DB isn't configured at all — saves N pointless
  // proxy-throws and gives the UI an immediately-actionable message.
  if (!isAdminDbConfigured) {
    return NextResponse.json(
      serialise({
        overview: emptyOverview(range),
        trend: [],
        products: [],
        landings: [],
        cities: [],
        sources: [],
        devices: [],
        _errors: [
          {
            label: "db.config",
            error: adminDbConfigError() ?? "ADMIN_DATABASE_URL is not set.",
          },
        ],
      })
    );
  }

  const [overview, trend, products, landings, cities, sources, devices] = await Promise.all([
    safe("metrics.overview", () => getOverview(range), emptyOverview(range)),
    safe("metrics.trend", () => getDailyTrend(range), [] as Awaited<ReturnType<typeof getDailyTrend>>),
    safe("metrics.top_products", () => getTopProducts(range), [] as Awaited<ReturnType<typeof getTopProducts>>),
    safe("metrics.top_landings", () => getTopLandingPages(range), [] as Awaited<ReturnType<typeof getTopLandingPages>>),
    safe("metrics.top_cities", () => getTopCities(range), [] as Awaited<ReturnType<typeof getTopCities>>),
    safe("metrics.sources", () => getTrafficSources(range), [] as Awaited<ReturnType<typeof getTrafficSources>>),
    safe("metrics.devices", () => getDeviceMix(range), [] as Awaited<ReturnType<typeof getDeviceMix>>),
  ]);

  return NextResponse.json(
    serialise({
      overview: overview.data,
      trend: trend.data,
      products: products.data,
      landings: landings.data,
      cities: cities.data,
      sources: sources.data,
      devices: devices.data,
      _errors: collectErrors([overview, trend, products, landings, cities, sources, devices]),
    })
  );
}
