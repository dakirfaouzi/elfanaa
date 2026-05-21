import { NextResponse } from "next/server";
import { getTrafficQuality, resolveRange } from "@/lib/admin/metrics";
import { serialise } from "@/lib/admin/serialise";
import { safe, collectErrors } from "@/lib/admin/safe";
import { isAdminDbConfigured, adminDbConfigError } from "@/lib/admin/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY = {
  total: 0,
  invalid: 0,
  vpn: 0,
  proxy: 0,
  tor: 0,
  hosting: 0,
  bot: 0,
  anonymous: 0,
  samples: [] as Array<unknown>,
};

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
    "metrics.traffic",
    () => getTrafficQuality(range),
    EMPTY as unknown as Awaited<ReturnType<typeof getTrafficQuality>>
  );
  return NextResponse.json(serialise({ ...result.data, _errors: collectErrors([result]) }));
}
