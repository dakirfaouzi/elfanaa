import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
        xl: "2.5rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1440px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "serif"],
        arabic: ["var(--font-arabic)", "system-ui", "sans-serif"],
        /**
         * Geometric Arabic display (Reem Kufi) — restrict to the brand
         * wordmark and editorial pull-quotes. Cairo stays the workhorse.
         */
        "arabic-display": ["var(--font-arabic-display)", "var(--font-arabic)", "serif"],
      },
      colors: {
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
          ink: "rgb(var(--color-brand-ink) / <alpha-value>)",
          soft: "rgb(var(--color-brand-soft) / <alpha-value>)",
        },
        // `accent` exposes the full rose-gold ramp so components can use
        // `text-accent-deep` / `bg-accent-soft` instead of reaching for raw
        // `text-[rgb(var(--color-accent-deep))]`. `accent` (DEFAULT) and its
        // alpha variants (`accent/15`, …) are unchanged.
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          deep: "rgb(var(--color-accent-deep) / <alpha-value>)",
          soft: "rgb(var(--color-accent-soft) / <alpha-value>)",
        },
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
        /**
         * Canonical radius convention (Sprint 3.1 — token + docs only; no
         * component migration yet, see PLATFORM.md §26.4.23):
         *   `rounded-card`  → 18px — the single radius for ALL card surfaces
         *                     (product/grid cards already use it via
         *                     `.fn-card-product-frame`; editorial + thank-you
         *                     cards still on `rounded-2xl`/16px will migrate
         *                     to this in a later sprint).
         *   `rounded-photo` → 14px — intentionally tighter, reserved for image
         *                     frames (`.fn-photo-frame`), NOT cards.
         */
        card: "18px",
        photo: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 15, 15, 0.04), 0 4px 16px rgba(15, 15, 15, 0.06)",
        elevated:
          "0 4px 12px rgba(15, 15, 15, 0.08), 0 16px 40px rgba(15, 15, 15, 0.10)",
        focus: "0 0 0 3px rgb(var(--color-brand) / 0.25)",
        // Premium rose-gold-tinted shadow set, sourced from the CSS vars in
        // tokens.css. Previously these `shadow-luxury-*` utilities did not
        // exist, so classes already in the markup (thank-you + policy cards)
        // silently rendered no shadow — wiring them here restores the intended
        // depth. See PLATFORM.md §26.4.23.
        "luxury-sm": "var(--shadow-luxury-sm)",
        "luxury-md": "var(--shadow-luxury-md)",
        "luxury-lg": "var(--shadow-luxury-lg)",
        "luxury-gold": "var(--shadow-luxury-gold)",
      },
      /**
       * Typography scale (Sprint 3.1 — ADDITIVE only; nothing consumes these
       * yet, so there is zero visual change. Names are deliberately chosen to
       * NOT shadow Tailwind's stock scale (`text-sm`, `text-lg`, …). These
       * codify the existing editorial rungs — e.g. `text-title` mirrors
       * `.fn-section-title` and `text-lede` mirrors `.fn-section-lede` — so
       * later sprints can adopt tokens instead of hand-rolled clamps.).
       */
      fontSize: {
        eyebrow: ["12px", { lineHeight: "1.4", letterSpacing: "0.18em" }],
        caption: ["13px", { lineHeight: "1.5" }],
        body: ["16px", { lineHeight: "1.7" }],
        lede: ["clamp(14px, 3.6vw, 17px)", { lineHeight: "1.75" }],
        subtitle: ["clamp(18px, 4.2vw, 22px)", { lineHeight: "1.4" }],
        title: ["clamp(28px, 6.4vw, 56px)", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        display: ["clamp(36px, 8vw, 72px)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
      },
      /**
       * Spacing rhythm (Sprint 3.1 — ADDITIVE only; no migration). Provides a
       * documented section/stack scale (e.g. `py-section`, `gap-stack`) for
       * later adoption; `.fn-section-y` keeps owning live section padding for
       * now. Extends Tailwind's spacing (defaults like `p-4` are untouched).
       */
      spacing: {
        "section": "clamp(72px, 12vw, 120px)",
        "section-compact": "clamp(48px, 8vw, 80px)",
        "stack": "clamp(16px, 4vw, 24px)",
        "stack-lg": "clamp(24px, 6vw, 40px)",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-end": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // ── Premium motion keyframes ────────────────────────────────
        // Slow, deliberate upward reveal — hero content, editorial headers
        rise: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        // Lighter rise — section reveals, grid items, secondary content
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        // Mega menu panel entrance — subtle downward pop
        "mega-in": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        // Column stagger inside mega menu
        "col-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in":       "fade-in 200ms ease-out",
        "scale-in":      "scale-in 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-in-end":  "slide-in-end 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        shimmer:         "shimmer 1.6s linear infinite",
        // Premium motion — all use ease-premium with fill-mode both
        rise:            "rise 900ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-up":       "fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "mega-in":       "mega-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "col-in":        "col-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
