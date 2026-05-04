"use client";

import { create } from "zustand";

/**
 * Single store for transient UI state (drawers, modals). Splitting this from
 * the cart store keeps the cart serialisable & persistable while UI state
 * stays ephemeral.
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

  openMobileNav: () => void;
  closeMobileNav: () => void;
};

export const useUI = create<UIState>((set) => ({
  cartOpen: false,
  checkoutOpen: false,
  mobileNavOpen: false,

  openCart: () => set({ cartOpen: true, mobileNavOpen: false }),
  closeCart: () => set({ cartOpen: false }),
  toggleCart: () => set((s) => ({ cartOpen: !s.cartOpen })),

  openCheckout: () => set({ checkoutOpen: true, cartOpen: false }),
  closeCheckout: () => set({ checkoutOpen: false }),

  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
}));
