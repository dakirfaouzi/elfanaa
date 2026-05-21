import { NextResponse } from "next/server";
import { getGeoBreakdown, resolveRange } from "@/lib/admin/metrics";
import { serialise } from "@/lib/admin/serialise";
import { safe, collectErrors } from "@/lib/admin/safe";
import { isAdminDbConfigured, adminDbConfigError } from "@/lib/admin/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY = { cities: [], isps: [], browsers: [], oses: [] };

export async function GET(req: Request) {
  if (!isAdminDbConfigured) {
    return NextResponse.json(
      serialise({
        ...EMPTY,
        _errors: [{ label: "db.config", error: adminDbConfigError() ?? "ADMIN_DATABASE_URL is not set." }],
      })
    );
  }
  const url = new URL(req.url);
  const range = resolveRange(url.searchParams);
  const result = await safe(
    "metrics.geo",
    () => getGeoBreakdown(range),
    EMPTY as Awaited<ReturnType<typeof getGeoBreakdown>>
  );
  return NextResponse.json(serialise({ ...result.data, _errors: collectErrors([result]) }));
}
