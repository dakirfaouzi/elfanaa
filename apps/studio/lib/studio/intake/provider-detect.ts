/**
 * Universal supplier-URL provider detection.
 *
 * # Why this exists
 *
 * Pre-M14 the intake form's hint text said "Alibaba / AliExpress /
 * Taobao" and the placeholder was an Alibaba URL. The research stage
 * (Firecrawl + Anthropic vision) is actually completely
 * provider-agnostic — it scrapes any product page — but the UI
 * implied an artificial restriction. This module gives the form a
 * way to (a) tell the operator which platform we detected, (b)
 * surface platform-aware tips, and (c) eventually let the research
 * stage pick a specialized extractor when one helps.
 *
 * # Design constraints
 *
 *   1. PURE function. No network. No I/O. Operates on URL alone.
 *      Runs in the browser on every keystroke — keep it fast.
 *   2. NEVER throws. Returns `"generic"` for anything unrecognized,
 *      including malformed URLs. The form already has a
 *      `.url()` Zod check; this module is purely informational.
 *   3. Detection is HOSTNAME-only, not path-pattern. Reason: path
 *      patterns drift faster than hostnames (every platform
 *      reshuffles URL structure every couple years), and we ship
 *      this in the operator UI where false-positives are worse
 *      than `"generic"`.
 *
 * # Adding a new platform
 *
 *   1. Add the canonical `ProviderId` to the union below.
 *   2. Add an entry to `PROVIDER_TABLE` with a `displayName` and a
 *      `hostMatchers` array. Each matcher is matched against the
 *      lowercased hostname after stripping `www.`.
 *   3. Add a test case to `provider-detect.test.ts`.
 *
 * # What this is NOT
 *
 *   • Not a scraper. The research stage still does that.
 *   • Not an extractor selector. The research stage decides which
 *     adapter to use; this module just informs the UI.
 *   • Not a security boundary. The supplier URL still has to pass
 *     the form-validator's `.url()` + `https?://` check before
 *     dispatch.
 */

export type ProviderId =
  | "alibaba"
  | "aliexpress"
  | "amazon"
  | "cj_dropshipping"
  | "ebay"
  | "etsy"
  | "noon"
  | "shopify"
  | "taobao"
  | "temu"
  | "tiktok_shop"
  | "woocommerce"
  | "generic";

/**
 * Detection rule for a single provider. `hostMatchers` runs against
 * the lowercased hostname (no `www.` prefix). A matcher can be:
 *
 *   • An exact-match string (e.g. `"amazon.com"`) — matches when the
 *     hostname equals it OR ends with `.${matcher}` (so country
 *     subdomains and store subdomains both hit).
 *   • A function `(hostname) => boolean` — for cases like Shopify
 *     where the platform fingerprint is `*.myshopify.com`.
 */
export interface ProviderRule {
  id: ProviderId;
  displayName: string;
  /** Hostname matchers. Any match → this provider wins. */
  hostMatchers: Array<string | ((hostname: string) => boolean)>;
}

/**
 * Provider table. Order matters: the FIRST rule whose matcher
 * accepts the hostname wins. More-specific rules (e.g. Amazon's
 * country-suffixed `amazon.com`) should appear BEFORE broader ones
 * (e.g. generic Shopify `myshopify.com`) to avoid mis-routing.
 *
 * Hostname examples taken from real product pages — verify with a
 * fresh URL before adding new matchers; some platforms migrate.
 */
