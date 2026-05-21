import type { FaqProps } from "@/lib/studio/preview-props";
import { LocalePair } from "./LocalePair";

export function Faq({ props }: { props: FaqProps }) {
  if (props.items.length === 0) return null;
  return (
    <section className="section-card">
      <span className="section-eyebrow">Conversion</span>
      <h2>FAQ ({props.items.length})</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {props.items.map((f, i) => (
          <details
            key={i}
            style={{
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 12,
            }}
          >
            <summary style={{ cursor: "pointer", listStyle: "revert", display: "list-item" }}>
              <LocalePair ar={f.q.ar} en={f.q.en} size="lg" />
            </summary>
            <div style={{ marginTop: 10 }}>
              <LocalePair ar={f.a.ar} en={f.a.en} size="sm" />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
