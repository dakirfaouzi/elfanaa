import type { ReviewsProps } from "@/lib/studio/preview-props";
import { LocalePair } from "./LocalePair";

export function Reviews({ props }: { props: ReviewsProps }) {
  if (props.items.length === 0) return null;
  const total = props.items.length;
  return (
    <section className="section-card">
      <span className="section-eyebrow">Social proof</span>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2>Reviews ({total})</h2>
        {props.rating && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
              {props.rating.value.toFixed(1)}
            </span>
            <span className="text-dim" style={{ fontSize: 12 }}>
              of 5 · {props.rating.count} ratings
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 4,
          marginTop: 4,
        }}
      >
        {[5, 4, 3, 2, 1].map((star) => {
          const count = props.distribution[star as 1 | 2 | 3 | 4 | 5];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={star} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="text-faint" style={{ fontSize: 11 }}>
                {star}★ · {count}
              </span>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: "var(--bg-elev)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${pct}%`,
                    background: "color-mix(in oklab, var(--accent) 65%, transparent)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {props.items.map((r, i) => (
          <article
            key={i}
            style={{
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <LocalePair ar={r.name.ar} en={r.name.en} size="lg" />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "var(--accent)", letterSpacing: 1 }}>
                  {"★".repeat(Math.max(0, Math.min(5, Math.round(r.rating))))}
                </span>
                {r.verified && <span className="tag tag-success">verified</span>}
                <span className="text-faint" style={{ fontSize: 11 }}>
                  {r.date}
                </span>
              </div>
            </div>
            <LocalePair ar={r.body.ar} en={r.body.en} size="sm" />
            <LocalePair ar={r.city.ar} en={r.city.en} size="sm" />
          </article>
        ))}
      </div>
    </section>
  );
}
