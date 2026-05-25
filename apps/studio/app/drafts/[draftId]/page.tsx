import { notFound } from "next/navigation";
import Link from "next/link";
import "@platform/runtime-renderer/css";
import { NavBar } from "../../_components/NavBar";
import { BuilderClient } from "../../_components/builder/BuilderClient";
import { MetaChip } from "../../_components/MetaChip";
import { getDraft } from "@/lib/studio/drafts-service";
import {
  statusLabel,
  statusTagClass,
} from "@/lib/studio/draft-status-options";

export const dynamic = "force-dynamic";

/**
 * /drafts/[draftId] — the builder canvas.
 *
 * Server component: fetches the draft via the persistence factory
 * and hydrates `BuilderClient` with the initial document + version.
 *
 * # Hydration-safe rendering
 *
 *   • Initial server HTML renders the toolbar shell + section
 *     summaries.
 *   • The client component hydrates and takes over interactive
 *     bits without changing the DOM structure on first paint.
 *
 * # Mode awareness
 *
 *   • `not_found` → 404.
 *   • `mode_unavailable` → render a banner explaining how to enable
 *     dual-write. The builder still renders read-only so operators
 *     can verify what they would see.
 *
 * # C2 header polish
 *
 *   • Eyebrow / serif h1 / code chips / status tag — mirrors the
 *     run-detail rhythm from C1 so the operator flow reads as one
 *     coherent surface.
 *   • "← Drafts" back link sits inside the header card (same place
 *     "← Runs" sits in `runs/[runId]/page.tsx`).
 *   • Operator-facing status label via the shared mapping (no raw
 *     `intake` / `ready` enum names).
 */
export default async function DraftBuilderPage(
  props: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await props.params;
  const result = await getDraft(draftId);
  if (!result.ok && result.code === "not_found") {
    notFound();
  }
  if (!result.ok) {
    if (result.code === "mode_unavailable") {
      return (
        <div className="shell">
          <NavBar active="drafts" />
          <main className="shell-main">
            <div className="banner">
              Dual-write persistence is disabled. Enable it to edit drafts.
              See <code className="code">docs/M10-MANUAL-SETUP.md</code>.
            </div>
          </main>
        </div>
      );
    }
    return (
      <div className="shell">
        <NavBar active="drafts" />
        <main className="shell-main">
          <p className="banner danger">
            Could not load draft: {(result as { message?: string }).message ?? result.code}
          </p>
        </main>
      </div>
    );
  }
  const draft = result.value;

  return (
    <div className="shell">
      <NavBar active="drafts" />
      <main className="shell-main">
        <header
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow:
              "inset 0 1px 0 color-mix(in srgb, var(--text) 4%, transparent)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/drafts"
              style={{
                color: "var(--text-faint)",
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                transition: "color var(--transition-fast) var(--ease-out)",
              }}
            >
              ← Drafts
            </Link>
            <span className={statusTagClass(draft.status)}>
              {statusLabel(draft.status)}
            </span>
            <span className="tag tag-accent">{draft.storeId}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: 0,
                flex: "1 1 320px",
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontFamily: "ui-serif, Georgia, serif",
                  fontSize: 26,
                  letterSpacing: "-0.4px",
                  lineHeight: 1.15,
                  wordBreak: "break-word",
                }}
              >
                {draft.title}
              </h1>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px 14px",
                  alignItems: "baseline",
                  fontSize: 12,
                  color: "var(--text-dim)",
                }}
              >
                <MetaChip label="Slug">
                  <code className="code" style={{ fontSize: 11 }}>
                    /p/{draft.slug}
                  </code>
                </MetaChip>
                <MetaChip label="Id">
                  <code className="code" style={{ fontSize: 11 }}>
                    {draft.id}
                  </code>
                </MetaChip>
              </div>
            </div>
          </div>
        </header>
        <BuilderClient
          draftId={draft.id}
          storeId={draft.storeId}
          slug={draft.slug}
          initialDocument={draft.document}
          initialPayloadVersion={draft.payloadVersion}
        />
      </main>
    </div>
  );
}
