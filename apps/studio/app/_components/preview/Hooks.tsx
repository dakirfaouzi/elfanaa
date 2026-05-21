import type { HooksProps } from "@/lib/studio/preview-props";
import { LocalePair } from "./LocalePair";

export function Hooks({ props }: { props: HooksProps }) {
  if (props.items.length === 0) return null;
  return (
    <section className="section-card">
      <span className="section-eyebrow">Paid marketing</span>
      <h2>Ad hooks ({props.items.length})</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {props.items.map((h, i) => (
          <article
            key={i}
            style={{
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="tag tag-accent">{h.angle}</span>
            </div>
            <LocalePair ar={h.body.ar} en={h.body.en} size="md" />
            <LocalePair ar={h.cta.ar} en={h.cta.en} size="sm" />
          </article>
        ))}
      </div>
    </section>
  );
}
