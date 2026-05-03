"use client";

import type { ReactNode } from "react";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { UIProvider } from "@/components/providers/UIProvider";
import { PixelProvider } from "@/components/providers/PixelProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CodCheckoutModal } from "@/components/checkout/CodCheckoutModal";
import { MobileNav } from "@/components/layout/MobileNav";
import { MobileStickyCTA } from "@/components/layout/MobileStickyCTA";
import { DEFAULT_LOCALE } from "@/lib/i18n";

/**
 * App-wide client tree. Mounted once at the root so:
 *   • the cart drawer, checkout modal, and sticky mobile CTA exist on every page
 *   • locale + UI state are shared across server-rendered pages
 *   • Meta / TikTok / Snapchat pixels boot on first interaction (PixelProvider)
 *
 * Server Components above this provider stay zero-JS; client interactivity
 * only ships from this boundary down.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider initialLocale={DEFAULT_LOCALE}>
      <UIProvider>
        <PixelProvider />
        {children}
        <MobileNav />
        <CartDrawer />
        <CodCheckoutModal />
        <MobileStickyCTA />
      </UIProvider>
    </LocaleProvider>
  );
}
