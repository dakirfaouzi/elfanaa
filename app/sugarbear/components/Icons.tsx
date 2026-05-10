/**
 * Hand-tuned line icons for Sugarbear.
 * Stroke-based, 1.5pt weight, rounded caps — never filled glyphs.
 */

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

const baseProps = (size: number, color?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color ?? "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconLeaf = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M5 19c0-7 5-13 14-14-1 9-7 14-14 14z" />
    <path d="M5 19c4-4 7-7 14-14" />
  </svg>
);

export const IconShine = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconCalendar = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

export const IconHeart = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z" />
  </svg>
);

export const IconShield = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const IconTruck = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M3 7h11v9H3zM14 11h4l3 3v2h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z" />
  </svg>
);

export const IconCash = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 9.5h.01M18 14.5h.01" />
  </svg>
);

export const IconCheck = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const IconPlus = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconArrow = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconSparkle = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5L12 4z" />
  </svg>
);

export const IconDroplet = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M12 3s6 6 6 11a6 6 0 11-12 0c0-5 6-11 6-11z" />
  </svg>
);

export const IconQuote = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M7 7c-2 0-3 1.5-3 4v6h6v-6H6c0-2 1-3 3-3V7zM17 7c-2 0-3 1.5-3 4v6h6v-6h-4c0-2 1-3 3-3V7z" />
  </svg>
);

export const IconCrown = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M3 8l4 5 5-7 5 7 4-5-2 11H5L3 8z" />
  </svg>
);

export const IconMinus = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
);

export const IconBag = ({ size = 24, className, color }: IconProps) => (
  <svg {...baseProps(size, color)} className={className} aria-hidden="true">
    <path d="M5 8h14l-1 12H6L5 8z" />
    <path d="M9 8V6a3 3 0 016 0v2" />
  </svg>
);
