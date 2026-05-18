import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { adminEnv } from "./env";

/**
 * Stateless admin session. Encoded as a short JWT in an HttpOnly cookie.
 *
 * Why JWT and not iron-session / a server-side session table?
 *   • Zero DB hops on every dashboard request (every page hits the API ~5x).
 *   • Survives a stateless container restart (EasyPanel rolling deploys).
 *   • Easy to rotate by changing JWT_SECRET — every existing token invalidates.
 *
 * Scope is intentionally minimal: { sub: email, role: "admin", iat, exp }.
 */
const COOKIE_NAME_DEFAULT = "_fa_admin";
const TOKEN_TTL_HOURS = 12;

export type AdminClaims = {
  sub: string;
  role: "admin";
  iat: number;
  exp: number;
};

function getSecret(): Uint8Array {
  const secret = adminEnv.jwtSecret();
  if (!secret) {
    throw new Error(
      "JWT_SECRET (or SESSION_SECRET) is not set. Add it to your env before using the admin."
    );
  }
  return new TextEncoder().encode(secret);
}

export function adminCookieName(): string {
  return adminEnv.authCookie() ?? COOKIE_NAME_DEFAULT;
}

/** Issue a fresh admin JWT. */
export async function signAdminToken(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_HOURS * 60 * 60)
    .sign(getSecret());
}

/** Verify and return claims, or `null` on any failure. */
export async function verifyAdminToken(token: string): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (payload.role !== "admin" || typeof payload.sub !== "string") return null;
    return payload as unknown as AdminClaims;
  } catch {
    return null;
  }
}

/**
 * Constant-time password comparison against the configured admin password.
 *
 * Accepts either:
 *   • ADMIN_PASSWORD_HASH (bcrypt $2a/$2b)  — recommended for production
 *   • ADMIN_PASSWORD       (plain)          — quick start
 */
export async function verifyAdminPassword(input: string): Promise<boolean> {
  const hash = adminEnv.adminPasswordHash();
  if (hash) {
    try {
      return await bcrypt.compare(input, hash);
    } catch {
      return false;
    }
  }
  const plain = adminEnv.adminPassword();
  if (!plain) return false;
  // Constant-time compare on plain values.
  return safeEqual(input, plain);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const adminTtlSeconds = TOKEN_TTL_HOURS * 60 * 60;
