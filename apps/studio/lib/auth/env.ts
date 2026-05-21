/**
 * Centralised, type-safe Studio env access.
 *
 * Studio is deliberately decoupled from Fanaa admin auth:
 *
 *   • Different cookie name        (_fa_studio   vs  _fa_admin)
 *   • Different JWT secret         (STUDIO_JWT_SECRET vs JWT_SECRET)
 *   • Different identity material  (STUDIO_EMAIL / STUDIO_PASSWORD_HASH)
 *
 * Why split them: Fanaa admin and the Studio operator pool will likely diverge
 * (the storefront admin handles orders + analytics; the Studio handles
 * product production + AI runs). Sharing a secret would tie the two
 * lifecycles together and make revocation in one revoke the other.
 *
 * Each getter returns `undefined` when the var is missing so callers can
 * surface a structured 503 instead of throwing at module-load time — which
 * would otherwise crash the container on missing config and break
 * EasyPanel's health probes.
 */
export const studioEnv = {
  jwtSecret: () => process.env.STUDIO_JWT_SECRET,
  studioEmail: () => process.env.STUDIO_EMAIL?.trim().toLowerCase(),
  studioPassword: () => process.env.STUDIO_PASSWORD,
  studioPasswordHash: () => process.env.STUDIO_PASSWORD_HASH,
  authCookie: () => process.env.STUDIO_AUTH_COOKIE ?? "_fa_studio",
} as const;

/**
 * True only when ALL three required Studio auth env vars are present:
 *
 *   • STUDIO_JWT_SECRET
 *   • STUDIO_EMAIL
 *   • STUDIO_PASSWORD or STUDIO_PASSWORD_HASH (either is fine)
 *
 * The login endpoint short-circuits with a 503 + actionable message when
 * this returns false, so an unconfigured Studio container can still serve
 * its own `/login` page and signal what's missing instead of failing in
 * an opaque "invalid credentials" loop.
 */
export function isStudioAuthConfigured(): boolean {
  return Boolean(
    studioEnv.jwtSecret() &&
      studioEnv.studioEmail() &&
      (studioEnv.studioPassword() || studioEnv.studioPasswordHash())
  );
}
