import type {
  UniversalProduct,
  PublisherId,
  StoreId,
  BeautyWellnessExtension,
  FanaaProductExtension,
} from "@platform/catalog-schema";
import type { StoreConfig } from "@platform/stores";

/**
 * Publisher contract — PLATFORM.md §10.
 *
 * # Responsibilities
 *
 *   1. **Validate** a UniversalProduct against the store's expectations
 *      (schema, taxonomy, image counts, locale coverage).
 *   2. **Publish** it: materialise the UniversalProduct into the store's
 *      native shape and persist it where the store reads from.
 *   3. **Unpublish** an already-live product.
 *   4. **Preview** an in-memory render in the store's chrome.
 *
 * # M7 surface
 *
 *   • `validate` — required, implemented end-to-end for FanaaPublisher.
 *   • `publish`  — required, file-backed in M7
 *                  (`.platform-data/products/<storeId>/<id>.json`).
 *   • `unpublish` / `preview` — optional. FanaaPublisher exposes them
 *      as deferred stubs that return a structured `not_implemented_M7`
 *      result. M8 (Studio UI) wires `preview`; M9 (E2E happy-path)
 *      wires the Octokit PR writer behind `publish` and adds `unpublish`.
 *
 * # Why a contract instead of a free function
 *
 * Future publishers (`ShopifyPublisher`, `TikTokShopPublisher`,
 * `MetaCatalogPublisher`) have wildly different mechanics — REST, GraphQL,
 * Git PR, catalog feed — but the Studio orchestrates them the same way.
 * The contract is the seam.
 */
export interface Publisher {
  /** Stable identifier — matches `StoreConfig.publisher`. */
  readonly id: PublisherId;

  /**
   * Pre-flight validation. Cheap, deterministic, no IO.
   * Called by the Studio before showing a "Publish" button.
   */
  validate(input: PublishInput): Promise<ValidationResult>;

  /**
   * Materialise + persist. The store's specifics (where does the
   * live product live?) are entirely encapsulated here.
   *
   * Replay-safe: publishing the SAME (universalProduct, storeConfig)
   * twice produces the SAME persisted artefact (byte-identical for
   * FanaaPublisher, idempotent commit for Octokit-backed publishers).
   */
  publish(input: PublishInput): Promise<PublishResult>;

  /**
   * Optional — remove or hide a previously-published product.
   * FanaaPublisher M7 returns `not_implemented_M7`; M9 wires it.
   */
  unpublish?(input: UnpublishInput): Promise<UnpublishResult>;

  /**
   * Optional — render a preview against the store's chrome.
   * FanaaPublisher M7 returns `not_implemented_M7`; M8 wires it
   * to a Studio-internal route that mounts the apps/fanaa PDP tree
   * in memory.
   */
  preview?(input: PublishInput): Promise<PreviewResult>;
}

/* ─── I/O shapes ────────────────────────────────────────────────────────── */

/**
 * Publisher input — the assembled pipeline output bundle.
 *
 * The orchestrator (M6) passes:
 *   • `universalProduct`   — the M5 assemble stage output
 *   • `storeConfig`        — resolved from `job.storeId`
 *   • `beautyWellness`     — niche extension (optional override)
 *   • `runId`              — Inngest/queue run ID, for provenance
 *   • `actor`              — operator email for audit
 */
export interface PublishInput {
  universalProduct: UniversalProduct;
  storeConfig: StoreConfig;
  /**
   * Optional pre-computed niche extension. When omitted AND
   * `storeConfig.niche === "beauty_wellness"`, FanaaPublisher infers
   * a `BeautyWellnessExtension` heuristically from the
   * `UniversalProduct` content (benefits text + ingredients).
   */
  beautyWellness?: BeautyWellnessExtension;
  /** Inngest/queue run ID. Stored on the published bundle for provenance. */
  runId?: string;
  /** Operator email — surfaced in audit logs / future Git PR commit author. */
  actor?: string;
  /**
   * Optional Fanaa extension override. When provided, FanaaPublisher
   * uses these values verbatim INSTEAD of deriving them (used by tests
   * + the "republish with edits" flow). Unknown fields trigger validation.
   */
  fanaaExtensionOverride?: Partial<FanaaProductExtension>;
}

/**
 * Pre-flight validation result. Non-throwing — the Studio surfaces
 * errors + warnings to the operator and gates the Publish button on
 * `ok === true`.
 */
