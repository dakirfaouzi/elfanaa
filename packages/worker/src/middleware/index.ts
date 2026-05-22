/**
 * @platform/worker/middleware — barrel.
 *
 * Public middleware surface for the orchestrator's `onStepRecorded`
 * hook. M9 ships `withCostCeiling`; M10 adds idempotency-key
 * deduplication + content-addressed step caching.
 */
export {
  withCostCeiling,
  type WithCostCeilingOptions,
} from "./with-cost-ceiling";
