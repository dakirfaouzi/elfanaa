import type {
  DraftsSummary,
  PublishesSummary,
  RunsSummary,
} from "@/lib/studio/dashboard-aggregations";

/**
 * Top-level KPI strip for the operator dashboard.
 *
 * Three cards, one per pillar of the operator's day:
 *
 *   1. Runs today    — pipeline pulse + in-flight + failures.
 *   2. Drafts        — what's open, what's ready, what needs triage.
 *   3. Published     — total live + last-24h velocity.
 *
 * # Why three KpiCards instead of one shared component
 *
 * Each pillar surfaces its own breakdown ("3 running", "1 failed" etc.)
 * so the visual rhythm is identical but the inner chips diverge. A
 * single generic component would need a typed `breakdown[]` prop that
 * masks intent at call-sites. Three small components read better.
 *
 * Server component — no client JS. The optional `SoftPoll` client
 * island handles refresh; this strip just renders from the snapshot.
 */
export function KpiStrip(props: {
  runs: RunsSummary;
  drafts: DraftsSummary;
  publishes: PublishesSummary;
  /** True when the DB mode is unavailable and `drafts` is empty by
   *  fallback rather than because nothing exists. Drives a small
   *  "—" affordance instead of "0". */
  draftsUnavailable: boolean;
}) {
  return (
    <section
      aria-label="Daily operator metrics"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      <RunsCard runs={props.runs} />
      <DraftsCard drafts={props.drafts} unavailable={props.draftsUnavailable} />
      <PublishedCard publishes={props.publishes} />
    </section>
  );
}

// ─── Cards ──────────────────────────────────────────────────────

function RunsCard({ runs }: { runs: RunsSummary }) {
  const hasFailure = runs.failedToday > 0;
  return (
    <DashCard
      label="Runs today"
      value={runs.totalToday}
      tone={hasFailure ? "warning" : "neutral"}
      footer={
        <CardChips
          chips={[
            { label: "completed", value: runs.completedToday, tone: "success" },
            { label: "failed", value: runs.failedToday, tone: "danger" },
            { label: "in flight", value: runs.runningNow, tone: "info" },
          ]}
        />
      }
    />
  );
}

function DraftsCard({
  drafts,
  unavailable,
}: {
  drafts: DraftsSummary;
  unavailable: boolean;
}) {
  if (unavailable) {
    return (
      <DashCard
        label="Drafts in progress"
        value="—"
        tone="neutral"
        footer={
          <span className="text-dim" style={{ fontSize: 12 }}>
            Draft store unavailable
          </span>
        }
      />
    );
  }
  const inProgress = drafts.inProgress + drafts.ready;
  const tone =
    drafts.failed > 0 ? "warning" : inProgress > 0 ? "info" : "neutral";
  return (
    <DashCard
      label="Drafts in progress"
      value={inProgress}
      tone={tone}
      footer={
        <CardChips
          chips={[
            { label: "ready", value: drafts.ready, tone: "success" },
            { label: "active", value: drafts.inProgress, tone: "info" },
            { label: "failed", value: drafts.failed, tone: "danger" },
          ]}
        />
      }
    />
  );
}

function PublishedCard({ publishes }: { publishes: PublishesSummary }) {
  return (
    <DashCard
      label="Live products"
      value={publishes.totalLive}
      tone={publishes.totalLive > 0 ? "success" : "neutral"}
      footer={
        <CardChips
          chips={[
            { label: "in last 24h", value: publishes.last24h, tone: "accent" },
          ]}
        />
      }
    />
  );
}

// ─── Primitives ─────────────────────────────────────────────────

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

function DashCard(props: {
  label: string;
  value: number | string;
  tone: Tone;
  footer: React.ReactNode;
}) {
  const palette = paletteFor(props.tone);
  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "16px 18px",
        background: palette.tint,
        border: `1px solid ${palette.border}`,
        borderRadius: "var(--radius-lg)",
        transition:
          "border-color var(--transition-medium) var(--ease-out), background var(--transition-medium) var(--ease-out)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          fontWeight: 600,
        }}
      >
        {props.label}
      </span>
      <span
        style={{
          fontFamily: "ui-serif, Georgia, serif",
          fontSize: 32,
          letterSpacing: "-0.5px",
          color: palette.color,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {props.value}
      </span>
      {props.footer}
    </article>
  );
}

function CardChips(props: {
  chips: ReadonlyArray<{ label: string; value: number; tone: Tone }>;
}) {
  // Drop chips with zero value so empty cards collapse cleanly instead
  // of showing "0 completed · 0 failed · 0 in flight" noise. If every
  // chip is zero we render an em-dash so the card still has rhythm.
  const visible = props.chips.filter((c) => c.value > 0);
  if (visible.length === 0) {
    return (
      <span
        className="text-dim"
        style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}
      >
        —
      </span>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        fontSize: 12,
        fontVariantNumeric: "tabular-nums",
        color: "var(--text-dim)",
      }}
    >
      {visible.map((c) => (
        <span
          key={c.label}
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 5,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              color: `var(--${c.tone})`,
              fontSize: 13,
            }}
          >
            {c.value}
          </span>
          <span>{c.label}</span>
        </span>
      ))}
    </div>
  );
}

function paletteFor(tone: Tone): {
  color: string;
  border: string;
  tint: string;
} {
  switch (tone) {
    case "info":
      return {
        color: "var(--info)",
        border: "color-mix(in srgb, var(--info) 32%, var(--border))",
        tint: "color-mix(in srgb, var(--info) 6%, var(--surface))",
      };
    case "success":
      return {
        color: "var(--success)",
        border: "color-mix(in srgb, var(--success) 32%, var(--border))",
        tint: "color-mix(in srgb, var(--success) 6%, var(--surface))",
      };
    case "warning":
      return {
        color: "var(--warning)",
        border: "color-mix(in srgb, var(--warning) 32%, var(--border))",
        tint: "color-mix(in srgb, var(--warning) 6%, var(--surface))",
      };
    case "danger":
      return {
        color: "var(--danger)",
        border: "color-mix(in srgb, var(--danger) 32%, var(--border))",
        tint: "color-mix(in srgb, var(--danger) 6%, var(--surface))",
      };
    case "accent":
      return {
        color: "var(--accent)",
        border: "color-mix(in srgb, var(--accent) 32%, var(--border))",
        tint: "color-mix(in srgb, var(--accent) 6%, var(--surface))",
      };
    default:
      return {
        color: "var(--text)",
        border: "var(--border)",
        tint: "var(--surface)",
      };
  }
}
