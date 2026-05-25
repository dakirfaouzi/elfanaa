import { NavBar } from "./_components/NavBar";
import { DraftsAttentionCard } from "./_components/dashboard/DraftsAttentionCard";
import { KpiStrip } from "./_components/dashboard/KpiStrip";
import { PipelineHealthLine } from "./_components/dashboard/PipelineHealthLine";
import { RecentPublishesStrip } from "./_components/dashboard/RecentPublishesStrip";
import { RecentRunsCard } from "./_components/dashboard/RecentRunsCard";
import { SoftPoll } from "./_components/dashboard/SoftPoll";
import { listDrafts } from "@/lib/studio/drafts-service";
import {
  pickAttentionDrafts,
  pickRecentPublishes,
  pickRecentRuns,
  pipelineHealth,
  summariseDrafts,
  summarisePublishes,
  summariseRuns,
} from "@/lib/studio/dashboard-aggregations";
import {
  listProducts,
  listPublishedStores,
  type ProductSummary,
} from "@/lib/studio/product-loader";
import { listRuns } from "@/lib/studio/run-loader";

export const dynamic = "force-dynamic";

/**
 * Studio root — C4 operator dashboard.
 *
 * # Frame
 *
 *   1. PageHeader with eyebrow + title + soft-poll indicator.
 *   2. KPI strip (Runs today / Drafts in progress / Live products).
 *   3. Two-column row: Recent runs + Drafts needing attention.
 *   4. Recent publishes strip (horizontal product cards with thumbnails).
 *   5. Pipeline-health line anchored at the bottom.
 *
 * # Routing
 *
 *  Previously this route 302'd to `/drafts`. We now serve the dashboard
 *  here directly AND keep a NavBar "Home" tab so operators can return
 *  to the overview from anywhere in Studio. The middleware still gates
 *  authentication before this handler runs.
 *
 * # Refresh model
 *
 *  Soft client-side poll — `<SoftPoll>` calls `router.refresh()` every
 *  30s while the tab is visible, which re-runs THIS server component
 *  with a fresh data fetch. No SSE channel, no schema work — pure
 *  Tier-A additive.
 *
 * # Non-regression posture
 *
 *  This page consumes the EXISTING loaders (`listRuns`, `listDrafts`,
 *  `listProducts`) — no new repository methods, no schema migrations,
 *  no changes to the underlying flows. If one of the loaders surfaces
 *  a `mode_unavailable` (DB-only feature on a file-only deployment)
 *  the page degrades gracefully via the cards' `unavailable` props.
 */
export default async function StudioHomePage() {
  const [runs, draftsResult, productsByStore] = await Promise.all([
    listRuns(),
    listDrafts(),
    listAllProducts(),
  ]);

  const now = new Date();
  const draftsAvailable = draftsResult.ok;
  const draftList = draftsAvailable ? draftsResult.value : [];

  const runsSummary = summariseRuns(runs, now);
  const draftsSummary = summariseDrafts(draftList);
  const publishesSummary = summarisePublishes(productsByStore, now);
  const recentRuns = pickRecentRuns(runs, 8);
  const attentionDrafts = pickAttentionDrafts(draftList, 8);
  const recentPublishes = pickRecentPublishes(productsByStore, 6);
  const health = pipelineHealth(runs, 20);

  return (
    <div className="shell">
      <NavBar active="home" />
      <main className="shell-main">
        <PageHeader renderedAt={now.toISOString()} />
        <KpiStrip
          runs={runsSummary}
          drafts={draftsSummary}
          publishes={publishesSummary}
          draftsUnavailable={!draftsAvailable}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          <RecentRunsCard runs={recentRuns} />
          <DraftsAttentionCard
            drafts={attentionDrafts}
            unavailable={!draftsAvailable}
          />
        </div>
        <RecentPublishesStrip products={recentPublishes} />
        <PipelineHealthLine health={health} />
      </main>
    </div>
  );
}

function PageHeader(props: { renderedAt: string }) {
  return (
    <header
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow:
          "inset 0 1px 0 color-mix(in srgb, var(--text) 4%, transparent)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="section-eyebrow">Operator dashboard</span>
          <h1
            style={{
              margin: 0,
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: "clamp(26px, 3.2vw, 32px)",
              letterSpacing: "-0.4px",
              lineHeight: 1.1,
            }}
          >
            Today
          </h1>
          <p className="text-dim" style={{ margin: 0, fontSize: 13 }}>
            Pipeline health, drafts that need triage, and what just shipped.
          </p>
        </div>
        <SoftPoll renderedAt={props.renderedAt} />
      </div>
    </header>
  );
}

/**
 * Helper: union products across every published store.
 *
 * `listPublishedStores()` returns the set of store IDs that have
 * either FS-backed bundles or DB-published rows; we fan out one
 * `listProducts()` call per store and flatten the result. This keeps
 * the page free of store-specific logic — when a new store registers
 * in `@platform/stores` it shows up automatically.
 */
async function listAllProducts(): Promise<ProductSummary[]> {
  const stores = await listPublishedStores();
  if (stores.length === 0) return [];
  const grouped = await Promise.all(stores.map((s) => listProducts(s)));
  return grouped.flat();
}
