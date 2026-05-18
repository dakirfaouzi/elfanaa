import type { IpIntel } from "./ip-intel";
import { adminEnv } from "./env";

/**
 * Compose the final "is this real GCC human traffic?" decision from the
 * cheap UA signal + the rich MaxMind Insights signal.
 *
 * The scoring is deliberately interpretable: each flag costs a fixed number
 * of points. Anything below the configured threshold (default 60) is
 * dropped from analytics counts but still stored so the Traffic Quality
 * dashboard can show why it was filtered.
 */
export type QualityVerdict = {
  score: number;
  isValid: boolean;
  isGcc: boolean;
  isBot: boolean;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  isAnonymous: boolean;
  countryMismatch: boolean;
  uaSuspicious: boolean;
  flags: string[];
  reason: string | null;
};

const PENALTY = {
  bot: 100,
  tor: 100,
  vpn: 60,
  proxy: 50,
  hosting: 35,
  anonymous: 20,
  uaSuspicious: 25,
  countryMismatch: 30,
} as const;

export type QualityInput = {
  isBotUA: boolean;
  intel: IpIntel | null;
  declaredCountry?: string | null;
};

export function scoreTraffic(input: QualityInput): QualityVerdict {
  const flags: string[] = [];
  let score = 100;

  const intel = input.intel;
  const isVpn = !!intel?.isAnonymousVpn;
  const isProxy = !!(intel?.isAnonymousProxy || intel?.isPublicProxy || intel?.isResidentialProxy);
  const isTor = !!intel?.isTorExitNode;
  const isHosting = !!intel?.isHostingProvider;
  const isAnonymous = !!intel?.isAnonymous;
  const uaSuspicious = input.isBotUA;

  if (uaSuspicious) {
    flags.push("ua_bot");
    score -= PENALTY.bot;
  }
  if (isTor) {
    flags.push("tor");
    score -= PENALTY.tor;
  }
  if (isVpn) {
    flags.push("vpn");
    score -= PENALTY.vpn;
  }
  if (isProxy) {
    flags.push("proxy");
    score -= PENALTY.proxy;
  }
  if (isHosting) {
    flags.push("hosting");
    score -= PENALTY.hosting;
  }
  if (isAnonymous && !isVpn && !isProxy && !isTor) {
    flags.push("anonymous");
    score -= PENALTY.anonymous;
  }

  const allowed = adminEnv.allowedCountries();
  const country = intel?.countryCode ?? null;
  const isGcc = country ? allowed.includes(country) : false;
  if (intel && country && !isGcc) {
    flags.push("non_allowed_country");
    score -= PENALTY.countryMismatch;
  }

  // Declared (e.g. cart locale or phone country) mismatching IP country.
  const declared = input.declaredCountry?.toUpperCase() ?? null;
  const countryMismatch = !!(declared && country && declared !== country);
  if (countryMismatch) {
    flags.push("country_mismatch");
    score -= PENALTY.countryMismatch;
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  const threshold = Number(process.env.ADMIN_QUALITY_THRESHOLD ?? 60);
  const isValid = score >= threshold && !uaSuspicious;

  return {
    score,
    isValid,
    isGcc,
    isBot: uaSuspicious,
    isVpn,
    isProxy,
    isTor,
    isHosting,
    isAnonymous,
    countryMismatch,
    uaSuspicious,
    flags,
    reason: flags.length ? flags.join(", ") : null,
  };
}
