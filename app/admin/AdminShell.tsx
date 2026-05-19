"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./_components/Sidebar";
import { Topbar } from "./_components/Topbar";
import { AdminPrefsProvider } from "./_components/AdminPrefs";

/**
 * Admin shell. The login page lives outside the chrome — every other
 * `/admin/*` page gets the sidebar + topbar.
 *
 * Responsibilities owned here (kept thin on purpose):
 *   • Decide whether to mount chrome at all (login = bare).
 *   • Wrap children in `AdminPrefsProvider` so theme + refresh
 *     controls work on every dashboard page.
 *   • Hold the mobile drawer's open state and toggle
 *     `fa-mobile-open` on the wrapping `.fa-admin` so CSS can lock
 *     body scroll and slide the sidebar in.
 *   • Auto-close the drawer on every pathname change so navigation
 *     from inside the drawer feels native (tap nav → drawer closes
 *     → new page shows immediately).
 *   • Close the drawer when the viewport grows back past the desktop
 *     breakpoint so an open mobile drawer never gets stuck on a
 *     desktop resize (rotation, devtools toggle).
 *
 * Auth is enforced upstream by `middleware.ts`; nothing here checks it.
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
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(min-width: 1025px)");
    } catch {
      return;
    }
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const parent = document.querySelector(".fa-admin");
    if (!parent) return;
    if (menuOpen) parent.classList.add("fa-mobile-open");
    else parent.classList.remove("fa-mobile-open");
    return () => parent.classList.remove("fa-mobile-open");
  }, [menuOpen]);

  if (bare) {
    // The login page does not need theme/refresh controls but we
    // still mount the provider so any future linkable state
    // (e.g. honouring system theme on the login screen) just works.
    return <AdminPrefsProvider>{children}</AdminPrefsProvider>;
  }

  return (
    <AdminPrefsProvider>
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
    </AdminPrefsProvider>
  );
}
