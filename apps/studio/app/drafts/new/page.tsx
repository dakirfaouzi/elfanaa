import { NavBar } from "../../_components/NavBar";
import { NewDraftForm } from "../../_components/builder/NewDraftForm";

export const dynamic = "force-dynamic";

/**
 * /drafts/new — create a new blank draft.
 *
 * Renders the `NewDraftForm` client component which POSTs to
 * `/api/studio/drafts` and redirects to `/drafts/[id]` on success.
 *
 * Why a dedicated route (and not a modal on `/drafts`): keeps URLs
 * shareable, simplifies SSR, and lets us deep-link operators here
 * from intake validation errors.
 */
export default function NewDraftPage() {
  return (
    <div className="shell">
      <NavBar active="drafts" />
      <main className="shell-main">
        <h1 style={{ margin: 0, fontFamily: "ui-serif, Georgia, serif" }}>
          New draft
        </h1>
        <p className="text-dim" style={{ marginTop: -8 }}>
          Drafts hold the editable product page. Publish them when ready —
          the storefront renders from immutable snapshots.
        </p>
        <NewDraftForm />
      </main>
    </div>
  );
}
