import { ImageResponse } from "next/og";
import { siteConfig } from "@/data/site";

export const runtime = "edge";
export const alt = "الفناء — تفاصيل تصنع الفخامة";
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";

/**
 * Open Graph card — the brand surface that travels.
 *
 * Rendered on the edge by Next.js so it stays fast and always reflects
 * the current `siteConfig`. The composition mirrors the master logo: the
 * Najdi-arch mark sits centred at the top, "الفناء" beneath it as the
 * dominant moment, the brass flourish, then the tagline.
 *
 * Why no web fonts here: edge runtime can fetch the Amiri WOFF, but the
 * additional cold-start latency outweighs the typographic gain at OG
 * sizes. Serif fallback (`serif`) on iOS / Android / desktop renders the
 * Arabic wordmark in the OS's bundled Naskh face, which is identical
 * enough for sharing previews.
 */
export default async function OpengraphImage() {
  const wordmark = siteConfig.name.ar;
  const tagline = siteConfig.tagline.ar;
  const cream = "#FAF6EE";
  const ink = "#1E1812";
  const brass = "#B4894A";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cream,
          backgroundImage: `radial-gradient(circle at 50% 38%, rgba(180,137,74,0.06), transparent 60%)`,
          padding: "80px",
        }}
      >
        <svg
          viewBox="0 0 32 32"
          width={140}
          height={140}
          fill="none"
          stroke={brass}
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="7" y1="28" x2="11" y2="28" />
          <line x1="21" y1="28" x2="25" y2="28" />
          <path d="M8 28V11.5C8 8.5 12 6 16 4.5C20 6 24 8.5 24 11.5V28" />
          <path d="M10 28V12C10 10 13 8 16 6.5C19 8 22 10 22 12V28" />
          <line x1="13" y1="23.5" x2="19" y2="23.5" />
          <path d="M13.5 23.5C14 25.5 15 26.5 16 26.5C17 26.5 18 25.5 18.5 23.5" />
          <line x1="16" y1="23.5" x2="16" y2="15.5" />
          <path d="M16 21C14.5 20.4 13.4 19.4 13 18C14.5 18.4 15.6 19.4 16 21" />
          <path d="M16 21C17.5 20.4 18.6 19.4 19 18C17.5 18.4 16.4 19.4 16 21" />
          <path d="M16 18C14.6 17.4 13.8 16.2 13.6 14.8C14.9 15.4 15.7 16.4 16 18" />
          <path d="M16 18C17.4 17.4 18.2 16.2 18.4 14.8C17.1 15.4 16.3 16.4 16 18" />
        </svg>

        <div
          style={{
            marginTop: 36,
            color: ink,
            fontSize: 156,
            fontFamily: "serif",
            fontWeight: 700,
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          {wordmark}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 28,
          }}
        >
          <div style={{ width: 120, height: 1, background: brass }} />
          <div
            style={{
              width: 8,
              height: 8,
              background: brass,
              transform: "rotate(45deg)",
            }}
          />
          <div style={{ width: 120, height: 1, background: brass }} />
        </div>

        <div
          style={{
            marginTop: 28,
            color: brass,
            fontSize: 36,
            fontFamily: "serif",
            letterSpacing: "0.02em",
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    { ...size }
  );
}
