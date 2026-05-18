/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `standalone` produces a self-contained `.next/standalone` directory
  // that ships only the runtime files needed in production. The Dockerfile
  // copies that bundle into a slim node image — final image weighs in
  // around 180 MB, suitable for EasyPanel's per-app limits.
  output: "standalone",
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
};

export default nextConfig;
