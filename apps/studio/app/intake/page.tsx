import { NavBar } from "../_components/NavBar";
import { IntakeForm } from "../_components/IntakeForm";

export const dynamic = "force-dynamic";

/**
 * Intake page (PLATFORM.md M9 deliverable 1).
 *
 * Server component shell with the client `IntakeForm` mounted inside.
 * No state lives here — the form posts to `/api/studio/intake` and
 * navigates to `/runs/<id>` on success, where the LiveStepTimeline
 * picks up the SSE stream.
 */
export default function IntakePage() {
  return (
    <div className="shell">
      <NavBar active="intake" />
      <main className="shell-main">
        <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="section-eyebrow">M9 · Intake</span>
          <h1
            style={{
              margin: 0,
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: "clamp(24px, 3vw, 32px)",
              letterSpacing: -0.4,
            }}
          >
            Dispatch a new pipeline run
          </h1>
          <p className="text-dim" style={{ margin: 0, fontSize: 14, maxWidth: 720, lineHeight: 1.55 }}>
            Submit a supplier URL and operator notes. The dispatcher mints a
            runId, runs the 11-stage pipeline through the resolved provider
            chain (Anthropic / fal.ai / Firecrawl), enforces the store's
            cost ceiling, and writes the published bundle to{" "}
            <code className="code">.platform-data/products/</code>.
          </p>
        </header>

        <IntakeForm defaultStoreId="fanaa" />

        <section className="section-card">
          <span className="section-eyebrow">Notes</span>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.65 }}>
            <li>
              Provider keys (<code className="code">ANTHROPIC_API_KEY</code>,{" "}
              <code className="code">FAL_KEY</code>,{" "}
              <code className="code">FIRECRAWL_API_KEY</code>) must be set on the Studio container — otherwise the run will land in a `failed`
              state immediately with the reason{" "}
              <code className="code">providers_unavailable:…</code>.
            </li>
            <li>
              The cost ceiling defaults to{" "}
              <code className="code">${process.env.NODE_ENV === "production" ? "5" : "5"}</code> per
              draft (configured in <code className="code">StoreConfig.costCeilingPerDraftUsd</code>).
              A run that crosses it is aborted with{" "}
              <code className="code">cost_exceeded:…</code>.
            </li>
            <li>
              Live publish to <code className="code">apps/fanaa/data/products.ts</code> via
              Octokit PR arrives in M10. M9 ships file-backed publish only.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
