import type { GalleryProps } from "@/lib/studio/preview-props";
import { PreviewImage } from "./PreviewImage";

export function Gallery({ props }: { props: GalleryProps }) {
  return (
    <section className="section-card">
      <span className="section-eyebrow">Gallery</span>
      <h2>Images ({props.images.length})</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {props.images.map((img, i) => (
          <div key={`${img.src}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <PreviewImage
              src={img.resolvedSrc}
              rawSrc={img.src}
              alt={img.alt}
              placeholder={img.placeholder}
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
              <span className="tag" style={{ background: "transparent" }}>
                {img.isHero ? "hero" : `gallery ${i}`}
              </span>
              {img.width && img.height && (
                <span className="text-faint" style={{ fontSize: 11 }}>
                  {img.width}×{img.height}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {props.lifestyle && props.lifestyle.length > 0 && (
        <>
          <span className="section-eyebrow" style={{ marginTop: 16 }}>
            Lifestyle ({props.lifestyle.length})
          </span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {props.lifestyle.map((img, i) => (
              <PreviewImage
                key={`${img.src}-${i}`}
                src={img.resolvedSrc}
                rawSrc={img.src}
                alt={img.alt}
                placeholder={img.placeholder}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
