"use client";

import { useEffect, useState } from "react";

/**
 * `useBusinessHours` — hydration-safe Riyadh-time business-hours check.
 *
 * Locked to **Asia/Riyadh** regardless of the buyer's device timezone, so a
 * Saudi customer who set their phone to UTC for travel still sees the right
 * "we'll call you in the morning" copy.  The Asia/Riyadh observance is a
 * constant +03:00 with no DST — no edge cases.
 *
 * Why client-only:
 *   The thank-you page is fully client-rendered (`"use client"`), so reading
 *   the current time during render would either (a) cause a hydration
 *   mismatch when the server-side build snapshot ran in a different hour, or
 *   (b) force us to ship the time to the client via SSR.  Both are uglier
 *   than returning `null` on the first render and the real answer one paint
 *   later — which is exactly what this hook does.
 *
 * Window:  09:00 – 21:00 (inclusive open / exclusive close) — matches the
 * confirmation-team roster.  Centralised here so a future ops change is a
 * one-file edit.
 */

const RIYADH_TZ = "Asia/Riyadh";
const OPEN_HOUR = 9; // 09:00
const CLOSE_HOUR = 21; // 21:00 — exclusive

export type BusinessHoursState = {
  /** `true` once the hook has measured Riyadh time (i.e. on the client). */
  ready: boolean;
  /** `true` when the current Riyadh time is in [09:00, 21:00). */
  isWithinHours: boolean;
};

/**
 * Returns the live business-hours state.  Safe to call from any client
 * component — never throws, never reads `window` at SSR time.
 *
 * The state is computed once on mount and refreshed every 5 minutes — enough
 * to flip an open-now banner over without a hot loop.
 */
export function useBusinessHours(): BusinessHoursState {
  const [state, setState] = useState<BusinessHoursState>({
    ready: false,
    isWithinHours: true,
  });

  useEffect(() => {
    const evaluate = () => {
      setState({ ready: true, isWithinHours: isRiyadhWithinHours() });
    };
    evaluate();
    // Re-check every five minutes so the banner copy flips at the next
    // boundary without ever staying stale longer than that.
    const id = window.setInterval(evaluate, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return state;
}

/**
 * Returns the hour-of-day in `Asia/Riyadh` for the current device time,
 * regardless of where the user is.  Implemented via `Intl.DateTimeFormat`
 * so we never have to ship a timezone database.
 */
function isRiyadhWithinHours(now: Date = new Date()): boolean {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: RIYADH_TZ,
      hour: "numeric",
      hour12: false,
    });
    const hour = Number.parseInt(fmt.format(now), 10);
    if (!Number.isFinite(hour)) return true;
    return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
  } catch {
    // If `Intl` is broken (extremely old browser), default to "open" so
    // we keep the "we'll call you in minutes" reassurance copy instead
    // of an awkward "we'll call you tomorrow morning" on a 2pm visit.
    return true;
  }
}
