import { adminEnv } from "./env";

/**
 * MaxMind GeoIP2 Insights — IP intelligence used to score traffic quality.
 *
 * We call the *Insights* endpoint (richer than City) because we need the
 * anonymizer traits (`is_anonymous_vpn`, `is_anonymous_proxy`, `is_tor_exit_node`,
 * `is_hosting_provider`). Without those we can't distinguish a Saudi human
 * on mobile from a Saudi-IP datacenter VPN exit node.
 *
 * Failure handling:
 *   • Missing env vars → `null` (filter degrades to UA-only).
 *   • Network or non-2xx → `null` (we never want to block legitimate ingest).
 *   • In-memory LRU cache keeps cost bounded under burst traffic.
 */
const INSIGHTS_URL = "https://geoip.maxmind.com/geoip/v2.1/insights";

export type IpIntel = {
  ip: string;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  postal: string | null;
  isp: string | null;
  organization: string | null;
  isAnonymousVpn: boolean;
  isAnonymousProxy: boolean;
  isHostingProvider: boolean;
  isTorExitNode: boolean;
  isPublicProxy: boolean;
  isResidentialProxy: boolean;
  isAnonymous: boolean;
  userType: string | null;
  staticScore: number;
};

type CacheEntry = { intel: IpIntel; expires: number };
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12h
const CACHE_MAX = 5000;
const cache = new Map<string, CacheEntry>();

/**
 * Look up an IP. Returns `null` if MaxMind isn't configured or the call fails.
 */
export async function lookupIp(ip: string): Promise<IpIntel | null> {
  if (!ip || ip === "0.0.0.0") return null;

  const cached = cache.get(ip);
  if (cached && cached.expires > Date.now()) return cached.intel;

  const account = adminEnv.maxmindAccountId();
  const key = adminEnv.maxmindLicenseKey();
  if (!account || !key) return null;

  try {
    const auth = Buffer.from(`${account}:${key}`).toString("base64");
    const res = await fetch(`${INSIGHTS_URL}/${ip}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      cache: "no-store",
      // 4-second hard cap so a slow vendor never delays ingest.
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as MaxMindInsightsResponse;
    const intel = normalise(ip, data);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(ip, { intel, expires: Date.now() + CACHE_TTL_MS });
    return intel;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[maxmind] insights failed", err);
    }
    return null;
  }
}

function normalise(ip: string, raw: MaxMindInsightsResponse): IpIntel {
  const traits = raw.traits ?? {};
  return {
    ip,
    countryCode: raw.country?.iso_code?.toUpperCase() ?? null,
    region: raw.subdivisions?.[0]?.names?.en ?? null,
    city: raw.city?.names?.en ?? null,
    postal: raw.postal?.code ?? null,
    isp: traits.isp ?? null,
    organization: traits.organization ?? null,
    isAnonymousVpn: !!traits.is_anonymous_vpn,
    isAnonymousProxy: !!traits.is_anonymous_proxy,
    isHostingProvider: !!traits.is_hosting_provider,
    isTorExitNode: !!traits.is_tor_exit_node,
    isPublicProxy: !!traits.is_public_proxy,
    isResidentialProxy: !!traits.is_residential_proxy,
    isAnonymous: !!traits.is_anonymous,
    userType: traits.user_type ?? null,
    staticScore: typeof traits.static_ip_score === "number" ? traits.static_ip_score : 0,
  };
}

type MaxMindInsightsResponse = {
  country?: { iso_code?: string; names?: Record<string, string> };
  subdivisions?: Array<{ names?: Record<string, string> }>;
  city?: { names?: Record<string, string> };
  postal?: { code?: string };
  traits?: {
    isp?: string;
    organization?: string;
    is_anonymous?: boolean;
    is_anonymous_vpn?: boolean;
    is_anonymous_proxy?: boolean;
    is_hosting_provider?: boolean;
    is_tor_exit_node?: boolean;
    is_public_proxy?: boolean;
    is_residential_proxy?: boolean;
    user_type?: string;
    static_ip_score?: number;
  };
};
