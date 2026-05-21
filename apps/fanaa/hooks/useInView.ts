"use client";

import { useEffect, useRef, useState } from "react";

type Options = {
  /**
   * Fraction of the element visible before triggering.
   * Lower = reveals earlier as the element enters the viewport.
   */
  threshold?: number;
  /**
   * Shrinks the effective viewport so the trigger fires before the element
   * fully enters the screen — creates a more generous "just before scroll"
   * reveal that feels smooth rather than reactive.
   */
  rootMargin?: string;
  /** Fire once and disconnect the observer (default: true). */
  once?: boolean;
};

/**
 * Lightweight Intersection Observer hook for scroll-triggered reveals.
 *
 * Design principles:
 *   - Disconnects after first trigger (once=true default) — no waste.
 *   - Respects prefers-reduced-motion — sets inView=true immediately
 *     so the element is visible without any animation.
 *   - GPU-safe: intended for use with opacity + transform only.
 *
 * Usage:
 *   const { ref, inView } = useInView();
 *   <section ref={ref as RefObject<HTMLElement>} className={cn("reveal", inView && "in-view")}>
 */
export function useInView({
  threshold = 0.1,
  rootMargin = "0px 0px -48px 0px",
  once = true,
}: Options = {}) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect OS-level reduced-motion preference — skip animation entirely.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, inView };
}
