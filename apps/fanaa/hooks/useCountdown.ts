"use client";

import { useEffect, useRef, useState } from "react";

type CountdownOptions = {
  /** Auto-start when the hook mounts (default: true). */
  autoStart?: boolean;
  /** Tick resolution in ms (default: 100ms — smooth progress bars without jank). */
  intervalMs?: number;
  /** Fired exactly once when the timer reaches zero. */
  onExpire?: () => void;
};

type CountdownAPI = {
  /** Whole seconds left (rounded up — UX-friendly). */
  secondsLeft: number;
  /** Continuous progress 1 → 0 — perfect for shrinking bars. */
  progress: number;
  /** True only after the timer has actually expired. */
  expired: boolean;
  /** Manually start (or restart) the countdown from `seconds`. */
  start: () => void;
  /** Pause without resetting elapsed time. */
  pause: () => void;
  /** Reset to full duration without auto-starting. */
  reset: () => void;
};

/**
 * Reusable urgency countdown.
 *
 * Why this exists:
 *   • A naive `setInterval(s, 1000)` ticks 0.5s late on average and looks janky
 *     under a smooth progress bar. We tick at 100ms and round display up.
 *   • `onExpire` is guaranteed to fire **exactly once**, even if the parent
 *     re-renders or React strict-mode double-invokes the effect.
 *   • Pausing/resuming preserves the elapsed time — required for "tab hidden"
 *     pauses we may add later.
 */
export function useCountdown(seconds: number, options: CountdownOptions = {}): CountdownAPI {
  const { autoStart = true, intervalMs = 100, onExpire } = options;
  const totalMs = seconds * 1000;

  const [remainingMs, setRemainingMs] = useState(totalMs);
  const [running, setRunning] = useState(autoStart);
  const startedAtRef = useRef<number | null>(autoStart ? Date.now() : null);
  const pausedAtRef = useRef<number>(0);
  const expiredFiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Keep latest callback without restarting the interval on every render.
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt == null) return;
      const elapsed = Date.now() - startedAt + pausedAtRef.current;
      const next = Math.max(0, totalMs - elapsed);
      setRemainingMs(next);
      if (next === 0) {
        clearInterval(id);
        setRunning(false);
        if (!expiredFiredRef.current) {
          expiredFiredRef.current = true;
          onExpireRef.current?.();
        }
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [running, totalMs, intervalMs]);

  const start = () => {
    expiredFiredRef.current = false;
    pausedAtRef.current = 0;
    startedAtRef.current = Date.now();
    setRemainingMs(totalMs);
    setRunning(true);
  };

  const pause = () => {
    if (!running || startedAtRef.current == null) return;
    pausedAtRef.current += Date.now() - startedAtRef.current;
    startedAtRef.current = null;
    setRunning(false);
  };

  const reset = () => {
    expiredFiredRef.current = false;
    pausedAtRef.current = 0;
    startedAtRef.current = null;
    setRemainingMs(totalMs);
    setRunning(false);
  };

  return {
    secondsLeft: Math.ceil(remainingMs / 1000),
    progress: totalMs === 0 ? 0 : remainingMs / totalMs,
    expired: remainingMs === 0,
    start,
    pause,
    reset,
  };
}
