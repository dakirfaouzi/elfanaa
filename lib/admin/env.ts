/**
 * Centralised, type-safe admin env access.
 *
 * Each getter returns `undefined` when the var is missing so callers can
 * degrade (e.g. skip MaxMind, fall back to UA-only bot detection). NEVER
 * throws at module-load — that would crash the whole storefront build.
 */
export const adminEnv = {
  databaseUrl: () => process.env.ADMIN_DATABASE_URL,
  jwtSecret: () => process.env.JWT_SECRET ?? process.env.SESSION_SECRET,
  adminEmail: () => process.env.ADMIN_EMAIL?.trim().toLowerCase(),
  adminPassword: () => process.env.ADMIN_PASSWORD,
  adminPasswordHash: () => process.env.ADMIN_PASSWORD_HASH,
  maxmindAccountId: () => process.env.MAXMIND_ACCOUNT_ID,
  maxmindLicenseKey: () => process.env.MAXMIND_LICENSE_KEY,
  webhookSecret: () => process.env.WEBHOOK_SECRET,
  /** Allow-listed countries (ISO-2). Defaults to GCC + Yemen. */
  allowedCountries: (): string[] => {
    const raw = process.env.ADMIN_ALLOWED_COUNTRIES;
    if (!raw) return ["SA", "AE", "KW", "QA", "BH", "OM", "YE"];
    return raw
      .split(/[,\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
  },
  /** Optional override for the visitor-id cookie name. */
  visitorCookie: () => process.env.ADMIN_VISITOR_COOKIE ?? "_fa_vid",
  sessionCookie: () => process.env.ADMIN_SESSION_COOKIE ?? "_fa_sid",
  authCookie: () => process.env.ADMIN_AUTH_COOKIE ?? "_fa_admin",
} as const;

export function isAdminAuthConfigured(): boolean {
  return Boolean(
    adminEnv.jwtSecret() &&
      adminEnv.adminEmail() &&
      (adminEnv.adminPassword() || adminEnv.adminPasswordHash())
  );
}
