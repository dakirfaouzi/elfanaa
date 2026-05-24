/**
 * Build-time provenance helpers.
 *
 * # Why this exists
 *
 * Without a SHA stamp baked into the Studio bundle, an operator
 * staring at a "did my deploy land?" situation has no way to
 * distinguish:
 *
 *   • Container is running the latest source (good).
 *   • Container is running yesterday's source because EasyPanel's
 *     Redeploy restarted the existing image instead of rebuilding
 *     from git (the case that prompted this file).
 *   • Container is running last week's source because the Docker
 *     layer cache served a stale `apps/studio` overlay.
 *
 * All three look identical from the browser. The fix is to bake the
 * commit SHA into the image at `docker build` time via a build arg,
 * surface it to BOTH server and client code (so it shows up in
 * server-rendered HTML AND in client-side debug helpers), and render
 * a tiny pill on every Studio page so operators can read it at a
 * glance.
 *
 * # Two env vars on purpose
 *
 *   • `STUDIO_BUILD_SHA`             — server-only. Read by server
 *                                       components and route handlers.
 *   • `NEXT_PUBLIC_STUDIO_BUILD_SHA` — client-safe. Next.js inlines
 *                                       `NEXT_PUBLIC_*` env vars into
 *                                       the client bundle at build time,
 *                                       which lets a client component
 *                                       (e.g. the NavBar pill) read it
 *                                       without re-fetching from the
 *                                       server.
 *
 * Both should be set to the SAME value by the Dockerfile. We export a
 * single getter that prefers `STUDIO_BUILD_SHA` (server) and falls
 * back to `NEXT_PUBLIC_STUDIO_BUILD_SHA` (client) so callers don't
 * need to know which side of the wire they're on.
 *
 * # `"dev"` fallback
 *
 * When neither env var is set we return the literal string `"dev"`.
 * That's the right signal for `pnpm dev` (no docker build, no SHA
 * to bake) AND for any production deploy that forgot to wire the
 * build arg — the latter shows up as a "dev" pill in the navbar
 * which is impossible to miss in a screenshot.
 *
 * # Why not `process.env.VERCEL_GIT_COMMIT_SHA` etc.
 *
 * Studio runs in Docker on EasyPanel, not Vercel. Each host has its
 * own conventional env var name; instead of chasing them we ship a
 * single Studio-specific name we control end-to-end in our own
 * Dockerfile.
 */

const RAW_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

/**
 * Full SHA — empty string `→ "dev"`. Untrusted input is rejected to
 * "dev" so a malformed build arg can't produce broken GitHub links
 * downstream.
 */
export function getBuildSha(): string {
  const candidate =
    process.env.STUDIO_BUILD_SHA ||
    process.env.NEXT_PUBLIC_STUDIO_BUILD_SHA ||
    "";
  if (!candidate) return "dev";
  if (!RAW_SHA_PATTERN.test(candidate)) return "dev";
  return candidate.toLowerCase();
}

/** First 7 hex chars — the canonical short form (`git log --oneline`). */
export function getBuildShaShort(): string {
  const full = getBuildSha();
  if (full === "dev") return "dev";
  return full.slice(0, 7);
}

/**
 * Permalink to the commit on GitHub. Operator can click the pill to
 * jump straight to the commit in the repo's UI and see exactly what
 * changed. Returns null when SHA is "dev" so the navbar pill renders
 * as plain text instead of a broken link.
 */
export function getBuildShaUrl(): string | null {
  const full = getBuildSha();
  if (full === "dev") return null;
  return `https://github.com/dakirfaouzi/elfanaa/commit/${full}`;
}

/**
 * ISO-8601 build timestamp when the Dockerfile stamps it. Currently
 * NOT wired through the Dockerfile (the SHA alone is usually enough
 * to triangulate "when"), but exposed here so a future build-time
 * `ENV STUDIO_BUILT_AT=...` is a one-line change instead of a new
 * helper module.
 */
export function getBuildTimestamp(): string | null {
  const t = process.env.STUDIO_BUILT_AT || null;
  return t && t.length > 0 ? t : null;
}
