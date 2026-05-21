import type { SpecsProps } from "@/lib/studio/preview-props";
import { LocalePair } from "./LocalePair";

export function Specifications({ props }: { props: SpecsProps }) {
  if (props.items.length === 0 && props.certifications.length === 0) return null;
  return (
    <section className="section-card">
      <span className="section-eyebrow">Niche</span>
      <h2>Specifications</h2>
      {props.items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {props.items.map((s, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(140px, 1fr) 2fr",
                gap: 12,
                padding: "8px 12px",
                background: "var(--bg-elev)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            >
              <LocalePair ar={s.key.ar} en={s.key.en} size="sm" />
              <LocalePair ar={s.value.ar} en={s.value.en} size="sm" />
            </div>
          ))}
        </div>
      )}
      {props.certifications.length > 0 && (
        <>
          <span className="section-eyebrow" style={{ marginTop: 12 }}>
            Certifications
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {props.certifications.map((c, i) => (
              <span key={i} className="tag tag-info">
                {c.issuer}
                {c.number ? ` · ${c.number}` : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
