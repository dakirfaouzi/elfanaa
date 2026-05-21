"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type BundleId = "1" | "2" | "3";

interface BundleSpec {
  id: BundleId;
  pieces: number;
  price: number;
  perBottle: number;
  saving: number;
  highlight: boolean;
}

const BUNDLES: Record<BundleId, BundleSpec> = {
  "1": { id: "1", pieces: 1, price: 199, perBottle: 199, saving: 0, highlight: false },
  "2": { id: "2", pieces: 2, price: 279, perBottle: Math.round(279 / 2), saving: 119, highlight: false },
  "3": { id: "3", pieces: 3, price: 349, perBottle: Math.round(349 / 3), saving: 248, highlight: true },
};

interface SugarbearState {
  bundle: BundleId;
  setBundle: (b: BundleId) => void;
  current: BundleSpec;
  bundles: typeof BUNDLES;
}

const Ctx = createContext<SugarbearState | null>(null);

export function SugarbearProvider({ children }: { children: React.ReactNode }) {
  const [bundle, setBundleState] = useState<BundleId>("3");
  const setBundle = useCallback((b: BundleId) => setBundleState(b), []);
  const value = useMemo<SugarbearState>(
    () => ({ bundle, setBundle, current: BUNDLES[bundle], bundles: BUNDLES }),
    [bundle, setBundle]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSugarbear(): SugarbearState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSugarbear must be used inside <SugarbearProvider />");
  return ctx;
}
