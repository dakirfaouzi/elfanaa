import { LogoutButton } from "./_components/LogoutButton";

export const dynamic = "force-dynamic";

/**
 * Studio dashboard — M2 empty shell.
 *
 * This page exists primarily to prove the JWT gate works end-to-end:
 *   1. Unauthenticated visitors → redirected by middleware to /login.
 *   2. Authenticated visitors  → reach this page.
 *
 * All real surfaces (intake wizard, drafts list, draft canvas, run timeline,
 * preview, publish) land in M8. M3–M7 build the catalog schema, providers,
 * pipeline, Inngest wiring, and Fanaa publisher in shared packages — none
 * of which are referenced here yet, so this page stays import-free of the
 * @platform/* surface area until those packages exist.
 */
export default function StudioHome() {
  return (
    <main
      style={{
        minHeight: "100svh",
        padding:
          "max(32px, env(safe-area-inset-top)) 24px max(48px, env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        gap: 32,
        maxWidth: 1120,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <BrandMark />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <strong style={{ fontSize: 16, letterSpacing: 0.2 }}>Fanaa Studio</strong>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              AI ecommerce production
            </span>
          </div>
        </div>
        <LogoutButton />
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            letterSpacing: 0.18,
            textTransform: "uppercase",
            color: "var(--accent)",
            fontWeight: 600,
          }}
        >
          M2 · Skeleton
        </span>
        <h1
          style={{
            fontFamily: "ui-serif, Georgia, serif",
            fontSize: "clamp(28px, 4vw, 36px)",
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          Studio is online.
        </h1>
        <p
          style={{
            color: "var(--text-dim)",
            margin: 0,
            maxWidth: 640,
            lineHeight: 1.6,
            fontSize: 15,
          }}
        >
          The shell is wired up and you're authenticated. Drafts, generation
          pipeline, provider registry, and publishing land in subsequent
          milestones — track progress in{" "}
          <code
            style={{
              padding: "2px 6px",
              borderRadius: 6,
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              fontSize: 13,
            }}
          >
            docs/architecture/PLATFORM.md
          </code>
          .
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {MILESTONES.map((m) => (
          <article
            key={m.id}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              opacity: m.status === "done" ? 1 : 0.62,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
                letterSpacing: 0.16,
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  color: m.status === "done" ? "var(--accent)" : "var(--text-dim)",
                  fontWeight: 600,
                }}
              >
                {m.id}
              </span>
              <span style={{ color: "var(--text-dim)" }}>
                {m.status === "done" ? "shipped" : "pending"}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 16 }}>{m.title}</h3>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--text-dim)",
                lineHeight: 1.55,
              }}
            >
              {m.body}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}

const MILESTONES = [
  {
    id: "M1",
    status: "done" as const,
    title: "Monorepo plumbing",
    body: "pnpm workspaces, Turborepo, apps/fanaa, services/api, packages/db.",
  },
  {
    id: "M2",
    status: "done" as const,
    title: "Studio skeleton",
    body: "JWT-gated login, empty dashboard shell — this page.",
  },
  {
    id: "M3",
    status: "pending" as const,
    title: "Catalog schema + Stores",
    body: "UniversalProduct type + Fanaa StoreConfig. Types only.",
  },
  {
    id: "M4",
    status: "pending" as const,
    title: "Provider registry",
    body: "Anthropic + fal.ai + Firecrawl + OpenAI adapters behind a contract.",
  },
  {
    id: "M5",
    status: "pending" as const,
    title: "Pipeline core",
    body: "13 stage functions with Zod schemas. Pure TypeScript, no Inngest yet.",
  },
  {
    id: "M6",
    status: "pending" as const,
    title: "Inngest wiring",
    body: "Workers + webhook receiver + run/regenerate/publish functions.",
  },
];

function BrandMark() {
  return (
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
  );
}
