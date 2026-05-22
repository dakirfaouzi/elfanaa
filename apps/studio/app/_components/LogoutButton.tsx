"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { studioPath } from "@/lib/base-path";

/**
 * Logout button — POSTs to /api/auth/logout, then hard-replaces /login.
 *
 * Why a hard `router.replace` instead of `router.push`:
 * the cookie is cleared by the API response, but the in-memory router
 * cache may still hold a snapshot of the gated dashboard. Replace + a
 * full reload guarantees the browser re-runs middleware against an
 * empty cookie jar on the next navigation.
 */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch(studioPath("/api/auth/logout"), {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Even on network failure, fall through to the redirect — the
      // cookie may have cleared client-side anyway, and the redirected
      // /login page will surface the next correct state.
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        appearance: "none",
        background: "transparent",
        color: "var(--text-dim)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "8px 14px",
        fontSize: 13,
        cursor: busy ? "wait" : "pointer",
        transition: "color 120ms ease, border-color 120ms ease",
      }}
      onMouseOver={(e) => {
        if (!busy) e.currentTarget.style.color = "var(--text)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.color = "var(--text-dim)";
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
