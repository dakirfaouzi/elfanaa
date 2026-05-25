/**
 * Operator-header metadata chip — a 10/uppercase eyebrow label paired
 * with inline content (usually a `<code className="code">…</code>`).
 *
 * # Why this lives in `_components/`
 *
 * Introduced inline on the drafts-detail page in C2 to give the
 * builder header a coherent slug / id rhythm. C3 extends the same
 * pattern to the products detail + preview headers so the entire
 * operator flow reads as one surface.
 *
 * Kept as a pure presentation component:
 *   • no client-side state — safe to render from server components,
 *   • no prop transformations — the caller owns its content,
 *   • additive surface — accepts an arbitrary React child so future
 *     callers can drop chips, links, or relative-time pills inside
 *     without changing the API.
 */
export function MetaChip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </span>
  );
}
