import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./admin.css";
import { AdminShell } from "./AdminShell";

export const metadata: Metadata = {
  title: "Fanaa · Admin",
  robots: { index: false, follow: false },
};

/**
 * Inline theme bootstrap script.
 *
 * Why it must be inline & sync
 * ────────────────────────────
 * The admin supports two themes (luxury cream + warm charcoal). When a
 * user reloads `/admin`, React has not yet hydrated, so any client-side
 * `useEffect` that reads `localStorage` and sets the theme will run a
 * few hundred milliseconds *after* first paint — producing a "flash of
 * wrong theme" (FOUC).
 *
 * To eliminate the flash we ship a tiny synchronous IIFE in the
 * `<head>` of the admin layout's HTML stream. It runs before the body
 * paints, reads:
 *   1. `fa-theme` from localStorage (explicit user choice)
 *   2. else `prefers-color-scheme: dark` (system preference)
 *   3. else falls back to `light`
 * …and stamps `data-fa-theme="<theme>"` on `<html>` *before* any pixel
 * of the admin renders. CSS keys off this attribute via
 * `html[data-fa-theme="dark"] .fa-admin { ... }`.
 *
 * Risk profile
 * ────────────
 * The script touches only the document root attribute. It wraps every
 * storage access in try/catch so a corrupt or unavailable
 * localStorage (private browsing, Safari ITP edge cases) is never
 * fatal — the page still loads, just in the light default.
 */
const themeBootstrap = `
(function () {
  try {
    var saved = null;
    try { saved = window.localStorage.getItem('fa-theme'); } catch (e) {}
    var theme = 'light';
    if (saved === 'dark' || saved === 'light') {
      theme = saved;
    } else if (saved === 'system' || saved === null) {
      try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          theme = 'dark';
        }
      } catch (e) {}
    }
    document.documentElement.setAttribute('data-fa-theme', theme);
  } catch (e) {}
})();
`;

/**
 * Admin layout — separate visual universe from the storefront.
 *
 * - The storefront's locale provider, pixels, cart drawer, and sticky
 *   mobile CTA are NOT mounted here (`components/layout/ChromeGate`
 *   excludes `/admin`).
 * - Authentication is enforced by `middleware.ts`; if a request reaches
 *   this layout it's already an authenticated admin (or the
 *   `/admin/login` subpath which renders its own bare shell).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: themeBootstrap }}
      />
      <div className="fa-admin">
        <AdminShell>{children}</AdminShell>
      </div>
    </>
  );
}
