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
        padding: 24,
        background:
          "radial-gradient(1100px 700px at 80% -10%, rgba(200,162,123,0.18), transparent 55%), " +
          "radial-gradient(900px 600px at -10% 100%, rgba(232,220,203,0.55), transparent 60%), " +
          "rgb(246 240 231)",
      }}
    >
      <form
        onSubmit={onSubmit}
        className="fa-card fa-card-pad-lg"
        style={{
          width: "100%",
          maxWidth: 400,
          boxShadow:
            "0 1px 2px rgba(56,40,24,0.05), 0 24px 60px -20px rgba(56,40,24,0.18)",
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
            color: "rgb(42 33 28)",
            letterSpacing: "-0.01em",
            marginBottom: 6,
          }}
        >
          Welcome back
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "rgb(125 107 93)",
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
            color: "rgb(170 152 134)",
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
