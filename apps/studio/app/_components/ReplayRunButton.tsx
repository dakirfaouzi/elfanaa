"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { studioPath } from "@/lib/base-path";

/**
 * Replay button — POSTs to /api/studio/runs/[runId]/replay then
 * refreshes the page so the new step timeline + final product render.
 *
 * # Why this is a client component (not a server action)
 *
 * The original implementation used a Next.js server action wired via
 * `<form action={replayServerAction}>`. Server actions silently rejected
 * the POST when Studio runs behind the storefront's reverse-proxy at
 * `elfanaa.com/studio`. Reasons stacked:
 *
 *   • Next.js server actions perform an Origin/Host header check that
 *     compares the request's Host header against `serverActions.allowedOrigins`
 *     in `next.config.mjs`. When proxied through `apps/fanaa`, the
 *     Studio sees Host=`elfanaa_studio` (the internal Docker hostname)
 *     while the action ID was signed with Host=`elfanaa.com`. Mismatch
 *     → action dropped, NO console error, NO network entry in the
 *     browser DevTools (the failure happens before the wire fetch).
 *
 *   • Even with the right allowedOrigins, the action-id round-trip
 *     adds an opaque "$ACTION_" hash that breaks when chunks rotate
 *     between deploys — operators with a stale tab silently can't
 *     replay until they reload.
 *
 * A plain client fetch to the existing `/api/studio/runs/[runId]/replay`
 * REST endpoint sidesteps both. The endpoint is JWT-gated by the
 * Studio middleware exactly like the rest of `/api/studio/**`, so
 * there's no auth regression.
 *
 * # UX states
 *
 *   • idle               — green "Replay run" button.
 *   • running            — disabled button "Replaying…" + spinner.
 *   • success (any status from the API) — render a small status panel
 *     under the button with the result; on `ok` also call
 *     `router.refresh()` so the page picks up the updated run.
 *   • error              — surface the network error inline; do NOT
 *     auto-refresh (operator may want to copy the message first).
 */

type ReplayResult =
  | {
      status: "ok";
      runId: string;
      replayedStages: string[];
      totalCostUsd: number;
      finalProductId?: string;
    }
  | { status: "not_found"; runId: string }
  | { status: "providers_unavailable"; runId: string; reason: string }
  | { status: "replay_failed"; runId: string; reason: string };

export function ReplayRunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setResult(null);
    setNetworkError(null);

    try {
      const res = await fetch(studioPath(`/api/studio/runs/${encodeURIComponent(runId)}/replay`), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        // Empty body = "resume from the first non-successful stage" —
        // see app/api/studio/runs/[runId]/replay/route.ts.
        body: "{}",
      });

      let parsed: ReplayResult | null = null;
      try {
        parsed = (await res.json()) as ReplayResult;
      } catch {
        // The endpoint always returns JSON on every status code (200,
        // 404, 500, 503). A parse failure here means the request was
        // intercepted by an upstream proxy returning HTML — surface
        // as a network error so the operator sees something useful.
        setNetworkError(`Replay endpoint returned non-JSON (HTTP ${res.status}).`);
        return;
      }

      setResult(parsed);
      if (parsed?.status === "ok") {
        // Re-fetch the server-rendered page so the timeline reflects
        // the freshly-appended steps. router.refresh() is cheaper than
        // a full reload — keeps the result panel mounted.
        router.refresh();
      }
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          className="btn btn-accent"
          style={{
            cursor: busy ? "wait" : "pointer",
            minHeight: 38,
            fontWeight: 600,
          }}
        >
          {busy ? "Replaying…" : "Replay run"}
        </button>
        {busy && (
          <span
            className="text-faint"
            style={{ fontSize: 12, fontStyle: "italic" }}
          >
            Re-running the pipeline — this can take a minute or two…
          </span>
        )}
      </div>

      {result && <ReplayResultPanel result={result} />}
      {networkError && (
        <div
          style={{
            background: "var(--danger-soft)",
            border: "1px solid var(--danger)",
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
          }}
        >
          <strong>Network error:</strong> {networkError}
        </div>
      )}
    </div>
  );
}

function ReplayResultPanel({ result }: { result: ReplayResult }) {
  if (result.status === "ok") {
    return (
      <div
        style={{
          background: "var(--success-soft, rgba(34,197,94,0.12))",
          border: "1px solid var(--success, rgb(34,197,94))",
          borderRadius: 10,
          padding: 12,
          fontSize: 13,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <strong>Replay completed.</strong>
        <span>
          Stages re-run: {result.replayedStages.length > 0 ? result.replayedStages.join(", ") : "(none — nothing to resume)"}
        </span>
        <span>Total cost: ${result.totalCostUsd.toFixed(4)}</span>
        {result.finalProductId && (
          <span>Final product: <code className="code">{result.finalProductId}</code></span>
        )}
      </div>
    );
  }
  if (result.status === "providers_unavailable") {
    return (
      <div
        style={{
          background: "var(--warning-soft, rgba(234,179,8,0.12))",
          border: "1px solid var(--warning, rgb(234,179,8))",
          borderRadius: 10,
          padding: 12,
          fontSize: 13,
        }}
      >
        <strong>Provider credentials missing.</strong> {result.reason}
        <div className="text-faint" style={{ marginTop: 6, fontSize: 12 }}>
          Add the required keys in the Studio environment configuration, then redeploy.
        </div>
      </div>
    );
  }
  if (result.status === "not_found") {
    return (
      <div
        style={{
          background: "var(--danger-soft)",
          border: "1px solid var(--danger)",
          borderRadius: 10,
          padding: 12,
          fontSize: 13,
        }}
      >
        <strong>Run not found.</strong> The record was not found in Postgres or on
        the filesystem. Refresh the page to confirm the run still exists.
      </div>
    );
  }
  return (
    <div
      style={{
        background: "var(--danger-soft)",
        border: "1px solid var(--danger)",
        borderRadius: 10,
        padding: 12,
        fontSize: 13,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <strong>Replay failed.</strong>
      <span style={{ wordBreak: "break-word" }}>{result.reason}</span>
    </div>
  );
}
