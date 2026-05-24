import { NextResponse } from "next/server";
import { STUDIO_BASE_PATH } from "@/lib/base-path";
import {
  getBuildSha,
  getBuildShaShort,
  getBuildTimestamp,
} from "@/lib/studio/build-info";
import { getStudioPersistence } from "@/lib/studio/persistence";

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
export async function GET(req: Request) {
  const runtimeBasePath = (
    process.env.NEXT_PUBLIC_STUDIO_BASE_PATH ?? ""
  ).trim();

  // Opt-in storage probe — see the `reachability` field on the
  // storage subobject below for rationale. Triggered by
  // `?probe=storage` so the default GET stays a pure metadata read.
  const probeStorage =
    new URL(req.url).searchParams.get("probe") === "storage";

  // ── Storage snapshot ────────────────────────────────────────────
  //
  // Phase B intake uploads were silently failing with
  // `bucket_missing` because the runtime env var the env resolver
  // expects (R2_BUCKET_FANAA) differs from the name commonly used
  // in EasyPanel templates (R2_BUCKET). The operator had no way to
  // confirm this without SSHing into the container.
  //
  // This block surfaces the bucket-resolution state explicitly.
  // The fields below are designed to NOT leak any credentials:
  //
  //   • `driver` — `r2` or `memory`, a public deployment choice.
  //   • `hasAccountId / hasAccessKey / hasSecretKey` — booleans only,
  //     never the actual values. Operators just need to confirm
  //     "yes a key is set" / "no it's missing".
  //   • `storesWithBuckets` — array of storeIds for which a bucket
  //     was successfully configured. storeIds themselves are public
  //     (they appear in /studio/intake's store dropdown); the
  //     BUCKET NAMES are deliberately NOT exposed because they're
  //     unnecessary for triage and an attacker could use them for
  //     direct S3 enumeration attempts.
  //   • `storesWithPublicUrls` — same shape, for diagnosing the
  //     thumbnail-render path.
  //   • `warnings` — the env resolver's own warning array, e.g.
  //     "STORAGE_DRIVER=r2 but R2_BUCKET_FANAA missing". These are
  //     already non-sensitive by construction (they cite env-var
  //     names, never values).
  //   • `reachability` — outcome of a server-side HEAD probe against
  //     a sentinel key on each configured bucket. Server-to-R2 is
  //     NOT CORS-gated, so this isolates the "browser PUT fails
  //     with CORS" case from the "credentials/bucket are actually
  //     wrong" case: when `reachable: true` but the browser still
  //     fails, the cause is unambiguously CORS on the R2 bucket.
  //     The probe runs only when `?probe=storage` is on the query
  //     string so the cost (one HEAD per configured bucket) isn't
  //     paid on every diag check.
  //
  // The bucket map itself is NEVER returned.
  let storage: {
    driver: string;
    hasAccountId: boolean;
    hasAccessKey: boolean;
    hasSecretKey: boolean;
    storesWithBuckets: string[];
    storesWithPublicUrls: string[];
    warnings: string[];
    reachability?: Record<
      string,
      { reachable: boolean; errorKind?: string }
    >;
  };
  let persistenceForProbe: ReturnType<typeof getStudioPersistence> | null =
    null;
  try {
    const persistence = getStudioPersistence();
    persistenceForProbe = persistence;
    const r2 = persistence.config.r2;
    storage = {
      driver: r2.driver,
      hasAccountId: Boolean(r2.accountId),
      hasAccessKey: Boolean(r2.accessKeyId),
      hasSecretKey: Boolean(r2.secretAccessKey),
      storesWithBuckets: Object.keys(r2.buckets).sort(),
      storesWithPublicUrls: Object.keys(r2.publicBaseUrls).sort(),
      warnings: r2.warnings,
    };
  } catch (err) {
    // If env resolution throws at boot (invalid env), surface the
    // failure type but never the underlying message — that message
    // can include partially-validated values (e.g. malformed URLs).
    storage = {
      driver: "unresolved",
      hasAccountId: false,
      hasAccessKey: false,
      hasSecretKey: false,
      storesWithBuckets: [],
      storesWithPublicUrls: [],
      warnings: [
        err instanceof Error && err.message.startsWith("studio_persistence_env_invalid:")
          ? "studio_persistence_env_invalid"
          : "studio_persistence_init_failed",
      ],
    };
  }

  // ── Optional server-side R2 reachability probe ───────────────────
  //
  // Why a sentinel-key HEAD: it's the cheapest call that distinguishes
  // "credentials work" from "bucket missing / forbidden". A successful
  // probe returns false (key doesn't exist) — that's the desired
  // outcome. Any thrown `StorageError` means we couldn't even ask
  // the question, which is the real signal we want.
  //
  // Why this is server-to-server and therefore CORS-irrelevant:
  // `MediaStore.exists()` calls `fetch()` from Node — no Origin
  // header, no preflight. So when this probe returns `reachable: true`
  // for a bucket whose browser PUTs fail, the diagnosis is
  // unambiguous: the bucket is fine, the CREDENTIALS are fine,
  // the only thing missing is a CORS policy on the bucket allowing
  // the page's origin to PUT with `Content-Type: image/...`.
  //
  // Why we surface only `{ reachable, errorKind? }`:
  //   • `errorKind` is one of the StorageErrorKind union
  //     ("not_found" | "forbidden" | "invalid_input" | "network" |
  //     "unknown") — no message, no raw body, no header that could
  //     leak credentials. The kind alone is enough for the operator
  //     to know which env var to check.
  if (probeStorage && persistenceForProbe) {
    const r2 = persistenceForProbe.config.r2;
    const mediaStore = persistenceForProbe.mediaStore;
    const sentinelKey = "studio-intake/__diag_probe__/never-exists";
    const reachability: Record<
      string,
      { reachable: boolean; errorKind?: string }
    > = {};
    await Promise.all(
      Object.entries(r2.buckets).map(async ([storeId, bucketName]) => {
        try {
          // Returning `true` or `false` both prove reachability —
          // we just need exists() to NOT throw.
          await mediaStore.exists(bucketName, sentinelKey);
          reachability[storeId] = { reachable: true };
        } catch (err) {
          const kind =
            err && typeof err === "object" && "kind" in err
              ? String((err as { kind: unknown }).kind)
              : "unknown";
          reachability[storeId] = { reachable: false, errorKind: kind };
        }
      }),
    );
    storage.reachability = reachability;
  }

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
    storage,
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
