"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { studioPath, stripStudioBasePath } from "@/lib/base-path";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Open-redirect guard: only honour `next` paths that stay inside Studio.
  const rawNext = params?.get("next") || "/";
  const safeNext =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  // `router.replace()` auto-prepends basePath. If `next` already includes
  // the basePath (e.g. a manually-bookmarked link to
  // `/studio/login?next=/studio/drafts`), strip it here so we end up
  // navigating to `/studio/drafts`, not `/studio/studio/drafts`. The
  // middleware now writes app-relative paths into `next`, so the strip
  // is a no-op for our own internal redirects.
  const next = stripStudioBasePath(safeNext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(studioPath("/api/auth/login"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        if (res.status === 503) {
          setError(
            "Studio is not configured yet. Set STUDIO_EMAIL, STUDIO_PASSWORD_HASH and STUDIO_JWT_SECRET in the container environment."
          );
        } else if (data?.error === "invalid_credentials") {
          setError("Invalid credentials.");
        } else {
          setError("Sign-in failed. Please try again.");
        }
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding:
          "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))",
        background:
          "radial-gradient(1100px 700px at 80% -10%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 55%), " +
          "radial-gradient(900px 600px at -10% 100%, color-mix(in oklab, var(--bg-elev) 60%, transparent), transparent 60%)",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 28,
          boxShadow: "0 30px 60px -30px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              width: 36,
              height: 36,
              borderRadius: 10,
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--accent) 60%, transparent) 0%, transparent 70%)",
              border: "1px solid var(--border)",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--accent)",
              letterSpacing: -1,
            }}
          >
            F
          </span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <strong style={{ fontSize: 15, letterSpacing: 0.2 }}>Fanaa Studio</strong>
            <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
              Internal access
            </span>
          </div>
        </div>

        <h1
          style={{
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: -0.3,
            margin: 0,
            marginBottom: 6,
          }}
        >
          Welcome back
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-dim)",
            lineHeight: 1.5,
            margin: 0,
            marginBottom: 22,
          }}
        >
          Sign in to access the AI production system.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Label htmlFor="email">Email</Label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          {error && (
            <div
              role="alert"
              style={{
                padding: "10px 12px",
                fontSize: 13,
                lineHeight: 1.45,
                color: "var(--danger)",
                background: "color-mix(in oklab, var(--danger) 12%, transparent)",
                border: "1px solid color-mix(in oklab, var(--danger) 40%, transparent)",
                borderRadius: 10,
                whiteSpace: "normal",
              }}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              appearance: "none",
              border: 0,
              width: "100%",
              padding: "14px 14px",
              background: "var(--accent)",
              color: "#0b0c10",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 0.02,
              cursor: loading ? "wait" : "pointer",
              transition: "filter 120ms ease",
            }}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.filter = "brightness(1.06)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.filter = "brightness(1)";
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <p
          style={{
            marginTop: 18,
            marginBottom: 0,
            fontSize: 11,
            color: "var(--text-dim)",
            letterSpacing: 0.1,
            textAlign: "center",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Authorised personnel only
        </p>
      </form>
    </main>
  );
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: 11,
        letterSpacing: 0.16,
        textTransform: "uppercase",
        color: "var(--text-dim)",
        marginBottom: 6,
        fontWeight: 600,
      }}
    >
      {children}
    </label>
  );
}
