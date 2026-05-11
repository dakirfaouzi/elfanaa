"use client";

import { useId, useState } from "react";
import { IconPlus } from "./Icons";

interface FAQItemProps {
  q: string;
  a: string;
  /** Hide the bottom hairline when this is the last item in the list. */
  isLast?: boolean;
}

/**
 * Luxury FAQ accordion item.
 *
 * – Native `<button>` trigger (full keyboard + a11y, aria-expanded).
 * – Smooth open/close animation via the modern CSS grid `0fr → 1fr`
 *   trick (see sugarbear.css → `.sb-acc-body`). No JS height
 *   measurement, no jank, animates both directions cleanly.
 * – Plus icon rotates 45° to read as `×` on open (CSS).
 * – Hairline gold separator between items, never a hard border.
 */
export function FAQItem({ q, a, isLast = false }: FAQItemProps) {
  const reactId = useId();
  const [open, setOpen] = useState(false);
  const panelId = `sb-acc-panel-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div
      style={{
        borderBottom: isLast
          ? "none"
          : "1px solid rgba(184, 153, 104, 0.18)",
      }}
    >
      <button
        type="button"
        id={`${panelId}-trigger`}
        className="sb-acc-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "clamp(20px, 2.4vw, 26px) clamp(20px, 2.4vw, 28px)",
          background: "transparent",
          border: "none",
          textAlign: "start",
          cursor: "pointer",
          fontFamily: "var(--font-sb-display), serif",
          fontSize: "clamp(16.5px, 1.6vw, 20px)",
          fontWeight: 600,
          lineHeight: 1.4,
          letterSpacing: "-0.005em",
          color: "var(--sb-ink)",
          // The trigger itself stays calm — no hover background, no
          // ecommerce focus rings. Visible focus is delivered via the
          // soft warm gold outline below.
          outline: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow =
            "inset 0 0 0 2px rgba(184, 153, 104, 0.32)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <span style={{ flex: 1, paddingInlineEnd: 12 }}>{q}</span>
        <span
          aria-hidden
          className="sb-acc-icon"
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--sb-gold-deep)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 100%), " +
              "rgba(255, 252, 244, 0.55)",
            boxShadow: "0 0 0 1px rgba(184, 153, 104, 0.28) inset",
          }}
        >
          <IconPlus size={14} />
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        className="sb-acc-body"
        data-open={open}
      >
        <div className="sb-acc-body-inner">
          <p
            style={{
              margin: 0,
              padding:
                "0 clamp(20px, 2.4vw, 28px) clamp(22px, 2.6vw, 28px) clamp(20px, 2.4vw, 28px)",
              paddingInlineEnd: "clamp(56px, 6vw, 72px)",
              fontSize: "clamp(14.5px, 1.25vw, 16px)",
              lineHeight: 1.95,
              color: "var(--sb-charcoal)",
              opacity: 0.82,
              fontWeight: 400,
            }}
          >
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}
