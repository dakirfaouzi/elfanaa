import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── basePath (M12) ───────────────────────────────────────────────────────────
// When Studio is mounted under a sub-path of the main domain (e.g.
// `elfanaa.com/studio`) the `NEXT_PUBLIC_STUDIO_BASE_PATH` env var is set
// to `/studio` at build time. Next.js then auto-prefixes <Link>, router
// navigation, static asset URLs and the build manifest.
//
// Empty (default) = legacy "mounted at root" deployment (a dedicated
// subdomain or local dev on :3001). Both layouts share one image.
const rawBasePath = (process.env.NEXT_PUBLIC_STUDIO_BASE_PATH ?? "").trim();
const basePath = rawBasePath.replace(/\/+$/, ""); // strip trailing slash

if (basePath && !basePath.startsWith("/")) {
  throw new Error(
    `NEXT_PUBLIC_STUDIO_BASE_PATH must start with '/' (got "${basePath}")`,
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `standalone` produces a self-contained `.next/standalone` bundle for the
  // Docker runtime. Final image weighs ~150 MB (no Prisma engine, no
  // recharts/swr/zustand — Studio is significantly leaner than fanaa).
  output: "standalone",
  // ── Monorepo standalone-tracing root ───────────────────────────────────────
  // Pin the tracing root to the monorepo root so the standalone bundle
  // resolves pnpm-symlinked workspace deps (currently none for Studio in M2,
  // but ready for M3+ when @platform/{db,catalog-schema,stores,...} land).
  // Without this, Next.js would heuristically pick the nearest lockfile
  // and the trace would be incomplete for monorepo packages.
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  // ── Mounted sub-path ─────────────────────────────────────────────────────
  // `basePath` is set to `undefined` when empty so Next.js falls back to
  // the default "no prefix" behaviour (passing "" trips an assertion).
  basePath: basePath || undefined,
  // Static assets (JS/CSS/images) are loaded relative to `assetPrefix`.
  // Setting it equal to basePath keeps them inside the same sub-path so
  // the storefront's reverse-proxy rule only needs one rewrite entry.
  assetPrefix: basePath || undefined,
  // ── Remote image hosts (Step 4 Phase 4.5) ──────────────────────────────────
  // The Studio preview (`/p/<slug>`) renders generated product images. Most
  // flow through a plain `<img>` (runtime-renderer) or the `/api/studio/media`
  // proxy, but the products-catalog thumbnails and any next/image consumer must
  // be allowed to optimise the durable CDN host. Mirrors fanaa's allowlist so a
  // re-hosted `https://cdn.elfanaa.com/<key>` hero never 400s in the optimizer.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.elfanaa.com" },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
