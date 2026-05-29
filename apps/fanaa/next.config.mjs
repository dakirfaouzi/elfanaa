import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `standalone` produces a self-contained `.next/standalone` directory
  // that ships only the runtime files needed in production. The Dockerfile
  // copies that bundle into a slim node image — final image weighs in
  // around 180 MB, suitable for EasyPanel's per-app limits.
  output: "standalone",
  // ── Monorepo standalone-tracing root ───────────────────────────────────────
  // Without this, Next.js heuristically picks the nearest lockfile as the
  // tracing root. In a pnpm workspace where `pnpm-lock.yaml` lives at the
  // monorepo root (two levels up), the tracer would otherwise fail to
  // resolve symlinked workspace deps (`@platform/db`, transitive Prisma
  // engine), producing a broken standalone bundle that ENOENTs at first DB
  // hit. Pin the tracing root explicitly to the monorepo root so the
  // bundle picks up apps/fanaa/* + packages/db/* + all hoisted deps
  // correctly. Output layout inside .next/standalone/ becomes:
  //   ./apps/fanaa/server.js            ← actual entrypoint
  //   ./apps/fanaa/node_modules/...
  //   ./node_modules/...                ← hoisted shared deps
  // The runtime Dockerfile CMD reflects this: `node apps/fanaa/server.js`.
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  // Force the Vercel NFT tracer (used by `output: "standalone"`) to bundle
  // the Prisma generated client alongside any admin / tracking route that
  // imports it. NFT statically traces `require()` graphs but cannot follow
  // Prisma's runtime `require()` of `./libquery_engine-<platform>.so.node`,
  // so without this the standalone bundle ships a broken `@prisma/client`
  // and the first DB hit blows up. The Dockerfile copies the same paths
  // explicitly as a belt — this is the suspenders.
  outputFileTracingIncludes: {
    "/admin/**/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
    ],
    "/api/admin/**/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
    ],
    "/api/track/**/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
    /*
     * Allow the Image Optimization API to serve `.svg` sources.
     *
     * NOTE (Phase 2.4.3): The storefront placeholder is now an
     * inline `data:image/svg+xml` URL (`lib/product-image.ts`), and
     * next/image auto-bypasses the optimizer for `data:` srcs — so
     * the placeholder no longer DEPENDS on this flag. We keep
     * `dangerouslyAllowSVG: true` as defense-in-depth in case a
     * future product surface ever references `.svg` via a file path
     * (legacy `/placeholder-product.svg` fallback links, marketing
     * vector assets, etc.) and to avoid silent 400s from
     * `/_next/image` that would otherwise leave the tile blank.
     *
     * SECURITY: The `dangerously` prefix exists because SVGs can carry
     * scripts. We mitigate by:
     *   • Pairing with an inline `contentSecurityPolicy` that disallows
     *     all script execution and sandboxes the rendered SVG.
     *   • Never serving user-uploaded SVGs (product photography is
     *     either a snapshot CDN URL or in-repo files).
     */
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  /*
   * Canonical product-URL collapse.
   *
   * Some SKUs ship a bespoke landing page (hero, ritual, sticky CTA, …)
   * outside the generic `/products/[slug]` template. We want EXACTLY one
   * canonical URL per product so:
   *   • Ad traffic, organic traffic, menu clicks and "related products"
   *     all land on the same page → consistent UX, consistent analytics.
   *   • Search engines see a single URL → no duplicate-content penalty,
   *     all backlink equity collected on the canonical route.
   *
   * `permanent: true` emits a 308 (preserves method + body) at the edge
   * before any Next.js rendering runs — the cheapest possible redirect.
   *
   * Pattern for future products with a bespoke landing page:
   *   1. Set `landingPath: "/<route>"` on the product in data/products.ts
   *   2. Add a matching entry below.
   * The runtime `permanentRedirect()` inside app/products/[slug]/page.tsx
   * is a safety net — this static rule is the production source of truth.
   */
  async redirects() {
    return [
      {
        source: "/products/sugarbear-hair",
        destination: "/sugarbear",
        permanent: true,
      },
    ];
  },
  /*
   * Studio reverse-proxy mount (M12).
   *
   * When `STUDIO_INTERNAL_URL` is set (e.g. `http://elfanaa_studio:3000` on
   * the docker network, or `http://studio.internal:3000` on EasyPanel),
   * Next.js rewrites every request to `/studio` and `/studio/*` over to
   * the Studio service. The Studio app is built with
   * `NEXT_PUBLIC_STUDIO_BASE_PATH=/studio`, so its routes already serve
   * under that prefix and no path-stripping is required.
   *
   * When the env var is unset (e.g. operators who route `/studio` directly
   * via Traefik / EasyPanel domain rules), this returns an empty array
   * and the storefront serves its normal 404 for `/studio` — same as
   * pre-M12 behaviour. Storefront business logic is untouched.
   */
  async rewrites() {
    const studioUrl = (process.env.STUDIO_INTERNAL_URL ?? "")
      .trim()
      .replace(/\/+$/, "");
    if (!studioUrl) return [];
    return [
      { source: "/studio", destination: `${studioUrl}/studio` },
      { source: "/studio/:path*", destination: `${studioUrl}/studio/:path*` },
    ];
  },
};

export default nextConfig;
