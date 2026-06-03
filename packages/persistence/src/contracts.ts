/**
 * Persistence-layer contracts.
 *
 * # What this module owns
 *
 *   • A minimal `PrismaLike` interface that exposes ONLY the
 *     methods we call on `PrismaClient`. The persistence layer
 *     accepts any object matching this shape — tests inject mocks
 *     with no Prisma codegen present; production injects the real
 *     `PrismaClient`. This keeps the Prisma dependency soft.
 *   • The `RunStoreOptions` and `DraftSeed` typed inputs to the
 *     PrismaRunStore + draft repository.
 *   • A `PersistenceError` with a stable `kind` so Studio callers
 *     can branch without depending on Prisma's `PrismaClientKnownRequestError`
 *     hierarchy.
 *
 * # What this module does NOT own
 *
 *   • Prisma model shapes — they live in `packages/db/prisma/schema.prisma`.
 *   • Studio runtime — that's `apps/studio/lib/studio/persistence.ts`.
 *   • Wire-format Zod schemas — those live in
 *     `@platform/storage/schemas` and `@platform/ingest`.
 *
 * # Why we re-type Prisma model shapes
 *
 * `@prisma/client` only emits types AFTER `prisma generate` runs.
 * Re-typing the rows we read/write here makes the persistence
 * package's `tsc` step independent of codegen — the package compiles
 * even if `prisma generate` has never been run in the worktree. The
 * mapper layer is the single seam where these mirror types meet the
 * real Prisma rows; everywhere else is mirror-typed.
 */

import type { CostRow, RunRecord, StepRecord } from "@platform/ingest/store";

// ─────────────────────────────────────────────────────────────────────────
// Prisma-shape mirrors
// ─────────────────────────────────────────────────────────────────────────

/** Mirror of the StudioRunStatus Prisma enum. */
export type StudioRunStatusValue =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

/** Mirror of the StudioStepStatus Prisma enum. */
export type StudioStepStatusValue =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

/** Mirror of the StudioDraftStatus Prisma enum. */
export type StudioDraftStatusValue =
  | "intake"
  | "generating"
  | "ready"
  | "publishing"
  | "published"
  | "archived"
  | "failed";

/** Mirror of the StudioAssetSource Prisma enum. */
export type StudioAssetSourceValue = "upload" | "scraped" | "generated";

/** Mirror of the StudioStoreStatus Prisma enum. */
export type StudioStoreStatusValue = "live" | "incubating" | "archived";

/**
 * Mirror of the ProductSourceKind Prisma enum (M12 / Step 2).
 *
 *   • `curated`      — hand-tuned product, lives in
 *                      `apps/fanaa/data/products.ts` for CRO content;
 *                      catalog row holds the commerce metadata.
 *   • `ai_generated` — published from the Studio builder; paired to a
 *                      `StudioPublishedProductRow` via `publishedProductId`.
 */
export type ProductSourceValue = "curated" | "ai_generated";

/** Shape returned by `prisma.studioRun.findUnique` etc. Mirrors the
 *  Prisma model with steps eagerly joined. */
export interface StudioRunRow {
  id: string;
  draftId: string;
  runId: string;
  inngestRunId: string | null;
  status: StudioRunStatusValue;
  costCents: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  inputSnapshot: unknown;
  steps?: StudioStepRow[];
}

export interface StudioStepRow {
  id: string;
  runId: string;
  kind: string;
  status: StudioStepStatusValue;
  providerId: string | null;
  inputHash: string | null;
  attemptCount: number;
  costCents: number;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  errorKind: string | null;
  output: unknown;
}

