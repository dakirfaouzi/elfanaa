import { NextResponse } from "next/server";
import { resolveImage } from "@platform/ai-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/diag/fal — TEMPORARY fal.ai image-provider probe.
 *
 * Diagnoses why `image_gen` produces no hero (so `assemble` falls back
 * to the intake image). It uses the SAME env-driven provider the
 * pipeline uses (`resolveImage().primary`), so it reflects exactly what
 * the running container sees for `FAL_KEY` / `STUDIO_IMAGE_PROVIDERS`.
 *
 * Two stages:
 *   • Always: `healthCheck()` — a FREE authenticated probe (fal queue
 *     status on a bogus id). Answers "is the key reaching fal and is it
 *     authorised?" without spending credits.
 *   • Opt-in `?generate=1`: ONE real `generate()` call. Answers billing
 *     / model / exact-payload questions. Costs ~$0.04 ONLY if it
 *     succeeds; an exhausted-balance or auth failure costs nothing.
 *
 * Security: returns only the provider id, booleans, HTTP status, and the
 * fal error string (which the adapter already strips of credentials).
 * No API key is ever echoed. This route is whitelisted as public in
 * middleware solely for triage and is REMOVED once the pipeline is
 * verified.
 */
export async function GET(req: Request): Promise<Response> {
  const doGenerate = new URL(req.url).searchParams.get("generate") === "1";

  const out: Record<string, unknown> = {
    ok: true,
    note: "temporary fal probe — remove after diagnosis",
    generateRequested: doGenerate,
  };

  let provider;
  try {
    const chain = resolveImage();
    provider = chain.primary;
    out.providerResolved = Boolean(provider);
    out.providerId = provider?.id ?? null;
    out.fallbackCount = chain.fallbacks.length;
  } catch (err) {
    return NextResponse.json(
      { ok: false, stage: "resolve", error: message(err) },
      { status: 500, headers: noStore() },
    );
  }

  if (!provider) {
    out.ok = false;
    out.diagnosis =
      "No image provider instantiated — FAL_KEY almost certainly unset in THIS service.";
    return NextResponse.json(out, { headers: noStore() });
  }

  // ── Stage 1: free auth/reachability probe ─────────────────────────
  try {
    const health = await provider.healthCheck();
    out.healthCheck = {
      ok: health.ok,
      latencyMs: health.latencyMs,
      errorMessage: health.ok ? undefined : health.errorMessage,
    };
    out.authVerdict = health.ok
      ? "auth_ok (key reaches fal and is authorised)"
      : classifyAuth(health.errorMessage);
  } catch (err) {
    out.healthCheck = { ok: false, threw: true, error: message(err) };
  }

  // ── Stage 2: optional single real generation ──────────────────────
  if (doGenerate) {
    const startedAt = Date.now();
    try {
      const result = await provider.generate({
        prompt:
          "A single fresh red apple on a clean white studio background, soft lighting, product photo",
        size: { w: 1024, h: 1024 },
        storeId: "fanaa",
        runId: "diag-fal-probe",
      });
      out.generate = {
        ok: true,
        url: result.url,
        width: result.width,
        height: result.height,
        model: result.model,
        costUsd: result.costUsd,
        latencyMs: Date.now() - startedAt,
      };
      out.generateVerdict = "generation_ok (fal billed and returned an image)";
    } catch (err) {
      const msg = message(err);
      out.generate = { ok: false, error: msg, latencyMs: Date.now() - startedAt };
      out.generateVerdict = classifyGenerate(msg);
    }
  } else {
    out.hint =
      "Append ?generate=1 to run ONE real fal generation and capture the exact billing/model error.";
  }

  return NextResponse.json(out, { headers: noStore() });
}

/* -------------------------------------------------------------------------- */

function classifyAuth(errorMessage?: string): string {
  const m = (errorMessage ?? "").toLowerCase();
  if (m.includes("missing_api_key") || m.includes("not set"))
    return "FAL_KEY_missing_in_service";
  if (m.includes("status=401") || m.includes("unauthor"))
    return "auth_failed_401 (key invalid/expired)";
  if (m.includes("status=403") || m.includes("forbid"))
    return "auth_forbidden_403 (key valid but lacks access / suspended)";
  return `auth_unknown: ${errorMessage ?? "no message"}`;
}

function classifyGenerate(errorMessage: string): string {
  const m = errorMessage.toLowerCase();
  if (m.includes("status=401") || m.includes("unauthor"))
    return "auth_failed_401";
  if (m.includes("status=403") || m.includes("forbid"))
    return "forbidden_403";
  if (
    m.includes("status=402") ||
    m.includes("balance") ||
    m.includes("credit") ||
    m.includes("insufficient") ||
    m.includes("payment")
  )
    return "billing_insufficient_credits (top up fal balance)";
  if (m.includes("status=422") || m.includes("unprocessable") || m.includes("validation"))
    return "model_validation_error (bad input/model id)";
  if (m.includes("status=429") || m.includes("rate"))
    return "rate_limited_429";
  if (m.includes("status=5")) return "fal_server_error_5xx";
  return `generation_failed_other: ${errorMessage.slice(0, 300)}`;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function noStore(): Record<string, string> {
  return { "cache-control": "no-store, max-age=0" };
}
