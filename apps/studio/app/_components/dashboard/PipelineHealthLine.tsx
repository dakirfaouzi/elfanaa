import {
  formatHealthDuration,
  formatHealthPercent,
  type PipelineHealth,
} from "@/lib/studio/dashboard-aggregations";

/**
 * Single-line pipeline health summary anchored at the bottom of the
 * dashboard. Surfaces three facts the operator wants peripheral
 * visibility on without scrolling into the runs list:
 *
 *   • Success rate over the recent sample (with sample size for context).
 *   • Average completion duration on successful runs.
 *   • The sample window itself ("last 20 runs") so the operator can
 *     calibrate whether the rate is meaningful.
 *
 * # Tone
 *
 * Color shifts when the success rate dips below ~85% — chosen as the
 * boundary where the dashboard should attract attention but not alarm.
 * Below 60% we switch to danger. Empty sample → neutral.
 */
export function PipelineHealthLine(props: { health: PipelineHealth }) {
  const tone = healthTone(props.health);
  const rateLabel = formatHealthPercent(
    props.health.successRate,
    props.health.sampleSize,
  );
  const durationLabel = formatHealthDuration(props.health.avgDurationMs);
  const sampleLabel =
    props.health.sampleSize === 0
      ? "no completed runs yet"
      : `over the last ${props.health.sampleSize} run${props.health.sampleSize === 1 ? "" : "s"}`;

  return (
    <footer
      aria-label="Pipeline health"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        background: "var(--surface)",
        border: `1px solid ${toneBorder(tone)}`,
        borderRadius: "var(--radius-lg)",
        fontSize: 12,
        color: "var(--text-dim)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontSize: 10,
          color: "var(--text-faint)",
        }}
      >
        <HealthDot tone={tone} />
        Pipeline health
      </span>
      <HealthStat label="Success rate" value={rateLabel} accentTone={tone} />
      <HealthStat label="Avg duration" value={durationLabel} accentTone="neutral" />
      <span style={{ marginLeft: "auto", fontSize: 11 }}>{sampleLabel}</span>
    </footer>
  );
}

function HealthStat(props: {
  label: string;
  value: string;
  accentTone: HealthTone;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        style={{
          fontWeight: 700,
          color: toneText(props.accentTone),
          fontSize: 14,
          letterSpacing: "-0.01em",
        }}
      >
        {props.value}
      </span>
      <span>{props.label}</span>
    </span>
  );
}

function HealthDot({ tone }: { tone: HealthTone }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 999,
        background: toneText(tone),
        boxShadow: `0 0 0 3px color-mix(in srgb, ${toneText(tone)} 18%, transparent)`,
      }}
    />
  );
}

type HealthTone = "neutral" | "success" | "warning" | "danger";

function healthTone(health: PipelineHealth): HealthTone {
  if (health.sampleSize === 0) return "neutral";
  if (health.successRate >= 0.85) return "success";
  if (health.successRate >= 0.6) return "warning";
  return "danger";
}

function toneText(tone: HealthTone): string {
  switch (tone) {
    case "success":
      return "var(--success)";
    case "warning":
      return "var(--warning)";
    case "danger":
      return "var(--danger)";
    default:
      return "var(--text-dim)";
  }
}

function toneBorder(tone: HealthTone): string {
  switch (tone) {
    case "success":
      return "color-mix(in srgb, var(--success) 22%, var(--border))";
    case "warning":
      return "color-mix(in srgb, var(--warning) 28%, var(--border))";
    case "danger":
      return "color-mix(in srgb, var(--danger) 32%, var(--border))";
    default:
      return "var(--border)";
  }
}
