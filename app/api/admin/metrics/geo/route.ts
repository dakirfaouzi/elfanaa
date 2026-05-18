import { NextResponse } from "next/server";
import { getGeoBreakdown, resolveRange } from "@/lib/admin/metrics";
import { serialise } from "@/lib/admin/serialise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = resolveRange(url.searchParams);
  return NextResponse.json(serialise(await getGeoBreakdown(range)));
}
