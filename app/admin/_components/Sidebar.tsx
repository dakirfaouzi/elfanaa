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
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fa-sidebar">
      <div className="fa-brand">
        <div className="fa-brand-mark" />
        <div className="fa-brand-text">
          <strong>Fanaa</strong>
          <span>Operating system</span>
        </div>
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
                item.exact ? pathname === item.href : pathname?.startsWith(item.href) ? "true" : "false"
              }
            >
              <item.icon />
              {item.label}
            </Link>
          )
        )}
      </nav>

      <div style={{ marginTop: "auto" }}>
        <form action="/api/admin/auth/logout" method="POST">
          <button type="submit" className="fa-nav-item" style={{ width: "100%", textAlign: "left", background: "transparent", border: "1px solid transparent", cursor: "pointer", font: "inherit" }}>
            <LogOut />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
