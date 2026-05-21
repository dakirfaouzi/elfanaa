"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  const next = params?.get("next") || "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 503) {
          setError("Admin is not configured yet. Set ADMIN_EMAIL, ADMIN_PASSWORD, and JWT_SECRET.");
        } else {
          setError(data?.error === "invalid_credentials" ? "Invalid credentials." : "Sign-in failed.");
        }
        return;
      }
      router.replace(next.startsWith("/admin") ? next : "/admin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding: "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))",
        /* The `.fa-admin` ancestor already paints the themed background
         * via CSS; this overlay just adds the centred halo + soft floor
         * gradient regardless of light/dark.  Both swatches use the
         * `--fa-accent` token so they inherit the active palette. */
        background:
          "radial-gradient(1100px 700px at 80% -10%, rgb(var(--fa-accent) / 0.16), transparent 55%), " +
          "radial-gradient(900px 600px at -10% 100%, rgb(var(--fa-bg-2) / 0.6), transparent 60%)",
      }}
    >
      <form
        onSubmit={onSubmit}
        className="fa-card fa-card-pad-lg"
        style={{
          width: "100%",
          maxWidth: 400,
          boxShadow: "var(--fa-shadow-pop)",
        }}
      >
        <div
          className="fa-brand"
          style={{ padding: 0, marginBottom: 22, border: 0 }}
        >
          <div className="fa-brand-mark" />
          <div className="fa-brand-text">
            <strong>Fanaa</strong>
            <span>Admin</span>
          </div>
        </div>

        <h1
          style={{
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: 22,
            fontWeight: 600,
            color: "rgb(var(--fa-text))",
            letterSpacing: "-0.01em",
            margin: 0,
            marginBottom: 6,
          }}
        >
          Welcome back
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "rgb(var(--fa-text-muted))",
            lineHeight: 1.5,
            marginBottom: 22,
          }}
        >
          Sign in to access the Fanaa operating system.
        </p>

        <div className="fa-stack">
          <div>
            <div className="fa-kpi-label" style={{ marginBottom: 6 }}>Email</div>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="fa-input"
            />
          </div>
          <div>
            <div className="fa-kpi-label" style={{ marginBottom: 6 }}>Password</div>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="fa-input"
            />
          </div>
          {error && (
            <div
              className="fa-tag"
              data-tone="danger"
              style={{ padding: "8px 12px", whiteSpace: "normal", lineHeight: 1.4 }}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="fa-btn"
            data-tone="primary"
            style={{
              width: "100%",
              justifyContent: "center",
              padding: "14px 14px",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 0.02,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <p
          style={{
            marginTop: 18,
            fontSize: 11.5,
            color: "rgb(var(--fa-text-dim))",
            letterSpacing: 0.08,
            textAlign: "center",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Authorised personnel only · All sign-ins are logged
        </p>
      </form>
    </div>
  );
}
