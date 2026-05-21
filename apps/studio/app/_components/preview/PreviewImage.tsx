/**
 * Image with graceful placeholder fallback.
 *
 * The M5 pipeline emits R2 keys that won't resolve until M9 wires
 * the CDN. The preview-props builder (`resolveImageUrl`) marks
 * unresolved srcs with a `placeholder://` scheme — we render those
 * as a labelled card rather than a broken <img>.
 *
 * Why an explicit placeholder
 *
 *   • Operators learn quickly to distinguish "image was generated and
 *     the URL works" from "image was generated but the asset host
 *     isn't wired yet".
 *   • Avoids invalid HTML (img with `src="placeholder://…"` triggers
 *     a console warning in some browsers).
 */
export function PreviewImage(props: {
  src: string;
  rawSrc: string;
  alt: { ar: string; en: string };
  placeholder: boolean;
}) {
  return (
    <div className="image-frame">
      {props.placeholder ? (
        <PlaceholderBody rawSrc={props.rawSrc} />
      ) : (
        <img
          src={props.src}
          alt={props.alt.en || props.alt.ar || ""}
          loading="lazy"
        />
      )}
    </div>
  );
}

function PlaceholderBody({ rawSrc }: { rawSrc: string }) {
  return (
    <div className="image-placeholder">
      <span aria-hidden style={{ fontSize: 22 }}>
        ◇
      </span>
      <span>asset pending</span>
      <span className="ph-key">{rawSrc}</span>
    </div>
  );
}