export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  /** Stable code — `universal_schema_invalid`, `missing_hero_image`, … */
  code: string;
  /** Human-readable message; safe to surface in the Studio UI. */
  message: string;
  /** Optional dotted path inside the input (e.g. `images[0].alt.ar`). */
  path?: string;
}

/**
 * Publish result discriminated union.
 *
 * • `published`   — artefact persisted, store now knows about it.
 * • `validation`  — pre-flight or post-materialisation validation failed.
 *                   Nothing was persisted. Replayable after the operator
 *                   re-runs the pipeline / re-edits.
 * • `not_implemented_M7` — escape hatch for the optional methods.
 *                          Never returned by `publish()` on a real
 *                          publisher; reserved for `unpublish`/`preview`.
 */
export type PublishResult =
  | PublishedResult
  | ValidationFailedResult;

export interface PublishedResult {
  status: "published";
  storeId: StoreId;
  /** Stable publisher-side identifier (slug for Fanaa, gid for Shopify). */
  storeProductId: string;
  /** Where the artefact ended up (file path for M7, URL for M9+). */
  artefactLocation: string;
  /** Materialised bundle — what was persisted. Returned for the CLI and
   *  for the Studio "show me what we just published" view. */
  bundle: PublishedProductBundle;
  /** ISO-8601 — mirrors `universalProduct.generatedAt` for replay determinism. */
  publishedAt: string;
}

export interface ValidationFailedResult {
  status: "validation_failed";
  storeId: StoreId;
  issues: ValidationIssue[];
}

/**
 * The final published bundle — the "export payload" required by M7.
 *
 * # Why one shape instead of just writing UniversalProduct?
 *
 * Different stores need different sidecar data:
 *   • Fanaa needs `FanaaProductExtension` (offerTiers, SKU, productType,
 *     target, problems, …) — none of which belongs in UniversalProduct.
 *   • Beauty/wellness products need `BeautyWellnessExtension` (skinTypes,
 *     concerns, routine) — niche-specific, not store-specific.
 *
 * The published bundle co-locates them so a downstream reader
 * (apps/fanaa PDP, future Studio preview, future commit-products-ts
 * Octokit script) gets everything it needs from one JSON file.
 */
export interface PublishedProductBundle {
  /** Bundle schema version — bumped when the on-disk shape changes. */
  bundleVersion: 1;
  /** Publisher that produced this bundle. */
  publisher: PublisherId;
  /** Store the bundle was published for. */
  storeId: StoreId;
  /** Inngest/queue run ID — empty string when published from a hand-crafted UP. */
  runId: string;
  /** Operator email; empty when CLI-driven without `--actor`. */
  actor: string;
  /** ISO-8601 — equals `universalProduct.generatedAt` for replay determinism. */
  publishedAt: string;
  /** The canonical UniversalProduct (PLATFORM.md §9). */
  universalProduct: UniversalProduct;
  /** Publisher extension — always present for FanaaPublisher. */
  fanaaExtension?: FanaaProductExtension;
  /** Niche extension — present when `niche === "beauty_wellness"`. */
  beautyWellnessExtension?: BeautyWellnessExtension;
}

/* ─── Unpublish + preview (deferred to M8/M9) ──────────────────────────── */

export interface UnpublishInput {
  storeProductId: string;
  storeConfig: StoreConfig;
  actor?: string;
}

export type UnpublishResult =
  | { status: "unpublished"; storeProductId: string; unpublishedAt: string }
  | { status: "not_implemented_M7"; reason: string };

export type PreviewResult =
  | { status: "ready"; previewLocation: string; expiresAt?: string }
  | { status: "not_implemented_M7"; reason: string };

/* ─── Publisher errors (typed, never thrown across the wire) ───────────── */

/**
 * Discriminated error kind for publisher-level failures. Returned inside
 * `ValidationIssue.code` and on `PublisherError.kind`. Kept exhaustive so
 * the Studio can map each kind to an actionable operator message.
 */
export type PublisherErrorKind =
  | "universal_schema_invalid"
  | "fanaa_extension_invalid"
  | "beauty_wellness_extension_invalid"
  | "store_config_mismatch"
  | "persistence_failed"
  | "deterministic_id_collision"
  | "input_locale_missing"
  | "input_image_missing";

export class PublisherError extends Error {
  override name = "PublisherError";
  constructor(
    public readonly kind: PublisherErrorKind,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}
