"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "./_components/Sidebar";
import { Topbar } from "./_components/Topbar";

/**
 * Shell wrapper. The login page lives outside the chrome — every other
 * /admin/* page gets the sidebar + topbar.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/admin/login";
  if (bare) return <>{children}</>;
  return (
    <div className="fa-shell">
      <Sidebar />
      <div className="fa-main">
        <Topbar />
        <main className="fa-content">{children}</main>
      </div>
    </div>
  );
}
