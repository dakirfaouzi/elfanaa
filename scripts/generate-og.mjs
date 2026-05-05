/**
 * One-shot OG image generator for fanaa.com.
 *
 * Why this script exists: the dynamic `app/opengraph-image.tsx` route
 * uses `next/og` (satori under the hood), which doesn't support the
 * OpenType lookup tables Arabic shaping requires (lookupType 5,
 * substFormat 3 — chained-context substitution). Every Naskh font hits
 * this limit, including Amiri.
 *
 * Solution: pre-render the OG card *once* as a static PNG via Sharp +
 * libvips, which uses Pango / HarfBuzz under the hood and shapes
 * Arabic correctly. The Amiri TTF is embedded into the SVG as a
 * base64 `@font-face` data URI so the rendering is deterministic,
 * independent of system fonts.
 *
 * Output: `app/opengraph-image.png` — Next.js's file-system convention
 * for static OG images. This wins over any sibling `.tsx` route, so
 * dropping the file here automatically replaces the dynamic generator
 * with the static asset.
 *
 * Run: `node scripts/generate-og.mjs`
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const W = 1200;
const H = 630;
const alabaster = "#FDFAF9";
const ink = "#161212";
const rose = "#BA6E5C";

const wordmark = "فناء";
const tagline = "أصلك يطلع من جوّاك";

// Fonts live under `scripts/fonts/` rather than `public/` so they are not
// served as public assets — they are only needed by this build-time
// generator. The Amiri TTFs are embedded into the SVG as base64
// `@font-face` data URIs so the rendered PNG is fully deterministic.
const [bold, regular] = await Promise.all([
  readFile(path.join(__dirname, "fonts", "Amiri-Bold.ttf")),
  readFile(path.join(__dirname, "fonts", "Amiri-Regular.ttf")),
]);
const boldB64 = bold.toString("base64");
const regB64 = regular.toString("base64");

// Centre points; SVG `text` baselines sit on `y`.
const markSize = 140;
const markX = W / 2 - markSize / 2;
const markY = 96;

const wordmarkY = 405;
const flourishY = 442;
const taglineY = 510;
const flourishLineLen = 130;
const flourishGap = 14;
const flourishDot = 4;
const flourishTotal = flourishLineLen * 2 + flourishGap * 2 + flourishDot * 2;
const flourishX = W / 2 - flourishTotal / 2;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="38%" r="60%">
      <stop offset="0%" stop-color="rgba(186,110,92,0.06)"/>
      <stop offset="100%" stop-color="rgba(186,110,92,0)"/>
    </radialGradient>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'Amiri';
        font-weight: 400;
        font-style: normal;
        src: url("data:font/ttf;base64,${regB64}") format("truetype");
      }
      @font-face {
        font-family: 'Amiri';
        font-weight: 700;
        font-style: normal;
        src: url("data:font/ttf;base64,${boldB64}") format("truetype");
      }
      .wordmark { font-family: 'Amiri', serif; font-weight: 700; font-size: 168px; fill: ${ink}; }
      .tagline  { font-family: 'Amiri', serif; font-weight: 400; font-size: 36px; fill: ${rose}; }
    ]]></style>
  </defs>

  <rect width="100%" height="100%" fill="${alabaster}"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>

  <g transform="translate(${markX} ${markY}) scale(${markSize / 32})"
     fill="none" stroke="${rose}" stroke-width="1.5"
     stroke-linecap="round" stroke-linejoin="round">
    <circle cx="16" cy="16" r="12.5"/>
    <path d="M16 7.5C13.5 11 11.8 13.6 11.8 16.4C11.8 18.7 13.7 20.6 16 20.6C18.3 20.6 20.2 18.7 20.2 16.4C20.2 13.6 18.5 11 16 7.5Z"/>
  </g>

  <text x="${W / 2}" y="${wordmarkY}" text-anchor="middle"
        direction="rtl" class="wordmark">${wordmark}</text>

  <g transform="translate(${flourishX} ${flourishY})">
    <line x1="0" y1="0" x2="${flourishLineLen}" y2="0"
          stroke="${rose}" stroke-width="1"/>
    <circle cx="${flourishLineLen + flourishGap + flourishDot}" cy="0"
            r="${flourishDot}" fill="${rose}"/>
    <line x1="${flourishLineLen + flourishGap * 2 + flourishDot * 2}" y1="0"
          x2="${flourishLineLen * 2 + flourishGap * 2 + flourishDot * 2}" y2="0"
          stroke="${rose}" stroke-width="1"/>
  </g>

  <text x="${W / 2}" y="${taglineY}" text-anchor="middle"
        direction="rtl" class="tagline">${tagline}</text>
</svg>
`;


// Render at 2x density for crisp anti-aliasing, then resize back to the
// OG spec (1200x630) so social platforms cache the canonical dimensions.
const png = await sharp(Buffer.from(svg, "utf8"), { density: 144 })
  .resize(W, H, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toBuffer();

const out = path.join(root, "app", "opengraph-image.png");
await writeFile(out, png);

const meta = await sharp(png).metadata();
console.log("wrote", out);
console.log("  size:", png.length, "bytes");
console.log("  dims:", `${meta.width}x${meta.height}`);
