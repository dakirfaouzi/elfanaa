"use client";

import { usePathname } from "next/navigation";

/**
 * Prefixes that own their full viewport and must NOT render the
 * storefront chrome (Header / Footer / MobileNav / CartDrawer /
 * AnnouncementBar / sticky-CTA). These pages are either luxury
 * standalone funnels (`/sugarbear`, `/thank-you`) or the admin
 * operating system whose own layout (`app/admin/layout.tsx`) brings
 * its own sidebar + topbar.
 *
 * Why `/admin` matters here: without this exclusion the admin
 * dashboard rendered the public header + mobile nav + cart drawer
 * above its own chrome on every page, which on phones consumed
 * 30–40% of the viewport before the first KPI tile was visible
 * and visually competed with the dark admin sidebar.
 */
const STANDALONE_PREFIXES = ["/sugarbear", "/thank-you", "/admin"];

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isStandalone = STANDALONE_PREFIXES.some((p) => pathname.startsWith(p));
  if (isStandalone) return null;
  return <>{children}</>;
}
