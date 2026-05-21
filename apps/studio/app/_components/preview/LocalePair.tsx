/**
 * Bilingual copy block — renders Arabic and English side-by-side.
 *
 * # Why both at once
 *
 * The Studio operator is the localisation gatekeeper. Showing both
 * locales next to each other (with the Arabic block in RTL + the
 * correct font) makes copy-quality issues obvious before publish.
 *
 * # Sizing
 *
 *   • `display` — hero title (28–36px)
 *   • `lg`      — section headline (18–22px)
 *   • `md`      — body copy (14–16px)  ← default
 *   • `sm`      — caption / FAQ answer (13px)
 */
type Size = "display" | "lg" | "md" | "sm";

const SIZE: Record<
  Size,
  { fontSize: string; lineHeight: number; weight: number; family?: string; letterSpacing?: number }
> = {
  display: {
    fontSize: "clamp(22px, 2.4vw, 28px)",
    lineHeight: 1.2,
    weight: 600,
    family: "ui-serif, Georgia, serif",
    letterSpacing: -0.3,
  },
  lg: { fontSize: "clamp(16px, 1.6vw, 19px)", lineHeight: 1.35, weight: 600 },
  md: { fontSize: "15px", lineHeight: 1.55, weight: 400 },
  sm: { fontSize: "13px", lineHeight: 1.5, weight: 400 },
};

export function LocalePair(props: {
  ar: string;
  en: string;
  size?: Size;
  showEmpty?: boolean;
}) {
  const size = SIZE[props.size ?? "md"];
  const hasAr = props.ar.trim() !== "";
  const hasEn = props.en.trim() !== "";

  if (!hasAr && !hasEn && !props.showEmpty) return null;

  return (
    <div className="locale-block" style={{ marginTop: 4 }}>
      <Cell label="AR" value={props.ar} dir="rtl" size={size} />
      <Cell label="EN" value={props.en} dir="ltr" size={size} />
    </div>
  );
}

function Cell(props: {
  label: "AR" | "EN";
  value: string;
  dir: "rtl" | "ltr";
  size: (typeof SIZE)[Size];
}) {
  return (
    <div
      className={`locale-cell ${props.label === "AR" ? "ar" : "en"}`}
      dir={props.dir}
    >
      <span className="locale-eyebrow">{props.label}</span>
      <span
        style={{
          fontSize: props.size.fontSize,
          lineHeight: props.size.lineHeight,
          fontWeight: props.size.weight,
          fontFamily: props.label === "AR" ? undefined : props.size.family,
          letterSpacing: props.size.letterSpacing,
          color: props.value.trim() === "" ? "var(--text-faint)" : "var(--text)",
        }}
      >
        {props.value.trim() === "" ? "(empty)" : props.value}
      </span>
    </div>
  );
}
