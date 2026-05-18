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
        padding: 20,
        background:
          "radial-gradient(900px 600px at 80% -20%, rgba(199,162,124,0.10), transparent 60%), rgb(8 9 11)",
      }}
    >
      <form
        onSubmit={onSubmit}
        className="fa-card fa-card-pad-lg"
        style={{ width: "100%", maxWidth: 380 }}
      >
        <div className="fa-brand" style={{ padding: 0, marginBottom: 18 }}>
          <div className="fa-brand-mark" />
          <div className="fa-brand-text">
            <strong>Fanaa</strong>
            <span>Admin</span>
          </div>
        </div>
        <div className="fa-stack">
          <div>
            <div className="fa-kpi-label">Email</div>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="fa-input"
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <div className="fa-kpi-label">Password</div>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="fa-input"
              style={{ marginTop: 6 }}
            />
          </div>
          {error && (
            <div className="fa-tag" data-tone="danger" style={{ padding: "8px 12px" }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="fa-btn"
            data-tone="primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px 14px" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <p
          style={{
            marginTop: 14,
            fontSize: 11.5,
            color: "rgb(110,118,132)",
            letterSpacing: 0.02,
            textAlign: "center",
          }}
        >
          Authorised personnel only. All sign-in attempts are logged.
        </p>
      </form>
    </div>
  );
}
