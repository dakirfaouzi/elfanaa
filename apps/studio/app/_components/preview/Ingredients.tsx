import type { IngredientsProps } from "@/lib/studio/preview-props";
import { LocalePair } from "./LocalePair";

export function Ingredients({ props }: { props: IngredientsProps }) {
  if (props.items.length === 0) return null;
  return (
    <section className="section-card">
      <span className="section-eyebrow">Beauty / wellness</span>
      <h2>Ingredients ({props.items.length})</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {props.items.map((ing, i) => (
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
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <LocalePair ar={ing.name.ar} en={ing.name.en} size="lg" />
              {ing.inci && <code className="code">{ing.inci}</code>}
            </div>
            <LocalePair ar={ing.role.ar} en={ing.role.en} size="sm" />
          </article>
        ))}
      </div>
    </section>
  );
}
