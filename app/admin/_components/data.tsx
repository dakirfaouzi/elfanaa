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
    <div className="fa-card fa-card-pad-lg" style={{ borderColor: "rgba(234,102,102,0.4)" }}>
      <div className="fa-row" style={{ alignItems: "flex-start", gap: 14 }}>
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "rgba(234,102,102,0.12)",
            color: "rgb(234,102,102)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "rgb(244,201,201)" }}>
            {isAuth ? "Session expired" : "Couldn't load metrics"}
          </div>
          <div style={{ fontSize: 13, marginTop: 4, color: "rgb(200,205,215)" }}>
            {message}
          </div>
          {detail && (
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 11.5,
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.18)",
                color: "rgb(176,182,196)",
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
        borderColor: "rgba(232,168,88,0.45)",
        background: "rgba(232,168,88,0.06)",
        padding: "10px 14px",
      }}
    >
      <div className="fa-row" style={{ alignItems: "flex-start", gap: 10 }}>
        <AlertTriangle size={15} style={{ color: "rgb(232,168,88)", flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: "rgb(214,196,168)", flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            Some metrics failed to load. Showing what we have.
          </div>
          <div style={{ fontSize: 12, color: "rgb(176,167,148)" }}>
            {errors.length} sub-quer{errors.length === 1 ? "y" : "ies"} returned an error.{" "}
            <Link href="/admin/settings" style={{ color: "rgb(232,168,88)", textDecoration: "underline" }}>
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
