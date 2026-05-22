import { NavBar } from "../_components/NavBar";
import { AssetsBrowser } from "../_components/assets/AssetsBrowser";
import { getStudioPersistence } from "@/lib/studio/persistence";

export const dynamic = "force-dynamic";

/**
 * /assets — global asset browser.
 *
 * Server component shell + `AssetsBrowser` client component that
 * fetches `/api/studio/assets`, supports pagination + filter +
 * delete, and renders a grid of asset cards.
 *
 * # Mode awareness
 *
 * When DB persistence is off we show the same banner used by other
 * dual-write surfaces. Memory mode still works for upload demos
 * because the local upload route handles bytes locally.
 */
export default function AssetsPage() {
  const persistence = getStudioPersistence();
  const repositoriesEnabled = Boolean(persistence.repositories);
  return (
    <div className="shell">
      <NavBar active="assets" />
      <main className="shell-main">
        <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontFamily: "ui-serif, Georgia, serif" }}>
            Assets
          </h1>
          <div style={{ flex: 1 }} />
          <span className="text-dim" style={{ fontSize: 13 }}>
            Storage driver: <code className="code">{persistence.config.r2.driver}</code>
          </span>
        </header>
        {!repositoriesEnabled ? (
          <div className="banner">
            Dual-write persistence is disabled. Asset metadata cannot be
            indexed. Enable
            <code className="code"> STUDIO_PERSISTENCE_MODE=dual</code>
            to use the browser.
          </div>
        ) : null}
        {repositoriesEnabled ? <AssetsBrowser /> : null}
      </main>
    </div>
  );
}
