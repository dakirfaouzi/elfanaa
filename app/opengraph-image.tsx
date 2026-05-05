import { ImageResponse } from "next/og";
import { siteConfig } from "@/data/site";

export const runtime = "edge";
export const alt = "فناء — أصلك يطلع من جوّاك";
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";

/**
 * Open Graph card — the brand surface that travels.
 *
 * Rendered on the edge by Next.js so it stays fast and always reflects
 * the current `siteConfig`. Composition mirrors the master logo:
 *   1. Beauty mark (serum dewdrop in a circle) at the top
 *   2. "فناء" wordmark — the dominant moment
 *   3. Hairline flourish with rose-copper centre dot
 *   4. Tagline in rose copper: "أصلك يطلع من جوّاك"
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
  const alabaster = "#FDFAF9";
  const ink = "#161212";
  const roseCopper = "#BA6E5C";

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
          backgroundColor: alabaster,
          backgroundImage: `radial-gradient(circle at 50% 38%, rgba(186,110,92,0.06), transparent 60%)`,
          padding: "80px",
        }}
      >
        {/* Beauty mark — serum dewdrop within a containment circle */}
        <svg
          viewBox="0 0 32 32"
          width={140}
          height={140}
          fill="none"
          stroke={roseCopper}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="16" cy="16" r="12.5" />
          <path d="M16 7.5C13.5 11 11.8 13.6 11.8 16.4C11.8 18.7 13.7 20.6 16 20.6C18.3 20.6 20.2 18.7 20.2 16.4C20.2 13.6 18.5 11 16 7.5Z" />
        </svg>

        <div
          style={{
            marginTop: 36,
            color: ink,
            fontSize: 168,
            fontFamily: "serif",
            fontWeight: 700,
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
        >
          {wordmark}
        </div>

        {/* Minimal flourish: hairline + single rose-copper dot */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 28,
          }}
        >
          <div style={{ width: 130, height: 1, background: roseCopper }} />
          <div
            style={{
              width: 8,
              height: 8,
              background: roseCopper,
              borderRadius: 999,
            }}
          />
          <div style={{ width: 130, height: 1, background: roseCopper }} />
        </div>

        <div
          style={{
            marginTop: 28,
            color: roseCopper,
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
