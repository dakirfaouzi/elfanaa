"use client";

import useSWR from "swr";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Database, Server, ShieldCheck } from "lucide-react";
import { adminFetcher, ErrorState } from "../_components/data";
import { formatNumber } from "../_components/format";

type Diagnostics = {
  status: "ok" | "degraded" | "down";
  env: Record<string, { ok: boolean; detail?: string | null }>;
  auth: { ready: boolean };
  db: {
    configured: boolean;
    reachable: boolean;
    latencyMs: number | null;
    error: string | null;
    configWarning: string | null;
  };
  schema: {
    expected: string[];
    missing: string[];
    version: number | null;
    tables: Array<{ name: string; exists: boolean; rows: number | null; error?: string }>;
  };
  hints: string[];
  checkedAt: string;
};

const STATUS_LABEL: Record<Diagnostics["status"], { label: string; color: string; bg: string }> = {
  ok: { label: "All systems healthy", color: "rgb(92 122 88)", bg: "rgba(92, 122, 88, 0.10)" },
  degraded: { label: "Degraded", color: "rgb(186 130 32)", bg: "rgba(186, 130, 32, 0.10)" },
  down: { label: "Down", color: "rgb(158 60 56)", bg: "rgba(158, 60, 56, 0.10)" },
};

export function SettingsClient() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<Diagnostics>(
    "/api/admin/diagnostics",
    adminFetcher,
    { revalidateOnFocus: false, refreshInterval: 0 }
  );

  if (error && !data) return <ErrorState error={error} />;

  if (isLoading || !data) {
    return (
      <div className="fa-stack">
        <div className="fa-skel" style={{ height: 120 }} />
        <div className="fa-skel" style={{ height: 200 }} />
        <div className="fa-skel" style={{ height: 280 }} />
      </div>
    );
  }

  const statusTheme = STATUS_LABEL[data.status];
  const dbConfigured = data.db.configured;
  const dbReachable = data.db.reachable;

  return (
    <div className="fa-stack">
      {/* ── Header banner ─────────────────────────────────────────── */}
      <div
        className="fa-card fa-card-pad-lg"
        style={{
          borderColor: statusTheme.color + "55",
          background: statusTheme.bg,
        }}
      >
        <div className="fa-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontSize: 11,
                color: "rgb(125 107 93)",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Diagnostics
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: statusTheme.color,
                marginTop: 6,
                fontFamily: "ui-serif, Georgia, serif",
                letterSpacing: "-0.01em",
              }}
            >
              {statusTheme.label}
            </div>
            <div style={{ fontSize: 12.5, color: "rgb(125 107 93)", marginTop: 6 }}>
              Last checked {new Date(data.checkedAt).toLocaleTimeString()}
            </div>
          </div>
          <button
            type="button"
            className="fa-btn"
            disabled={isValidating}
            onClick={() => mutate()}
            style={{ flexShrink: 0 }}
          >
            <RefreshCw size={13} style={{ animation: isValidating ? "fa-spin 1s linear infinite" : undefined }} />
            Refresh
          </button>
        </div>
        {data.hints.length > 0 && (
          <ul
            style={{
              marginTop: 14,
              fontSize: 13.5,
              color: "rgb(42 33 28)",
              paddingLeft: 18,
              lineHeight: 1.5,
            }}
          >
            {data.hints.map((h, i) => (
              <li key={i} style={{ marginTop: 4 }}>
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Three diagnostic cards: DB / Schema / Auth ─────────────── */}
      <div className="fa-grid fa-grid-3">
        {/* Database */}
        <div className="fa-card fa-card-pad-lg">
          <div className="fa-row" style={{ alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Database size={16} style={{ color: "rgb(165 130 95)" }} />
            <h2 style={{ fontSize: 14, margin: 0, fontWeight: 600 }}>Admin database</h2>
          </div>
          <Row label="ADMIN_DATABASE_URL" ok={dbConfigured} />
          <Row
            label="Connection reachable"
            ok={dbReachable}
            detail={
              dbReachable
                ? `${data.db.latencyMs ?? "?"} ms round-trip`
                : data.db.error ?? "—"
            }
          />
          {data.db.configWarning && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12.5,
                color: "rgb(186 130 32)",
                padding: "8px 10px",
                background: "rgba(186, 130, 32, 0.08)",
                borderRadius: 8,
                border: "1px solid rgba(186, 130, 32, 0.25)",
              }}
            >
              {data.db.configWarning}
            </div>
          )}
        </div>

        {/* Schema */}
        <div className="fa-card fa-card-pad-lg">
          <div className="fa-row" style={{ alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Server size={16} style={{ color: "rgb(180 140 160)" }} />
            <h2 style={{ fontSize: 14, margin: 0, fontWeight: 600 }}>Schema</h2>
          </div>
          <div className="fa-row" style={{ justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "rgb(125 107 93)" }}>Version</span>
            <span className="fa-mono">{data.schema.version ?? "—"}</span>
          </div>
          <div className="fa-row" style={{ justifyContent: "space-between", fontSize: 13, marginTop: 6 }}>
            <span style={{ color: "rgb(125 107 93)" }}>Tables present</span>
            <span className="fa-mono">
              {data.schema.expected.length - data.schema.missing.length} / {data.schema.expected.length}
            </span>
          </div>
          {data.schema.missing.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: "rgb(186 130 32)" }}>
              Missing: <code>{data.schema.missing.join(", ")}</code>
            </div>
          )}
        </div>

        {/* Auth */}
        <div className="fa-card fa-card-pad-lg">
          <div className="fa-row" style={{ alignItems: "center", gap: 10, marginBottom: 10 }}>
            <ShieldCheck size={16} style={{ color: "rgb(92 122 88)" }} />
            <h2 style={{ fontSize: 14, margin: 0, fontWeight: 600 }}>Admin auth</h2>
          </div>
          <Row label="ADMIN_EMAIL" ok={data.env.ADMIN_EMAIL?.ok ?? false} />
          <Row
            label="ADMIN_PASSWORD"
            ok={data.env.ADMIN_PASSWORD?.ok ?? false}
            detail={data.env.ADMIN_PASSWORD?.detail === "hash" ? "bcrypt hash" : data.env.ADMIN_PASSWORD?.detail === "plain" ? "plaintext (dev)" : undefined}
          />
          <Row label="JWT_SECRET" ok={data.env.JWT_SECRET?.ok ?? false} />
          {!data.auth.ready && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: "rgb(158 60 56)" }}>
              Login is currently disabled — set the three vars above and redeploy.
            </div>
          )}
        </div>
      </div>

      {/* ── Table rowcounts ───────────────────────────────────────── */}
      <div className="fa-card fa-card-pad-lg">
        <div className="fa-section-title">
          <h2>Admin tables</h2>
        </div>
        <table className="fa-table">
          <thead>
            <tr>
              <th>Table</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Rows</th>
            </tr>
          </thead>
          <tbody>
            {data.schema.tables.map((t) => (
              <tr key={t.name}>
                <td>
                  <code style={{ fontSize: 12 }}>{t.name}</code>
                </td>
                <td>
                  {t.exists ? (
                    <span className="fa-tag" data-tone="positive">present</span>
                  ) : (
                    <span className="fa-tag" data-tone="danger">missing</span>
                  )}
                  {t.error && (
                    <span className="fa-tag" data-tone="warn" style={{ marginLeft: 6 }}>
                      query error
                    </span>
                  )}
                </td>
                <td className="fa-mono" style={{ textAlign: "right" }}>
                  {t.rows == null ? "—" : formatNumber(t.rows)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Integrations ──────────────────────────────────────────── */}
      <div className="fa-card fa-card-pad-lg">
        <div className="fa-section-title">
          <h2>Optional integrations</h2>
        </div>
        <div className="fa-stack-sm" style={{ fontSize: 13 }}>
          <Row label="MaxMind credentials" ok={data.env.MAXMIND?.ok ?? false} detail="MAXMIND_ACCOUNT_ID + MAXMIND_LICENSE_KEY" />
          <Row label="Webhook secret" ok={data.env.WEBHOOK_SECRET?.ok ?? false} detail="Shared HMAC secret for /api/admin/ingest/orders" />
        </div>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "rgb(125 107 93)", lineHeight: 1.55 }}>
          Both are optional. Without MaxMind, traffic-quality scoring falls back to UA heuristics + GCC allowlist. Without
          WEBHOOK_SECRET, the order-mirror ingest endpoint rejects all writes — set it to the same value used by{" "}
          <code>/api/orders</code>.
        </p>
      </div>

      <style jsx global>{`
        @keyframes fa-spin {
          from { transform: rotate(0); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail?: string | null }) {
  return (
    <div
      className="fa-row"
      style={{ justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}
    >
      <div style={{ minWidth: 0 }}>
        <code style={{ fontSize: 12.5 }}>{label}</code>
        {detail && (
          <div style={{ fontSize: 11.5, color: "rgb(170 152 134)", marginTop: 2 }}>{detail}</div>
        )}
      </div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: ok ? "rgb(92 122 88)" : "rgb(158 60 56)",
          fontSize: 12.5,
          flexShrink: 0,
          fontWeight: 600,
        }}
      >
        {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        {ok ? "configured" : "missing"}
      </span>
    </div>
  );
}

// Suppress unused-import warning for the placeholder icon we may use in
// future expansions of the diagnostics surface.
void AlertCircle;