export interface StudioDraftRow {
  id: string;
  storeId: string;
  slug: string;
  title: string;
  supplierUrl: string | null;
  notes: string | null;
  positioning: string | null;
  status: StudioDraftStatusValue;
  template: string;
  costCents: number;
  publishedAt: Date | null;
  publishedRef: string | null;
  /** M11: normalised DraftDocument JSON. Null until first builder save. */
  payload: unknown | null;
  /** M11: bumps on every persisted payload write. */
  payloadVersion: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudioPublishedProductRow {
  id: string;
  draftId: string;
  storeId: string;
  slug: string;
  version: number;
  isCurrent: boolean;
  document: unknown;
  publishedBy: string;
  publishedAt: Date;
}

export interface StudioAssetRow {
  id: string;
  draftId: string;
  source: StudioAssetSourceValue;
  r2Bucket: string;
  r2Key: string;
  contentType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  altAr: string | null;
  altEn: string | null;
  createdAt: Date;
}

export interface StudioEventRow {
  id: string;
  storeId: string | null;
  draftId: string | null;
  kind: string;
  actor: string;
  payload: unknown;
  createdAt: Date;
}

export interface StudioStoreRow {
  id: string;
  displayName: string;
  status: StudioStoreStatusValue;
  configHash: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mirror of the `storefront_catalog_product` Prisma row (M12 / Step 2).
 *
 * # Why this lives next to `StudioPublishedProductRow`
 *
 * They cover orthogonal concerns:
 *   • `StudioPublishedProductRow.document` carries the *page* (sections).
 *   • `StorefrontCatalogProductRow` carries the *commerce metadata*
 *     (price, SKU, collection, badges, target, problems, upsells).
 *
 * A curated product has a catalog row but NO published-product row.
 * An AI-generated product MAY have both — the catalog row is what
 * makes it discoverable on the storefront shop / collections / etc.
 *
 * # Field-by-field semantics
 *
 *   • `priceMinor`      — integer minor units (halalas for SAR…). Avoids
 *                          float drift; matches the OrderMirror pattern.
 *   • `offerTiers`      — opaque Json, validated by callers via Zod.
 *                          Shape lives in `@platform/builder-schema`.
 *   • `problems`        — Postgres TEXT[]; lets shop filters do
 *                          `WHERE ? = ANY(problems)` without a JOIN.
 *   • `upsellIds`       — TEXT[] of slugs; cross-store references resolve
 *                          lazily on the loader side (no FK).
 *   • `publishedProductId` — loose string (no FK) so publish-snapshot
 *                            rotation never cascades into the catalog.
 *   • `isLive`          — soft-disable. Hides the row from the shop
 *                          without deleting; an `isLive=false` row is
 *                          still usable for analytics joins.
 */
export interface StorefrontCatalogProductRow {
  id: string;
  storeId: string;
  slug: string;
  source: ProductSourceValue;
  publishedProductId: string | null;
  sku: string | null;
  priceMinor: number;
  priceCurrency: string;
  offerTiers: unknown;
  collection: string | null;
  productType: string | null;
  target: string | null;
  problems: string[];
  badges: unknown;
  rating: unknown;
  stockLeft: number | null;
  recentBuyers: number | null;
  upsellIds: string[];
  /** Dedicated product (id/slug) for the 99-SAR post-purchase offer. Separate
   *  from `upsellIds`; resolved id-or-slug on the loader side. Null → heuristic. */
  postPurchaseUpsellId: string | null;
  landingPath: string | null;
  /** Durable hero image URL (CDN) re-hosted from the AI pipeline's
   *  vendor URL at publish time. Null for curated rows + legacy rows
   *  published before the image fix. */
  heroImageUrl: string | null;
  /** Step 4 — CRO content projection (Json) read by the fanaa PDP to render
   *  AI-generated sections. Null for curated rows + rows published before
   *  Step 4. Validated by `@platform/catalog-schema`'s CroContentSchema on read. */
  croContent: unknown;
  isLive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────
// Prisma-client minimal interface
// ─────────────────────────────────────────────────────────────────────────

export interface PrismaLike {
  studioStore: PrismaModelDelegate<StudioStoreRow>;
  studioDraft: PrismaModelDelegate<StudioDraftRow>;
  studioRun: PrismaModelDelegate<StudioRunRow>;
  studioStep: PrismaModelDelegate<StudioStepRow>;
  studioAsset: PrismaModelDelegate<StudioAssetRow>;
  studioEvent: PrismaModelDelegate<StudioEventRow>;
  /** M11 — immutable publish snapshots. */
  studioPublishedProduct: PrismaModelDelegate<StudioPublishedProductRow>;
  /** M11 — versioned generation artifacts (used by publish flow + future regenerate). */
  studioArtifact: PrismaModelDelegate<StudioArtifactRow>;
  /** M12 / Step 2 — DB-backed storefront catalog rows. */
  storefrontCatalogProduct: PrismaModelDelegate<StorefrontCatalogProductRow>;
  $transaction<T>(fn: (tx: PrismaLike) => Promise<T>): Promise<T>;
}

export interface StudioArtifactRow {
  id: string;
  draftId: string;
  kind: string;
  locale: string | null;
  version: number;
  isCurrent: boolean;
  payload: unknown;
  generatedByStepId: string | null;
  createdAt: Date;
}

/**
 * Subset of the Prisma model-delegate surface we use. Mirrors the
 * shape Prisma generates so any real `PrismaClient` satisfies it.
 *
 * The argument types are loosened to `unknown` so we don't have to
 * mirror every WhereInput / UncheckedCreateInput definition; the
 * mapper layer is responsible for shaping them correctly.
 */
export interface PrismaModelDelegate<TRow> {
  create(args: { data: unknown }): Promise<TRow>;
  update(args: { where: unknown; data: unknown }): Promise<TRow>;
  upsert(args: { where: unknown; create: unknown; update: unknown }): Promise<TRow>;
  findUnique(args: { where: unknown; include?: unknown }): Promise<TRow | null>;
  findFirst(args: { where: unknown; include?: unknown; orderBy?: unknown }): Promise<TRow | null>;
  findMany(args?: {
    where?: unknown;
    include?: unknown;
    orderBy?: unknown;
    take?: number;
    skip?: number;
  }): Promise<TRow[]>;
  count(args?: { where?: unknown }): Promise<number>;
  delete(args: { where: unknown }): Promise<TRow>;
  deleteMany(args?: { where?: unknown }): Promise<{ count: number }>;
}

// ─────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────

/** Constructor options for PrismaRunStore. */
export interface PrismaRunStoreOptions {
  prisma: PrismaLike;
  /** Maps runId → draftId. Studio sets the draft id when seeding
   *  the run; the M6 RunStore contract doesn't know about drafts so
   *  we look it up explicitly here. */
  draftIdResolver: (runId: string) => Promise<string | null>;
}

/** Inputs for `StudioDraftRepository.create`. */
export interface DraftSeed {
  storeId: string;
  slug: string;
  title: string;
  template: string;
  supplierUrl?: string;
  notes?: string;
  positioning?: string;
  createdBy?: string;
}

export interface AssetSeed {
  draftId: string;
  source: StudioAssetSourceValue;
  bucket: string;
  key: string;
  contentType: string;
  bytes: number;
  width?: number;
  height?: number;
  altAr?: string;
  altEn?: string;
}

export interface EventSeed {
  storeId?: string;
  draftId?: string;
  kind: string;
  actor: string;
  payload?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────

export type PersistenceErrorKind =
  | "not_found"
  | "conflict"
  | "invalid_input"
  | "unavailable"
  | "unknown";

export class PersistenceError extends Error {
  override readonly name = "PersistenceError";
  readonly kind: PersistenceErrorKind;
  override readonly cause?: unknown;
  constructor(args: {
    kind: PersistenceErrorKind;
    message: string;
    cause?: unknown;
  }) {
    super(args.message);
    this.kind = args.kind;
    this.cause = args.cause;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────────────────

export type { CostRow, RunRecord, StepRecord };
