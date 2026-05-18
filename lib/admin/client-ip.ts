/**
 * Extract the originating client IP from a Next.js request.
 *
 * Order of trust:
 *   1. `cf-connecting-ip`  — Cloudflare (most trustworthy)
 *   2. `x-real-ip`         — Nginx / EasyPanel proxy
 *   3. `x-forwarded-for`   — first hop (skip RFC1918 / loopback)
 *   4. fallback: "0.0.0.0"
 *
 * Why not just trust the leftmost x-forwarded-for value? Because some
 * upstream proxies prepend their own internal address. We strip private +
 * loopback ranges so spoofed `127.0.0.1` headers can't bypass GCC gates.
 */
export function getClientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf && !isPrivate(cf)) return cf.trim();

  const real = headers.get("x-real-ip");
  if (real && !isPrivate(real)) return real.trim();

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    for (const part of xff.split(",")) {
      const ip = part.trim();
      if (ip && !isPrivate(ip)) return ip;
    }
  }
  return "0.0.0.0";
}

const PRIVATE_PATTERNS: RegExp[] = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^0\.0\.0\.0$/,
];

function isPrivate(ip: string): boolean {
  return PRIVATE_PATTERNS.some((re) => re.test(ip));
}
