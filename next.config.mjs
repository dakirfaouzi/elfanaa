/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `standalone` produces a self-contained `.next/standalone` directory
  // that ships only the runtime files needed in production. The Dockerfile
  // copies that bundle into a slim node image — final image weighs in
  // around 180 MB, suitable for EasyPanel's per-app limits.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
