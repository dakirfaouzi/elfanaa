"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, Settings } from "lucide-react";

/**
 * Shared data plumbing for every admin client component.
 *
 * Why this exists
 * ───────────────
 * Before this module, each client had its own copy of
 *
 *   const fetcher = async (url) => {
 *     const r = await fetch(url, { credentials: "same-origin" });
 *     if (!r.ok) throw new Error("fetch_failed");
 *     return r.json();
 *   };
 *
 * which collapsed every failure — wrong env var, missing table, network
 * blip, expired JWT — into the same blunt "Couldn't load metrics" toast.
 * Operators had no way to tell why. This file centralises:
 *
 *   • A descriptive fetcher that surfaces the real server reason.
 *   • An `ErrorState` banner that explains the failure + links to
 *     `/admin/settings` for live diagnostics.
 *   • A `PartialDataBanner` for the 200-OK-with-some-failed-subqueries
 *     case (the new resilient route handlers return `_errors`).
 */

export class AdminFetchError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "AdminFetchError";
    this.status = status;
    this.detail = detail;
  }
}

/** SWR fetcher used by every admin client. */
export async function adminFetcher<T = unknown>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  } catch (err) {
    // Network-level failure (CORS, DNS, container restart). The user
    // sees "Connection failed" — actionable from the operator's side.
    const detail = err instanceof Error ? err.message : String(err);
    throw new AdminFetchError("Connection failed", 0, detail);
  }

  // Try to parse JSON even on non-OK so we get the server's error body.
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 280) };
    }
  }

  if (!res.ok) {
    const obj = (body && typeof body === "object" ? (body as Record<string, unknown>) : {}) as Record<
      string,
      unknown
    >;
    const message =
      (typeof obj.error === "string" && obj.error) ||
      (typeof obj.message === "string" && obj.message) ||
      `Request failed (${res.status})`;
    const detail = typeof obj.hint === "string" ? obj.hint : typeof obj.raw === "string" ? obj.raw : undefined;
    throw new AdminFetchError(String(message), res.status, detail);
  }

  return body as T;
}

/** Render banner shown when SWR's `error` is set — full failure. */
export function ErrorState({ error }: { error: unknown }) {
  const isAdmin = error instanceof AdminFetchError;
  const status = isAdmin ? error.status : 0;
  const message = isAdmin ? error.message : error instanceof Error ? error.message : "Unknown error";
  const detail = isAdmin ? error.detail : undefined;

  // 401 → session expired. Bounce the operator to the login page with
  // a "next" hint so they land back here after re-auth.
  const isAuth = status === 401;

  return (
    <div
      className="fa-card fa-card-pad-lg"
      style={{
        borderColor: "rgb(var(--fa-danger) / 0.36)",
        background:
          "linear-gradient(180deg, rgb(var(--fa-danger) / 0.04) 0%, rgb(var(--fa-surface)) 60%)",
      }}
    >
      <div className="fa-row" style={{ alignItems: "flex-start", gap: 14 }}>
        <span
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgb(var(--fa-danger) / 0.10)",
            color: "rgb(var(--fa-danger))",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "1px solid rgb(var(--fa-danger) / 0.22)",
          }}
        >
          <AlertTriangle size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 16,
              color: "rgb(var(--fa-text))",
              fontFamily: "ui-serif, Georgia, serif",
              letterSpacing: "-0.005em",
            }}
          >
            {isAuth ? "Session expired" : "Couldn't load metrics"}
          </div>
          <div style={{ fontSize: 13.5, marginTop: 4, color: "rgb(var(--fa-text-muted))", lineHeight: 1.45 }}>
            {message}
          </div>
          {detail && (
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 11.5,
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgb(var(--fa-bg-2))",
                color: "rgb(var(--fa-text-muted))",
                border: "1px solid rgb(var(--fa-line))",
                wordBreak: "break-word",
              }}
            >
              {detail}
            </div>
          )}
          <div className="fa-row" style={{ marginTop: 14, gap: 8, flexWrap: "wrap" }}>
            <button
              className="fa-btn"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              type="button"
            >
              <RefreshCw size={13} /> Retry
            </button>
            {isAuth ? (
              <Link className="fa-btn" href="/admin/login">
                Sign in again
              </Link>
            ) : (
              <Link className="fa-btn" href="/admin/settings">
                <Settings size={13} /> Diagnose
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Render the small inline notice shown when the route returned 200 OK
 * but one or more sub-queries failed (the route handlers attach
 * `_errors: Array<{ label, error }>` to such payloads).
 *
 * Most data on the page is real; this banner just nudges the operator
 * to /admin/settings for diagnostic detail.
 */
export function PartialDataBanner({
  errors,
}: {
  errors?: Array<{ label: string; error: string }>;
}) {
  if (!errors || errors.length === 0) return null;
  return (
    <div
      className="fa-card"
      style={{
        borderColor: "rgb(var(--fa-warn) / 0.42)",
        background: "rgb(var(--fa-warn) / 0.08)",
        padding: "12px 16px",
      }}
    >
      <div className="fa-row" style={{ alignItems: "flex-start", gap: 12 }}>
        <AlertTriangle
          size={16}
          style={{ color: "rgb(var(--fa-warn))", flexShrink: 0, marginTop: 2 }}
        />
        <div style={{ fontSize: 13, color: "rgb(var(--fa-text))", flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>
            Some metrics failed to load. Showing what we have.
          </div>
          <div style={{ fontSize: 12.5, color: "rgb(var(--fa-text-muted))" }}>
            {errors.length} sub-quer{errors.length === 1 ? "y" : "ies"} returned an error.{" "}
            <Link
              href="/admin/settings"
              style={{
                color: "rgb(var(--fa-accent-deep))",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                fontWeight: 500,
              }}
            >
              Run diagnostics →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Helper to extract `_errors` from a payload — typed so call-sites stay terse. */
export function extractErrors<T extends object>(
  data: T | undefined
): Array<{ label: string; error: string }> | undefined {
  if (!data) return undefined;
  const v = (data as Record<string, unknown>)._errors;
  return Array.isArray(v) ? (v as Array<{ label: string; error: string }>) : undefined;
}
