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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = resolveRange(url.searchParams);
  const [overview, trend, products, landings, cities, sources, devices] = await Promise.all([
    getOverview(range),
    getDailyTrend(range),
    getTopProducts(range),
    getTopLandingPages(range),
    getTopCities(range),
    getTrafficSources(range),
    getDeviceMix(range),
  ]);
  return NextResponse.json(
    serialise({ overview, trend, products, landings, cities, sources, devices })
  );
}
