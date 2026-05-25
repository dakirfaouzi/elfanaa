import Link from "next/link";

/**
 * Empty-state card — used on products / runs / preview pages when the
 * underlying `.platform-data/` folder is empty.
 *
 * Why an empty state instead of redirecting?
 *
 *   • The empty path is the FIRST experience for a fresh checkout.
 *     We need it to surface the next-step guidance ("run the M7 CLI"
 *     / "trigger a worker run") rather than vanish.
 *
 * # C2 — optional `cta`
 *
 * Drafts / runs / products all have a canonical "next action" the
 * operator wants from an empty state. Adding an OPTIONAL `cta` prop
 * lets callers surface a Next.js `<Link>` button below the body
 * without each page re-implementing the same affordance. Backward-
 * compatible — existing consumers that don't pass `cta` render
 * unchanged.
 */
export function EmptyState(props: {
  title: string;
  body: string;
  hint?: { label: string; command: string };
  cta?: { href: string; label: string };
}) {
  return (
    <div className="empty-card">
      <div style={{ fontFamily: "ui-serif, Georgia, serif", fontSize: 20, color: "var(--text)" }}>
        {props.title}
      </div>
      <p style={{ margin: "8px auto 0", maxWidth: 480, lineHeight: 1.55, fontSize: 14 }}>
        {props.body}
      </p>
      {props.cta && (
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
          <Link
            href={props.cta.href}
            className="btn btn-accent"
            style={{ minHeight: 38, fontWeight: 600 }}
          >
            {props.cta.label}
          </Link>
        </div>
      )}
      {props.hint && (
        <div
          style={{
            marginTop: 18,
            display: "inline-flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "flex-start",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: 11, letterSpacing: 0.18, textTransform: "uppercase", color: "var(--text-faint)" }}>
            {props.hint.label}
          </span>
          <code className="code">{props.hint.command}</code>
        </div>
      )}
    </div>
  );
}
