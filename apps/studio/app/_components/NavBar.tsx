import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

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
export function NavBar(props: { active: "products" | "runs" | "home" }) {
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
          <NavLink href="/products" label="Products" active={props.active === "products"} />
          <NavLink href="/runs" label="Runs" active={props.active === "runs"} />
        </nav>

        <LogoutButton />
      </div>
    </header>
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
