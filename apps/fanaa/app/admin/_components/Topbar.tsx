"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { DateRangePicker } from "./DateRangePicker";
import { RefreshControl } from "./RefreshControl";
import { ThemeToggle } from "./ThemeToggle";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/admin": { title: "Overview", subtitle: "Performance dashboard" },
  "/admin/orders": { title: "Orders", subtitle: "Customer order ledger" },
  "/admin/funnel": { title: "Funnel", subtitle: "Conversion behaviour" },
  "/admin/products": { title: "Products", subtitle: "Catalogue analytics" },
  "/admin/catalog": { title: "Catalog", subtitle: "Product inventory" },
  "/admin/geo": { title: "Geo intelligence", subtitle: "Audience & device" },
  "/admin/traffic": { title: "Traffic quality", subtitle: "Anti-fraud surface" },
  "/admin/settings": { title: "Settings", subtitle: "Diagnostics & schema" },
};

type TopbarProps = {
  onMenuToggle?: () => void;
};

/**
 * Sticky luxury analytics action bar.
 *
 * Two-layer DOM (so the blur/background reach the screen edge while
 * the actual content aligns with the dashboard width):
 *
 *   <header.fa-topbar>            ← full-bleed sticky + safe-area
 *     <div.fa-topbar-inner>       ← max-width 1480px, grid layout
 *       hamburger | title | actions
 *     </div>
 *   </header>
 *
 * Three column slots on desktop (auto / 1fr / auto):
 *   • Hamburger button (mobile only) + page title + subtitle.
 *   • Spacer (1fr).
 *   • Actions: DateRangePicker, RefreshControl, ThemeToggle.
 *
 * On phones (< 640px) the layout flips to two rows:
 *   • Row 1: hamburger + title.
 *   • Row 2: wrapping actions strip (no overflow hijacking).
 * This is handled entirely in CSS — no JS measurement, no resize
 * listeners.
 *
 * No business logic, no fetches.  Refresh is wired through
 * `RefreshControl` → `useAdminPrefs()` → SWR's global `mutate`.
 */
export function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname = usePathname() ?? "/admin";
  const meta = TITLES[pathname] ?? {
    title: "Admin",
    subtitle: "Fanaa operating system",
  };

  return (
    <header className="fa-topbar" role="banner">
      <div className="fa-topbar-inner">
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

        <div className="fa-topbar-actions">
          <DateRangePicker />
          <RefreshControl />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
