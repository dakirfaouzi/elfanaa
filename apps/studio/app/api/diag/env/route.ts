import { NextResponse } from "next/server";
import { STUDIO_BASE_PATH } from "@/lib/base-path";
import {
  getBuildSha,
  getBuildShaShort,
  getBuildTimestamp,
} from "@/lib/studio/build-info";

export const dynamic = "force-dynamic";

/**
 * GET /api/diag/env — public deploy-state probe.
 *
 * # Why this endpoint exists
 *
 * Stale-deploy investigations on Studio kept hitting the same dead
 * end: from outside the container there's no way to confirm
 *
 *   (1) which git SHA is actually serving requests, vs.
 *   (2) which value of `NEXT_PUBLIC_STUDIO_BASE_PATH` the runtime
 *       sees (env vars set in EasyPanel's "Build Arguments" tab
 *       bake into the bundle at build time; ones in the
 *       "Environment Variables" tab show up at runtime — these are
 *       DIFFERENT plumbing paths and a deploy can get one without
 *       the other).
 *
 * Without this endpoint, every "is my code actually running?"
 * question requires SSH into the EasyPanel host. With it, a single
 * `curl elfanaa.com/studio/api/diag/env` gives the truth.
 *
 * # Why public (no JWT gate)
 *
 * The middleware's PUBLIC_PATHS allowlist is extended to include
 * this route. The fields exposed are deliberately non-sensitive:
 *
 *   • Build SHA — already on the public /login page footer.
 *   • basePath — already inferrable from the URL the operator
 *     used to reach the endpoint.
 *   • NODE_ENV — universally inferrable.
 *
 * NO API keys, DB URLs, JWT secrets, mount paths, or any other
 * env var is included. The whitelist is the explicit object shape
 * below; adding new fields here is a deliberate, reviewable change.
 *
 * # Drift detection
 *
 * The endpoint reports BOTH:
 *
 *   • `studioBasePath.serverRuntime` — what `process.env` says
 *     NOW, at request time, inside the running container.
 *   • `studioBasePath.constantAtModuleLoad` — what the
 *     `STUDIO_BASE_PATH` constant in `lib/base-path.ts` resolved
 *     to when the module was first imported (i.e. effectively the
 *     value the middleware + server code USE).
 *
 * Comparing the two surfaces the classic Docker mistake of setting
 * the env var as a build arg but forgetting to set it as a runtime
 * env, or vice versa. When `runtime ≠ constant`, every
 * `stripStudioBasePath`/`studioPath` call in the running server is
 * silently wrong.
 *
 * # No caching
 *
 * `dynamic = "force-dynamic"` + a `cache-control: no-store` header
 * so a CDN / browser cache can't serve a stale snapshot of the
 * diagnostics. The whole point is to inspect the LIVE state.
 */
export function GET() {
  const runtimeBasePath = (
    process.env.NEXT_PUBLIC_STUDIO_BASE_PATH ?? ""
  ).trim();

  // Whitelist payload. Update this object shape — not the bag of
  // env vars — if/when new diagnostic fields are needed.
  const body = {
    ok: true as const,
    buildSha: {
      full: getBuildSha(),
      short: getBuildShaShort(),
      builtAt: getBuildTimestamp(),
    },
    studioBasePath: {
      // Value the running server reads from process.env AT REQUEST
      // TIME. This is what middleware + route handlers see.
      serverRuntime: runtimeBasePath,
      // Value the `STUDIO_BASE_PATH` constant resolved to when
      // `lib/base-path.ts` was first imported. In practice this is
      // the same as `serverRuntime` on first request, but the
      // separation is intentional: it's the value the helpers
      // ACTUALLY USE, regardless of any later env mutations.
      constantAtModuleLoad: STUDIO_BASE_PATH,
      // True when middleware/server stripping will work correctly.
      // False = the `/studio/studio/drafts` double-prefix bug is
      // armed (or routes will 404 entirely, depending on which
      // half is broken).
      inSync: runtimeBasePath === STUDIO_BASE_PATH,
    },
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    // Lets the caller correlate the response to a specific request
    // when sweeping multiple instances behind a load balancer.
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  });
}
