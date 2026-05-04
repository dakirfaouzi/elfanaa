"use client";

import { useEffect, type ReactNode } from "react";
import { useUI } from "@/hooks/useUI";

/**
 * Mounts global UI side-effects (e.g. body scroll-lock when overlays open).
 * Drawers/modals own their own focus traps; this provider only handles
 * cross-cutting concerns.
 */
export function UIProvider({ children }: { children: ReactNode }) {
  const cartOpen = useUI((s) => s.cartOpen);
  const checkoutOpen = useUI((s) => s.checkoutOpen);
  const mobileNavOpen = useUI((s) => s.mobileNavOpen);

  useEffect(() => {
    const anyOpen = cartOpen || checkoutOpen || mobileNavOpen;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen, checkoutOpen, mobileNavOpen]);

  return <>{children}</>;
}
