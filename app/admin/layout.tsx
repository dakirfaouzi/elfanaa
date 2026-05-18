import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./admin.css";
import { AdminShell } from "./AdminShell";

export const metadata: Metadata = {
  title: "Fanaa · Admin",
  robots: { index: false, follow: false },
};

/**
 * Admin layout is intentionally separate from the storefront.
 *
 * The storefront's locale provider, pixels, cart drawer, and sticky mobile
 * CTA are NOT mounted here. The admin is its own UI universe — dark theme,
 * dense typography, no marketing chrome.
 *
 * Authentication is enforced by `middleware.ts`; if a request reaches this
 * layout it's already an authenticated admin (or the /login subpath which
 * renders its own bare shell).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fa-admin">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
