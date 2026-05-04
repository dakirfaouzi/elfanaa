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
        accent: "rgb(var(--color-accent) / <alpha-value>)",
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
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 15, 15, 0.04), 0 4px 16px rgba(15, 15, 15, 0.06)",
        elevated:
          "0 4px 12px rgba(15, 15, 15, 0.08), 0 16px 40px rgba(15, 15, 15, 0.10)",
        focus: "0 0 0 3px rgb(var(--color-brand) / 0.25)",
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
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "scale-in": "scale-in 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-in-end": "slide-in-end 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
