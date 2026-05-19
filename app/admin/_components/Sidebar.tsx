"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  GitBranch,
  Boxes,
  Globe2,
  ShieldAlert,
  Settings,
  LogOut,
  X,
} from "lucide-react";

const NAV = [
  { section: "Analytics" },
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/funnel", label: "Funnel", icon: GitBranch },
  { href: "/admin/products", label: "Products", icon: Boxes },
  { href: "/admin/geo", label: "Geo", icon: Globe2 },
  { href: "/admin/traffic", label: "Traffic Quality", icon: ShieldAlert },
  { section: "System" },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

type SidebarProps = {
  /**
   * Called when the user explicitly closes the mobile drawer (close
   * button or backdrop tap). On desktop this is a no-op because the
   * sidebar is permanently mounted.
   */
  onMobileClose?: () => void;
};

/**
 * Premium floating navigation.
 *
 * Desktop: persistent sticky left column (264 px).
 * Mobile (< 1024 px): same markup, but `admin.css` slides it in as a
 * drawer when `<html>` has `.fa-mobile-open`. The `Sidebar` itself
 * doesn't know whether it's docked or floating — that's all CSS —
 * which keeps this file as a thin nav declaration.
 */
export function Sidebar({ onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (!pathname) return false;
    return exact ? pathname === href : pathname.startsWith(href);
  };

  return (
    <aside className="fa-sidebar" aria-label="Admin navigation">
      <div className="fa-brand">
        <div className="fa-brand-mark" aria-hidden />
        <div className="fa-brand-text">
          <strong>Fanaa</strong>
          <span>Operating system</span>
        </div>
        <button
          type="button"
          className="fa-sidebar-close"
          aria-label="Close navigation"
          onClick={onMobileClose}
        >
          <X size={18} />
        </button>
      </div>

      <nav className="fa-nav">
        {NAV.map((item, i) =>
          "section" in item ? (
            <div key={`s-${i}`} className="fa-nav-section">
              {item.section}
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className="fa-nav-item"
              data-active={
                isActive(item.href, "exact" in item ? item.exact : undefined)
                  ? "true"
                  : "false"
              }
            >
              <item.icon />
              {item.label}
            </Link>
          )
        )}
      </nav>

      <div className="fa-nav-foot">
        <form action="/api/admin/auth/logout" method="POST">
          <button
            type="submit"
            className="fa-nav-item"
            style={{
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: "1px solid transparent",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            <LogOut />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
