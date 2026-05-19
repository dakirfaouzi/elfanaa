"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./_components/Sidebar";
import { Topbar } from "./_components/Topbar";

/**
 * Admin shell. The login page lives outside the chrome — every other
 * `/admin/*` page gets the sidebar + topbar.
 *
 * Responsibilities owned here (kept thin on purpose):
 *   • Decide whether to mount chrome at all (login = bare).
 *   • Hold the mobile drawer's open state and the `fa-mobile-open`
 *     class on the wrapping `.fa-admin` so CSS can lock body scroll
 *     and slide the sidebar in.
 *   • Auto-close the drawer on every pathname change so navigation
 *     from inside the drawer feels native (tap nav → drawer closes
 *     → new page shows immediately).
 *   • Close the drawer when the viewport grows back past the
 *     desktop breakpoint so an open mobile drawer never gets stuck
 *     on a desktop resize (rotation on a tablet, devtools toggle).
 *
 * No business logic, no fetches.  Auth is enforced upstream by
 * `middleware.ts`.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/admin/login";

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1025px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const parent = html.querySelector(".fa-admin");
    if (!parent) return;
    if (menuOpen) parent.classList.add("fa-mobile-open");
    else parent.classList.remove("fa-mobile-open");
    return () => parent.classList.remove("fa-mobile-open");
  }, [menuOpen]);

  if (bare) return <>{children}</>;

  return (
    <div className="fa-shell">
      <div
        className="fa-sidebar-overlay"
        aria-hidden={!menuOpen}
        onClick={() => setMenuOpen(false)}
      />
      <Sidebar onMobileClose={() => setMenuOpen(false)} />
      <div className="fa-main">
        <Topbar onMenuToggle={() => setMenuOpen((v) => !v)} />
        <main className="fa-content">{children}</main>
      </div>
    </div>
  );
}
