import type { CSSProperties } from "react";

/**
 * StatusIcon — one consistent glyph vocabulary for Studio status states.
 *
 * # Why this exists
 *
 * Status across Studio was colour-only (`.tag-*` tones). The UI/UX
 * guideline "colour is not the only indicator" (accessibility) plus the
 * operator's need to scan runs / drafts / products quickly call for a
 * paired SVG glyph. This is the single source of truth for "which glyph
 * is this state?", mirroring `StatusBadge`'s closed colour mapping.
 *
 * # Constraints honoured
 *
 *   • Server-safe — pure SVG, no hooks/client APIs (rendered in server
 *     lists like /drafts and the builder header).
 *   • `currentColor` only — inherits the `.tag-*` tone colour, so it
 *     reuses the existing design-system tokens with zero new colours.
 *   • No emoji icons (Lucide-style stroke paths, 24×24 viewBox).
 */

export type StatusGlyphKind =
  | "published"
  | "draft"
  | "running"
  | "pending"
  | "completed"
  | "error"
  | "warning"
  | "skipped"
  | "info";

const BASE_STYLE: CSSProperties = { flexShrink: 0, display: "block" };

export function StatusIcon({
  kind,
  size = 13,
}: {
  kind: StatusGlyphKind;
  size?: number;
}): React.ReactElement {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    style: BASE_STYLE,
  };

  switch (kind) {
    case "published":
    case "completed":
      // check-circle
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </svg>
      );
    case "draft":
      // pencil
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "running":
      // activity (in-progress)
      return (
        <svg {...common}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case "pending":
      // clock
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "error":
      // x-circle
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </svg>
      );
    case "warning":
      // alert-triangle
      return (
        <svg {...common}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "skipped":
      // skip (minus)
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case "info":
    default:
      // info
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );
  }
}
