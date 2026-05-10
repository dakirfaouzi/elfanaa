"use client";

import { useEffect, useRef, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  delay?: 0 | 1 | 2 | 3 | 4;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  /** Threshold for visibility (0..1). */
  threshold?: number;
  /** Re-trigger every time it enters viewport. */
  repeat?: boolean;
}

/**
 * IntersectionObserver-based reveal. Adds `.is-visible` to fade + rise.
 * Falls back gracefully when prefers-reduced-motion is set (CSS handles it).
 */
export function Reveal({
  children,
  delay = 0,
  as = "div",
  className,
  threshold = 0.16,
  repeat = false,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (!repeat) obs.disconnect();
        } else if (repeat) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold, repeat]);

  const Tag = as as React.ElementType;
  const cls = `sb-reveal ${visible ? "is-visible" : ""} ${
    delay ? `sb-reveal-d${delay}` : ""
  } ${className ?? ""}`.trim();
  return (
    <Tag ref={ref as React.Ref<HTMLElement>} className={cls}>
      {children}
    </Tag>
  );
}
