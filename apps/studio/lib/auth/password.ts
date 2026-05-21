import bcrypt from "bcryptjs";
import { studioEnv } from "./env";

/**
 * Constant-time password comparison against the configured Studio password.
 *
 * Two configuration paths, in priority order:
 *
 *   1. STUDIO_PASSWORD_HASH (bcrypt $2a/$2b)   — recommended for production
 *   2. STUDIO_PASSWORD       (plain)            — quick-start / dev only
 *
 * The plain-text fallback exists so a new operator can boot the Studio
 * with one env var before bothering with `pnpm --filter fanaa run admin:hash-password`,
 * but production deployments should always use the hash form so a leaked
 * env dump doesn't yield credentials in clear text.
 */
export async function verifyStudioPassword(input: string): Promise<boolean> {
  const hash = studioEnv.studioPasswordHash();
  if (hash) {
    try {
      return await bcrypt.compare(input, hash);
    } catch {
      return false;
    }
  }
  const plain = studioEnv.studioPassword();
  if (!plain) return false;
  return safeEqual(input, plain);
}

/**
 * Constant-time string compare. Avoids leaking the length-or-content of the
 * expected password through short-circuit `===` comparison timing.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
