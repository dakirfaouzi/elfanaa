import type { OfferTiersProps } from "@/lib/studio/preview-props";

export function OfferTiers({ props }: { props: OfferTiersProps }) {
  return (
    <section className="section-card">
      <span className="section-eyebrow">Fanaa extension</span>
      <h2>Offer tiers ({props.tiers.length})</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${props.tiers.length}, minmax(0, 1fr))`,
          gap: 10,
        }}
      >
        {props.tiers.map((t, i) => (
          <article
            key={t.quantity}
            style={{
              background: i === 1 ? "color-mix(in oklab, var(--accent) 8%, transparent)" : "var(--bg-elev)",
              border: `1px solid ${i === 1 ? "var(--accent-soft)" : "var(--border)"}`,
              borderRadius: "var(--radius)",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              textAlign: "center",
            }}
          >
            <span className="text-dim" style={{ fontSize: 11 }}>
              ×{t.quantity}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{t.total.display}</span>
            <span className="text-faint" style={{ fontSize: 11 }}>
              {t.pricePerUnitDisplay}/unit
            </span>
            {t.savingsVsTier1Percent > 0 && (
              <span className="tag tag-success">save {t.savingsVsTier1Percent}%</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
