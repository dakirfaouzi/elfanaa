import type { HeroProps } from "@/lib/studio/preview-props";
import { LocalePair } from "./LocalePair";
import { PreviewImage } from "./PreviewImage";

/**
 * Hero preview block.
 *
 * Two-column layout on wide screens (image left, copy right), stacks
 * vertically on mobile. Both Arabic and English copy are surfaced
 * side-by-side so the operator can spot translation drift.
 *
 * Server component — no client JS. All conditional rendering is
 * resolved server-side from `buildHeroProps`.
 */
export function Hero({ props }: { props: HeroProps }) {
  return (
    <article
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)",
        gap: 24,
        alignItems: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
      }}
    >
      <PreviewImage
        src={props.hero.resolvedSrc}
        rawSrc={props.hero.src}
        alt={props.hero.alt}
        placeholder={props.hero.placeholder}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {props.badges && props.badges.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {props.badges.map((b, i) => (
              <span key={i} className="tag tag-accent">
                {b.en || b.ar}
              </span>
            ))}
          </div>
        )}

        <div>
          <span className="section-eyebrow">Title</span>
          <LocalePair ar={props.title.ar} en={props.title.en} size="display" />
        </div>

        {props.headline && (
          <div>
            <span className="section-eyebrow">Headline</span>
            <LocalePair ar={props.headline.ar} en={props.headline.en} size="lg" />
          </div>
        )}

        {props.subheadline && (
          <div>
            <span className="section-eyebrow">Subheadline</span>
            <LocalePair ar={props.subheadline.ar} en={props.subheadline.en} />
          </div>
        )}

        {props.price && (
          <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
              {props.price.display}
            </span>
            {props.compareAtPrice && (
              <span style={{ color: "var(--text-faint)", textDecoration: "line-through" }}>
                {props.compareAtPrice.display}
              </span>
            )}
            <span className="text-faint" style={{ fontSize: 11, letterSpacing: 0.16, textTransform: "uppercase" }}>
              priceHint
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
