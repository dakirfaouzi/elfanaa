/**
 * @platform/publishers — package root.
 *
 * M7 surface = publisher contract + FanaaPublisher + file-backed
 * publish store + a small registry. Future milestones extend behind
 * the same interfaces:
 *
 *   • `unpublish` / `preview` (M8 / M9) — already typed; FanaaPublisher
 *     returns `not_implemented_M7` until wired.
 *   • Octokit PR writer (M9) — drops in as an alternative
 *     `PublishStore` implementation; the FanaaPublisher itself
 *     doesn't need to change.
 *   • `ShopifyPublisher`, `TikTokShopPublisher` (M11/M12) — implement
 *     the same `Publisher` contract; registry resolves by id.
 *   • Postgres-backed `PublishStore` (M10) — replaces FilePublishStore
 *     in production; the file-backed one stays for local dev + tests.
 *
 * Preferred import surfaces for callers:
 *
 *   import { FanaaPublisher } from "@platform/publishers/fanaa";
 *   import { PublisherRegistry } from "@platform/publishers/registry";
 *   import { FilePublishStore } from "@platform/publishers/persistence";
 *   import type { PublishedProductBundle, PublishResult } from "@platform/publishers/contracts";
 *
 * This barrel re-exports the most-used items so scripts can import
 * everything from "@platform/publishers" without subpaths.
 */

export type {
  Publisher,
  PublishInput,
  PublishResult,
  PublishedResult,
  ValidationFailedResult,
  PublishedProductBundle,
  PreviewResult,
  UnpublishInput,
  UnpublishResult,
  ValidationResult,
  ValidationIssue,
  PublisherErrorKind,
} from "./contracts";
export { PublisherError } from "./contracts";

export type { FanaaPublisherOptions } from "./fanaa";
export { FanaaPublisher } from "./fanaa";

export type {
  FilePublishStoreOptions,
  PublishStore,
} from "./persistence/file-publish-store";
export { FilePublishStore, stableStringify } from "./persistence/file-publish-store";

export type { PublisherRegistryOptions } from "./registry";
export { PublisherRegistry } from "./registry";

export {
  validateUniversalProductSchema,
  validateFanaaExtensionSchema,
  validateBeautyWellnessExtensionSchema,
  validateLocaleCoverage,
  validateImages,
  validateStoreConsistency,
  validateFullBundle,
} from "./validation";
