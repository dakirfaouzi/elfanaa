/**
 * Geo gate — soft, client-side check.
 *
 * Hits the backend's `/geo/me` endpoint, which proxies to MaxMind. The
 * verdict is *advisory*: we use it to surface a banner in the checkout
 * modal so a customer outside KSA learns immediately why their order
 * won't go through. The authoritative gate still runs on the server
 * when the order is created — this code path can never be used to
 * unblock a non-KSA order.
 *
 * Returns `null` when the backend isn't reachable (degraded network,
 * MaxMind disabled, etc.), in which case the UI must continue without
 * blocking — the server will catch any abuse at order time.
 */

import { apiUrl } from "./api";

export type GeoVerdict = {
  ip: string;
  country: string | null;
  city: string | null;
  allowed: boolean;
  isAnonymous: boolean;
};

const GEO_ENDPOINT = "/api/geo/me";
const GEO_TIMEOUT_MS = 1500;

export async function fetchGeoVerdict(): Promise<GeoVerdict | null> {
  if (typeof window === "undefined") return null;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), GEO_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl(GEO_ENDPOINT), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: ctrl.signal,
      // Geo lookup is per-session; never cache cross-user.
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return null;
    return (await res.json()) as GeoVerdict;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
