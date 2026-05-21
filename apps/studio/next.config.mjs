import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
};

export default nextConfig;
