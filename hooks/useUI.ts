"use client";

import { create } from "zustand";

/**
 * Single store for transient UI state (drawers, modals). Splitting this from
 * the cart store keeps the cart serialisable & persistable while UI state
 * stays ephemeral.
 *
 * Key UX rule: only ONE primary surface visible at a time.
 *   • Cart drawer and checkout modal are *mutually exclusive*.
 *   • The transition cart → checkout uses a sequenced handoff so the cart
 *     fully slides out before the modal fades in (no flash of both).
 */
type UIState = {
  cartOpen: boolean;
  checkoutOpen: boolean;
  mobileNavOpen: boolean;

  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  openCheckout: () => void;
  closeCheckout: () => void;

  /**
   * Sequenced cart → checkout transition.
   *
   * Closes the cart drawer immediately, waits one drawer-slide-out cycle
   * (~280ms — matches the Tailwind `duration-300 ease-premium`), then opens
   * the checkout modal. This avoids the "both surfaces visible at once"
   * flash that happens when both states change in the same tick.
   */
  goToCheckout: () => void;

  /** Closes every transient surface — used after order success / navigation. */
  closeAll: () => void;

  openMobileNav: () => void;
  closeMobileNav: () => void;
};

const DRAWER_SLIDE_MS = 280;

export const useUI = create<UIState>((set) => ({
  cartOpen: false,
  checkoutOpen: false,
  mobileNavOpen: false,

  openCart: () => set({ cartOpen: true, mobileNavOpen: false }),
  closeCart: () => set({ cartOpen: false }),
  toggleCart: () => set((s) => ({ cartOpen: !s.cartOpen })),

  openCheckout: () => set({ checkoutOpen: true, cartOpen: false }),
  closeCheckout: () => set({ checkoutOpen: false }),

  goToCheckout: () => {
    set({ cartOpen: false });
    if (typeof window !== "undefined") {
      window.setTimeout(() => set({ checkoutOpen: true }), DRAWER_SLIDE_MS);
    } else {
      set({ checkoutOpen: true });
    }
  },

  closeAll: () =>
    set({ cartOpen: false, checkoutOpen: false, mobileNavOpen: false }),

  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
}));
