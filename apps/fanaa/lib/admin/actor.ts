import "server-only";

import { cookies } from "next/headers";
import { adminCookieName, verifyAdminToken } from "@/lib/admin/auth";

/**
 * Best-effort admin identity for audit fields (e.g. `archivedBy`).
 *
 * The request already passed `middleware.ts`'s JWT gate before reaching any
 * `/api/admin/*` handler, so the cookie is trustworthy here. We re-verify
 * defensively and return the `sub` (operator email), or `null` if anything
 * is off — the actor is an audit nicety, never an authorization gate.
 */
export async function getAdminActor(): Promise<string | null> {
  try {
    const jar = await cookies();
    const token = jar.get(adminCookieName())?.value;
    if (!token) return null;
    const claims = await verifyAdminToken(token);
    return claims?.sub ?? null;
  } catch {
    return null;
  }
}
