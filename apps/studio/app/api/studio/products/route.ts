import { NextResponse } from "next/server";
import {
  listProducts,
  listPublishedStores,
} from "@/lib/studio/product-loader";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio/products
 *
 * Returns every product bundle under `.platform-data/products/<storeId>/`,
 * grouped by store. The middleware enforces JWT auth — unauthenticated
 * callers never reach this handler.
 *
 * # Response shape
 *
 *   {
 *     "stores": [
 *       {
 *         "storeId": "fanaa",
 *         "products": [ ProductSummary, … ]
 *       }
 *     ]
 *   }
 *
 * Corrupted bundles appear in the list with `corrupted: { reason }`.
 * The Studio UI shows them with a warning so the operator can
 * investigate.
 */
export async function GET() {
  const storeIds = await listPublishedStores();
  const stores = [];
  for (const storeId of storeIds) {
    const products = await listProducts(storeId);
    stores.push({ storeId, products });
  }
  return NextResponse.json({ stores });
}
