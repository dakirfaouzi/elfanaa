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
          <span className="section-eyebrow">Intake</span>
          <h1
            style={{
              margin: 0,
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: "clamp(24px, 3vw, 32px)",
              letterSpacing: -0.4,
            }}
          >
            New product run
          </h1>
          <p className="text-dim" style={{ margin: 0, fontSize: 14, maxWidth: 760, lineHeight: 1.55 }}>
            Six sections — source, audience, assets, pricing, internal
            cost, and pipeline controls. Only the supplier URL and a
            unit price hint are required; everything else sharpens the
            output. Dispatch mints a runId, executes the 11-stage AI
            pipeline (Anthropic · fal.ai · Firecrawl), and publishes the
            bundle to the storefront.
          </p>
        </header>

        <IntakeForm defaultStoreId="fanaa" />

        <section className="section-card">
          <span className="section-eyebrow">Operator notes</span>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.65 }}>
            <li>
              Provider keys (<code className="code">ANTHROPIC_API_KEY</code>,{" "}
              <code className="code">FAL_KEY</code>,{" "}
              <code className="code">FIRECRAWL_API_KEY</code>) must be set on the Studio container — otherwise the run lands in <code className="code">failed</code> immediately with reason{" "}
              <code className="code">providers_unavailable:…</code>.
            </li>
            <li>
              Cost ceiling defaults to{" "}
              <code className="code">$5</code> per draft
              (<code className="code">StoreConfig.costCeilingPerDraftUsd</code>);
              runs that cross it abort with{" "}
              <code className="code">cost_exceeded:…</code>.
            </li>
            <li>
              Structured targeting + cost breakdown are serialised into the
              existing strategy-stage prompt at submit time — no downstream
              changes; the raw objects also flow through via{" "}
              <code className="code">intakeMetadata</code> for future stages.
            </li>
            <li>
              Intake image uploads land under{" "}
              <code className="code">studio-intake/&lt;storeId&gt;/</code> in
              R2. Configure the bucket lifecycle rule to expire that prefix
              after 1 day to GC uncommitted uploads.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
