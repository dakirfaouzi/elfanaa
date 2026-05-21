/**
 * @platform/worker/provider-wiring — barrel.
 *
 * Two surfaces:
 *
 *   • `resolveProvidersForStore` — M4 registry → ResolvedProviders bundle.
 *   • `wrap*WithCost` decorators  — used by the orchestrator to tag
 *                                    provider calls with stage names
 *                                    and append CostRows to a buffer.
 */
export {
  resolveProvidersForStore,
  type ResolvedProviders,
} from "./resolve-providers";
export {
  wrapEmbeddingWithCost,
  wrapImageWithCost,
  wrapScraperWithCost,
  wrapTextWithCost,
  wrapVisionWithCost,
  type CostRecorderOptions,
} from "./cost-recorder";
