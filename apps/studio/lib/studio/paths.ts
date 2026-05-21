import path from "node:path";

/**
 * Resolve the `.platform-data/` root used by the M6 worker
 * (`runs/`) and the M7 FanaaPublisher (`products/`).
 *
 * Defaults to `<repo-root>/.platform-data` so the Studio dev server
 * sees the same files the worker CLI writes. Override per-instance via
 * the `PLATFORM_DATA_ROOT` env var (M8 hosts the Studio behind the
 * same EasyPanel container as the worker would be when M9 lands).
 *
 * Test code injects a temp directory; production code never overrides
 * — the env var is the only seam.
 */
const FALLBACK_ROOT = ".platform-data";

export function platformDataRoot(): string {
  const fromEnv = process.env.PLATFORM_DATA_ROOT;
  if (fromEnv && fromEnv.trim() !== "") {
    return path.resolve(fromEnv);
  }
  return path.resolve(process.cwd(), FALLBACK_ROOT);
}

/** `.platform-data/products/` — written by FanaaPublisher (M7). */
export function productsRoot(): string {
  return path.join(platformDataRoot(), "products");
}

/** `.platform-data/runs/` — written by the M6 worker orchestrator. */
export function runsRoot(): string {
  return path.join(platformDataRoot(), "runs");
}
