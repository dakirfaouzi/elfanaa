import { notFound } from "next/navigation";
import "@platform/runtime-renderer/css";
import { NavBar } from "../../_components/NavBar";
import { BuilderClient } from "../../_components/builder/BuilderClient";
import { getDraft } from "@/lib/studio/drafts-service";

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
        <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontFamily: "ui-serif, Georgia, serif" }}>
              {draft.title}
            </h1>
            <div className="text-faint" style={{ fontSize: 12, marginTop: 4 }}>
              <code className="code">{draft.id}</code> ·
              {" "}
              <code className="code">{draft.slug}</code> ·
              {" "}
              <span className={`tag tag-${tagForStatus(draft.status)}`}>{draft.status}</span>
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

function tagForStatus(status: string): string {
  switch (status) {
    case "published":
      return "success";
    case "failed":
      return "danger";
    case "generating":
    case "publishing":
      return "info";
    case "archived":
      return "warning";
    default:
      return "accent";
  }
}
