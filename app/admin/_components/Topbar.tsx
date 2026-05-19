"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { DateRangePicker } from "./DateRangePicker";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/admin": {
    title: "Overview",
    subtitle: "Performance dashboard",
  },
  "/admin/orders": {
    title: "Orders",
    subtitle: "Customer order ledger",
  },
  "/admin/funnel": {
    title: "Funnel",
    subtitle: "Conversion behaviour",
  },
  "/admin/products": {
    title: "Products",
    subtitle: "Catalogue analytics",
  },
  "/admin/geo": {
    title: "Geo intelligence",
    subtitle: "Audience & device",
  },
  "/admin/traffic": {
    title: "Traffic quality",
    subtitle: "Anti-fraud surface",
  },
  "/admin/settings": {
    title: "Settings",
    subtitle: "Diagnostics & schema",
  },
};

type TopbarProps = {
  onMenuToggle?: () => void;
};

/**
 * Sticky luxury top bar.
 *
 * Three slots:
 *   • Hamburger (mobile only) — toggles the slide-in sidebar drawer.
 *   • Title + subtitle — luxurious serif title plus a small uppercase
 *     subtitle so each route immediately reads as part of a structured
 *     analytics system, not a generic admin panel.
 *   • Date range picker — the only action that lives in the global
 *     header. Per-page filters stay inside their own page card.
 */
export function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname = usePathname() ?? "/admin";
  const meta = TITLES[pathname] ?? {
    title: "Admin",
    subtitle: "Fanaa operating system",
  };

  return (
    <header className="fa-topbar">
      <button
        type="button"
        className="fa-menu-btn"
        aria-label="Open navigation"
        onClick={onMenuToggle}
      >
        <Menu size={20} />
      </button>

      <div className="fa-topbar-title">
        <h1>{meta.title}</h1>
        <span>{meta.subtitle}</span>
      </div>

      <div className="fa-topbar-right">
        <DateRangePicker />
      </div>
    </header>
  );
}
