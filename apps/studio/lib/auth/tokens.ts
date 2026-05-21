import { SignJWT, jwtVerify } from "jose";
import { studioEnv } from "./env";

/**
 * Stateless Studio session — short JWT in an HttpOnly cookie.
 *
 * Mirrors the proven Fanaa-admin pattern (jose-based HS256, role-tagged
 * claims) so middleware verification stays Edge-runtime compatible:
 *
 *   • Zero DB hops on every dashboard request.
 *   • Survives stateless container restarts (EasyPanel rolling deploys).
 *   • Rotatable by changing STUDIO_JWT_SECRET — every existing token
 *     invalidates atomically.
 *
 * Claim shape (intentionally minimal):
 *
 *   { sub: <email>, role: "studio", iat, exp }
 *
 * Role is "studio" (not "admin") so a leaked Fanaa-admin token can never
 * impersonate a Studio operator — the cookies live on different
 * subdomains in production anyway, but defence-in-depth is cheap.
 */

const COOKIE_NAME_DEFAULT = "_fa_studio";
const TOKEN_TTL_HOURS = 12;

export type StudioClaims = {
  sub: string;
  role: "studio";
  iat: number;
  exp: number;
};

function getSecret(): Uint8Array {
  const secret = studioEnv.jwtSecret();
  if (!secret) {
    throw new Error(
      "STUDIO_JWT_SECRET is not set. Add it to the Studio container's environment before issuing tokens."
    );
  }
  return new TextEncoder().encode(secret);
}

export function studioCookieName(): string {
  return studioEnv.authCookie() ?? COOKIE_NAME_DEFAULT;
}

/** Issue a fresh Studio JWT. Throws if STUDIO_JWT_SECRET is unset. */
export async function signStudioToken(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ role: "studio" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_HOURS * 60 * 60)
    .sign(getSecret());
}

/** Verify and return claims, or `null` on any failure (signature, expiry, role mismatch). */
export async function verifyStudioToken(token: string): Promise<StudioClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    if (payload.role !== "studio" || typeof payload.sub !== "string") return null;
    return payload as unknown as StudioClaims;
  } catch {
    return null;
  }
}

export const studioTokenTtlSeconds = TOKEN_TTL_HOURS * 60 * 60;
