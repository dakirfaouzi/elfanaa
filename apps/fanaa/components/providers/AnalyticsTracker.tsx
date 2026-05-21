"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { bootTracker, trackPageView } from "@/lib/track/client";

/**
 * Mount-once tracker that fires a `page_view` event on every client-side
 * navigation. Lives next to <PixelProvider /> in the global provider stack.
 *
 * Safe to ship on every page — handlers swallow their own errors so a
 * misconfigured /api/track endpoint never breaks the storefront.
 *
 * Hidden routes (`/admin/*`) opt out so admin sessions don't pollute the
 * analytics they're observing.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    bootTracker();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/admin")) return;
    const search = params?.toString();
    const path = search ? `${pathname}?${search}` : pathname;
    trackPageView(path);
  }, [pathname, params]);

  return null;
}
