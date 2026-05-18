import { adminEnv, isAdminAuthConfigured } from "@/lib/admin/env";
import { isAdminDbConfigured } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const checks = [
    {
      key: "ADMIN_DATABASE_URL",
      ok: isAdminDbConfigured,
      hint: "Postgres connection string for the analytics DB. Required.",
    },
    {
      key: "JWT_SECRET",
      ok: !!adminEnv.jwtSecret(),
      hint: "Long random string used to sign the admin session cookie.",
    },
    {
      key: "ADMIN_EMAIL",
      ok: !!adminEnv.adminEmail(),
      hint: "Email allowed to log into /admin.",
    },
    {
      key: "ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH)",
      ok: !!(adminEnv.adminPassword() || adminEnv.adminPasswordHash()),
      hint: "Plain password (quick start) OR bcrypt hash (production).",
    },
    {
      key: "MAXMIND_ACCOUNT_ID + MAXMIND_LICENSE_KEY",
      ok: !!(adminEnv.maxmindAccountId() && adminEnv.maxmindLicenseKey()),
      hint: "Enables VPN / proxy / datacenter detection. Optional but recommended.",
    },
    {
      key: "WEBHOOK_SECRET",
      ok: !!adminEnv.webhookSecret(),
      hint: "Shared secret for the HMAC-signed order ingestion webhook.",
    },
  ];
  const allowed = adminEnv.allowedCountries();

  return (
    <div className="fa-stack">
      <div className="fa-card fa-card-pad-lg">
        <div className="fa-section-title"><h2>Environment health</h2></div>
        <div className="fa-stack-sm">
          {checks.map((c) => (
            <div key={c.key} className="fa-row" style={{ alignItems: "flex-start" }}>
              <div>
                <code style={{ fontSize: 13 }}>{c.key}</code>
                <div style={{ fontSize: 12, color: "rgb(110,118,132)", marginTop: 2 }}>{c.hint}</div>
              </div>
              <span className="fa-tag" data-tone={c.ok ? "positive" : "danger"}>
                {c.ok ? "configured" : "missing"}
              </span>
            </div>
          ))}
        </div>
        {!isAdminAuthConfigured() && (
          <div className="fa-tag" data-tone="warn" style={{ marginTop: 14, padding: "8px 12px" }}>
            Admin login is currently disabled. Add the missing env vars to your deployment and redeploy.
          </div>
        )}
      </div>

      <div className="fa-card fa-card-pad-lg">
        <div className="fa-section-title"><h2>Traffic filter</h2></div>
        <div className="fa-stack-sm" style={{ fontSize: 13.5 }}>
          <div>
            <div className="fa-meta">Allowed countries (ISO-2)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {allowed.map((c) => (
                <span key={c} className="fa-tag" data-tone="accent">{c}</span>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "rgb(158,165,180)", marginTop: 8 }}>
            Override via <code>ADMIN_ALLOWED_COUNTRIES</code> (comma-separated, e.g. <code>SA,AE</code>).
          </div>
          <div>
            <div className="fa-meta">Quality threshold</div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>
              {process.env.ADMIN_QUALITY_THRESHOLD ?? "60"} / 100
            </div>
            <div style={{ fontSize: 12, color: "rgb(158,165,180)", marginTop: 4 }}>
              Sessions below this score are flagged invalid and excluded from analytics counts.
            </div>
          </div>
        </div>
      </div>

      <div className="fa-card fa-card-pad-lg">
        <div className="fa-section-title"><h2>Operational integrations</h2></div>
        <div className="fa-stack-sm" style={{ fontSize: 13 }}>
          <p style={{ color: "rgb(158,165,180)" }}>
            The order mirror is populated by a signed webhook fired from the existing <code>/api/orders</code> route.
            Add this URL to your environment:
          </p>
          <pre style={{
            background: "rgb(13 14 17)",
            border: "1px solid rgb(38 42 50)",
            borderRadius: 10,
            padding: 12,
            fontSize: 12,
            overflow: "auto",
          }}>
{`ORDERS_WEBHOOK_URL=https://YOUR_DOMAIN/api/admin/ingest/orders
WEBHOOK_SECRET=<same secret used by /api/orders>`}
          </pre>
          <p style={{ color: "rgb(158,165,180)", fontSize: 12 }}>
            No code changes are required — this hook already exists. The admin only subscribes.
          </p>
        </div>
      </div>
    </div>
  );
}
