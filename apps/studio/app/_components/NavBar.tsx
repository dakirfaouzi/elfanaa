import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import {
  getBuildShaShort,
  getBuildShaUrl,
} from "@/lib/studio/build-info";

/**
 * Top navigation bar shared across every gated Studio page.
 *
 * Server component — receives the active route path so each tab knows
 * whether it's the current page (drives `aria-current`).
 *
 * Why a custom NavBar instead of a tab component from a library?
 *
 *   • Studio runs entirely server-side; we want zero client JS for
 *     navigation. A `<nav>` of `<Link>`s is the smallest possible
 *     surface that meets the brief.
 *   • The Studio palette differs from the storefront (it's an internal
 *     dark UI), so reusing apps/fanaa primitives would force colour
 *     inversions everywhere — better to ship a tiny dedicated NavBar.
 */
export function NavBar(props: {
  active: "products" | "runs" | "intake" | "drafts" | "assets" | "home";
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(12px)",
        background: "color-mix(in oklab, var(--bg) 85%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "12px clamp(16px, 4vw, 32px)",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "var(--text)",
          }}
        >
          <BrandMark />
          <span style={{ fontWeight: 600, letterSpacing: 0.1 }}>Fanaa Studio</span>
        </Link>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginLeft: 16,
            flex: 1,
          }}
        >
          {/* C4 — Home tab routes to `/`, which now serves the operator
              dashboard (previously a redirect to /drafts). The brand
              link in the header also points to `/` so operators have
              two affordances back to the overview. */}
          <NavLink href="/" label="Home" active={props.active === "home"} />
          <NavLink href="/intake" label="Intake" active={props.active === "intake"} />
          <NavLink href="/drafts" label="Drafts" active={props.active === "drafts"} />
          <NavLink href="/assets" label="Assets" active={props.active === "assets"} />
          <NavLink href="/products" label="Products" active={props.active === "products"} />
          <NavLink href="/runs" label="Runs" active={props.active === "runs"} />
        </nav>

        <BuildShaPill />
        <LogoutButton />
      </div>
    </header>
  );
}

/**
 * Tiny monospace pill showing the deploy's git SHA. Reads at server
 * render time from `STUDIO_BUILD_SHA` (baked at docker build); falls
 * back to "dev" when unset. Clicking jumps to the GitHub commit so
 * operators can verify "is this deploy actually the latest source?"
 * at a glance — the diagnostic gap that produced the Phase B
 * stale-deploy investigation.
 */
function BuildShaPill() {
  const short = getBuildShaShort();
  const url = getBuildShaUrl();
  const isDev = short === "dev";
  const pillStyle = {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 10.5,
    padding: "3px 8px",
    borderRadius: 999,
    border: `1px solid ${isDev ? "color-mix(in oklab, var(--danger) 40%, var(--border))" : "var(--border)"}`,
    color: isDev ? "var(--danger)" : "var(--text-dim)",
    background: isDev
      ? "color-mix(in oklab, var(--danger) 8%, transparent)"
      : "color-mix(in oklab, var(--surface) 50%, transparent)",
    letterSpacing: 0.4,
    textDecoration: "none",
    fontWeight: 600,
  } as const;
  if (isDev || !url) {
    return (
      <span
        title="Build SHA not stamped — STUDIO_BUILD_SHA build-arg missing on this image"
        style={pillStyle}
      >
        {short}
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Studio build SHA · click to view commit on GitHub`}
      style={pillStyle}
    >
      {short}
    </a>
  );
}

function NavLink(props: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={props.href}
      aria-current={props.active ? "page" : undefined}
      style={{
        fontSize: 13,
        padding: "8px 12px",
        borderRadius: 8,
        color: props.active ? "var(--accent)" : "var(--text-dim)",
        background: props.active
          ? "color-mix(in oklab, var(--accent) 10%, transparent)"
          : "transparent",
        textDecoration: "none",
      }}
    >
      {props.label}
    </Link>
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        width: 32,
        height: 32,
        borderRadius: 8,
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--accent) 60%, transparent) 0%, transparent 70%)",
        border: "1px solid var(--border)",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "ui-serif, Georgia, serif",
        fontSize: 16,
        fontWeight: 600,
        color: "var(--accent)",
      }}
    >
      F
    </span>
  );
}
