import type { BenefitsProps } from "@/lib/studio/preview-props";
import { LocalePair } from "./LocalePair";

export function Benefits({ props }: { props: BenefitsProps }) {
  if (props.items.length === 0) return null;
  return (
    <section className="section-card">
      <span className="section-eyebrow">Value</span>
      <h2>Benefits ({props.items.length})</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {props.items.map((b, i) => (
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span className="tag tag-accent">{b.iconKey}</span>
            </div>
            <LocalePair ar={b.title.ar} en={b.title.en} size="lg" />
            <LocalePair ar={b.body.ar} en={b.body.en} size="sm" />
          </article>
        ))}
      </div>
    </section>
  );
}
