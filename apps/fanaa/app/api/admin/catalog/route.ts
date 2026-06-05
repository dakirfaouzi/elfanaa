import { NextResponse } from "next/server";
import { getCatalogInventory } from "@/lib/admin/catalog-inventory";
import { serialise } from "@/lib/admin/serialise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only catalog inventory (PR A).
 *
 * Auth is enforced by `middleware.ts` for every `/api/admin/*` path, so this
 * handler stays focused on data. The inventory is resilient: when the DB is
 * unconfigured/unreachable it still returns the legacy snapshot products and
 * attaches `_errors` for the dashboard's PartialDataBanner.
 */
export async function GET() {
  const inventory = await getCatalogInventory();
  return NextResponse.json(serialise(inventory));
}