const PROVIDER_TABLE: ProviderRule[] = [
  {
    id: "alibaba",
    displayName: "Alibaba",
    hostMatchers: ["alibaba.com"],
  },
  {
    id: "aliexpress",
    displayName: "AliExpress",
    hostMatchers: ["aliexpress.com", "aliexpress.us", "aliexpress.ru"],
  },
  {
    id: "taobao",
    displayName: "Taobao",
    hostMatchers: ["taobao.com", "tmall.com", "1688.com"],
  },
  {
    id: "amazon",
    displayName: "Amazon",
    hostMatchers: [
      // The country-TLD set we currently care about for GCC + EU + NA
      // sourcing. Add new TLDs here as the operator audience grows.
      "amazon.com",
      "amazon.ae",
      "amazon.sa",
      "amazon.eg",
      "amazon.co.uk",
      "amazon.de",
      "amazon.fr",
      "amazon.it",
      "amazon.es",
      "amazon.ca",
    ],
  },
  {
    id: "noon",
    displayName: "Noon",
    hostMatchers: ["noon.com"],
  },
  {
    id: "temu",
    displayName: "Temu",
    hostMatchers: ["temu.com"],
  },
  {
    id: "tiktok_shop",
    displayName: "TikTok Shop",
    hostMatchers: [
      "shop.tiktok.com",
      // TikTok ships Shop as a sub-product across regional TikTok
      // hosts. Functional matcher catches `*.tiktok.com/shop/*`
      // even when the hostname isn't explicit.
      (h) => h.endsWith(".tiktok.com") && h.startsWith("shop"),
    ],
  },
  {
    id: "etsy",
    displayName: "Etsy",
    hostMatchers: ["etsy.com"],
  },
  {
    id: "ebay",
    displayName: "eBay",
    hostMatchers: ["ebay.com", "ebay.co.uk", "ebay.de", "ebay.fr"],
  },
  {
    id: "cj_dropshipping",
    displayName: "CJ Dropshipping",
    hostMatchers: ["cjdropshipping.com"],
  },
  {
    id: "shopify",
    displayName: "Shopify",
    hostMatchers: [
      // The `.myshopify.com` fingerprint is the most reliable.
      // Custom-domain Shopify stores fall through to "generic"
      // (no way to detect Shopify without an HTTP probe, which we
      // explicitly reject for this module).
      (h) => h.endsWith(".myshopify.com") || h === "myshopify.com",
    ],
  },
  {
    id: "woocommerce",
    displayName: "WooCommerce",
    // Same problem as Shopify on custom domains — most WooCommerce
    // shops are on bespoke hostnames. We deliberately ship no
    // hostname matcher rather than risk false-positives; the
    // generic extractor handles them fine. Kept in the table so
    // adapters can opt-in to WooCommerce-specific extraction later
    // if the operator manually tags the run.
    hostMatchers: [],
  },
];

/** Result returned by `detectProvider`. */
export interface DetectedProvider {
  id: ProviderId;
  displayName: string;
  /** Hostname that was actually matched against (post-normalisation). */
  hostname: string | null;
}

/**
 * Detect the ecommerce provider for a supplier URL.
 *
 * Returns `{ id: "generic", … }` for:
 *
 *   • Malformed / un-parseable URLs (no throw — UI calls this on
 *     every keystroke).
 *   • URLs without a hostname (e.g. data URIs).
 *   • Hostnames that don't match any provider rule.
 *
 * Pure function: no side effects, no network, fully deterministic.
 */
export function detectProvider(rawUrl: string): DetectedProvider {
  const hostname = extractHostname(rawUrl);

  if (!hostname) {
    return { id: "generic", displayName: "Generic", hostname: null };
  }

  for (const rule of PROVIDER_TABLE) {
    if (matchesAny(hostname, rule.hostMatchers)) {
      return {
        id: rule.id,
        displayName: rule.displayName,
        hostname,
      };
    }
  }

  return { id: "generic", displayName: "Generic", hostname };
}

/** All providers we surface in the UI selector / docs. */
export function listProviders(): Array<{
  id: ProviderId;
  displayName: string;
}> {
  return PROVIDER_TABLE.map((p) => ({
    id: p.id,
    displayName: p.displayName,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

/**
 * Normalise a URL string to its lowercased hostname, stripping
 * `www.`. Returns null for un-parseable inputs (we deliberately
 * never throw — the form polls this on every keystroke and a
 * mid-typing string like `"https://"` would otherwise blow up).
 */
function extractHostname(rawUrl: string): string | null {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return null;
  try {
    const url = new URL(rawUrl);
    if (!url.hostname) return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function matchesAny(
  hostname: string,
  matchers: ProviderRule["hostMatchers"],
): boolean {
  for (const m of matchers) {
    if (typeof m === "string") {
      if (hostname === m || hostname.endsWith(`.${m}`)) return true;
    } else if (m(hostname)) {
      return true;
    }
  }
  return false;
}
