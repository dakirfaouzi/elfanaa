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
 * Three column slots on desktop (auto / 1fr / auto):
 *   • Hamburger button (mobile only) + page title + subtitle.
 *   • Spacer (1fr).
 *   • Actions: DateRangePicker, RefreshControl, ThemeToggle.
 *
 * On phones (< 640px) the layout flips to two rows:
 *   • Row 1: hamburger + title.
 *   • Row 2: horizontally scrolling actions strip.
 * This is handled entirely in CSS (`@media (max-width: 640px)` rules
 * in `admin.css`) — no JS measurement, no resize listeners.
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
    </header>
  );
}
