import {
  DraftDocumentSchema,
  hasMeaningfulCatalogMetadata,
  makeBlankDraft,
  validateForPublish,
  type CatalogMetadata,
  type DraftDocument,
  type PublishIssue,
} from "@platform/builder-schema";
import {
  PersistenceError,
  type StudioDraftRow,
  type StudioPublishedProductRow,
} from "@platform/persistence";
import { fanaaStore } from "@platform/stores";
import {
  isDurablePublicUrl,
  resolvePublicCdnBase,
  resolveStorageRef,
} from "@platform/storage";
import { getStudioPersistence } from "./persistence";
import { rehostImageUrl } from "./persist-generated-images";

/**
 * Drafts service — the file-light shim the Studio API routes call.
 *
 * # Why a service layer and not raw Prisma calls in routes
 *
 *   • One place owns the publish-validation flow.
 *   • One place owns the dual-mode degradation (DB-enabled vs file-only).
 *   • Route handlers stay short: parse request → call service → translate
 *     the typed result into a Next.js Response.
 *
 * # File-only mode
 *
 * When the operator has not opted into dual-write, the builder routes
 * return `mode_unavailable` so the UI shows the enable-banner. We do
 * NOT mirror drafts to the filesystem in M11 — drafts live in the DB
 * once dual-write is on; the file-store path stays focused on runs.
 *
 * # Slug generation
 *
 * Slugs come from the operator (typed in the new-draft form). The
 * service normalises (`lowercase`, hyphenise spaces) but does NOT
 * mint them automatically — explicit input prevents collisions.
 */

let counter = 0;
function nextLocalId(): string {
  counter += 1;
  return `sec_${Date.now().toString(36)}${counter.toString(36)}`;
}

export type DraftServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "mode_unavailable" }
  | { ok: false; code: "not_found"; draftId?: string }
  | { ok: false; code: "conflict"; message: string }
  | { ok: false; code: "invalid_input"; issues: Array<{ path?: string; message: string }> }
  | { ok: false; code: "publish_blocked"; issues: PublishIssue[] }
  | { ok: false; code: "internal"; message: string };

export interface DraftListItem {
  id: string;
  storeId: string;
  slug: string;
  title: string;
  status: StudioDraftRow["status"];
  payloadVersion: number;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface DraftDetail extends DraftListItem {
  document: DraftDocument;
  hasPayload: boolean;
}

export function rowToListItem(row: StudioDraftRow): DraftListItem {
  return {
    id: row.id,
    storeId: row.storeId,
    slug: row.slug,
    title: row.title,
    status: row.status,
    payloadVersion: row.payloadVersion,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function rowToDetail(row: StudioDraftRow): DraftDetail {
  const hasPayload = row.payload !== null && row.payload !== undefined;
  const document = hasPayload
    ? coerceDocument(row.payload, row.title, row.slug)
    : makeBlankDraft({
        slug: row.slug,
        title: { en: row.title },
        newId: nextLocalId,
      });
  return {
    ...rowToListItem(row),
    document,
    hasPayload,
  };
}

function coerceDocument(
  raw: unknown,
  fallbackTitle: string,
  fallbackSlug: string,
): DraftDocument {
  const parsed = DraftDocumentSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Corrupt payload — fall back to a blank. The route exposes
  // `hasPayload=false` so the UI knows the operator must
  // re-author. This is the same fail-safe the runs page applied to
  // corrupt run records in M8.
  //
  // # Why we log loudly here
  //
  // Previously this was silent: the operator saw a blank canvas
  // with no signal that the payload was rejected. Tracking down
  // the root cause required intuiting that the schema parse had
  // failed (the symptom is indistinguishable from "operator hasn't
  // edited yet"). Emitting the Zod issues to stderr makes the
  // failure visible in the Studio container logs and shortens the
  // debug loop dramatically — Zod's `.format()` output names the
  // offending path and the expected vs actual shape.
  //
  // First 5 issues only — Zod can emit dozens of cascading errors
  // for a single root mismatch, and the operator-facing diagnostic
  // is hardest to read when buried under noise.
  const issues = parsed.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
    .join(" | ");
  // eslint-disable-next-line no-console
  console.warn(
    `[drafts-service] coerce_document_invalid slug=${fallbackSlug} title=${JSON.stringify(fallbackTitle)} issues=${issues}`,
  );
  return makeBlankDraft({
    slug: fallbackSlug,
    title: { en: fallbackTitle },
    newId: nextLocalId,
  });
}

/** Normalise a user-supplied slug into the canonical form. */
export function normaliseSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ─────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────

export async function listDrafts(args: {
  storeId?: string;
  take?: number;
} = {}): Promise<DraftServiceResult<DraftListItem[]>> {
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return { ok: false, code: "mode_unavailable" };
  }
  const rows = await persistence.repositories.draft.list({
    storeId: args.storeId,
    take: args.take,
  });
  return { ok: true, value: rows.map(rowToListItem) };
}

export async function createDraft(args: {
  storeId?: string;
  slug: string;
  title: string;
  template?: string;
  createdBy?: string;
}): Promise<DraftServiceResult<DraftDetail>> {
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return { ok: false, code: "mode_unavailable" };
  }

  const slug = normaliseSlug(args.slug);
  if (!slug) {
    return {
      ok: false,
      code: "invalid_input",
      issues: [{ path: "slug", message: "slug_required" }],
    };
  }
  const title = args.title.trim().slice(0, 200);
  if (!title) {
    return {
      ok: false,
      code: "invalid_input",
      issues: [{ path: "title", message: "title_required" }],
    };
  }

  const storeId = args.storeId ?? fanaaStore.id;

  try {
    // Make sure the StudioStore row exists.
    await persistence.repositories.store.upsert({
      id: storeId,
      displayName:
        typeof fanaaStore.displayName === "string"
          ? fanaaStore.displayName
          : (fanaaStore.displayName.en ?? storeId),
      configHash: "m11",
    });

    const row = await persistence.repositories.draft.create({
      storeId,
      slug,
      title,
      template: args.template ?? "default",
      createdBy: args.createdBy ?? "studio_ui",
    });

    // Seed an initial DraftDocument so the builder renders something
    // meaningful on first open.
    const seed = makeBlankDraft({
      slug,
      title: { en: title },
      newId: nextLocalId,
    });
    const seeded = await persistence.repositories.draft.savePayload({
      id: row.id,
      payload: seed,
      expectedPayloadVersion: -1,
      title,
    });

    await persistence.repositories.event.append({
      storeId,
      draftId: seeded.id,
      kind: "draft.created",
      actor: args.createdBy ?? "studio_ui",
      payload: { slug, title },
    });

    return { ok: true, value: rowToDetail(seeded) };
  } catch (err) {
    if (err instanceof PersistenceError) {
      if (err.kind === "conflict") {
        return { ok: false, code: "conflict", message: err.message };
      }
      if (err.kind === "not_found") {
        return { ok: false, code: "not_found" };
      }
    }
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getDraft(
  draftId: string,
): Promise<DraftServiceResult<DraftDetail>> {
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return { ok: false, code: "mode_unavailable" };
  }
  const row = await persistence.repositories.draft.findById(draftId);
  if (!row) return { ok: false, code: "not_found", draftId };
  return { ok: true, value: rowToDetail(row) };
}

export async function updateDraftDocument(args: {
  draftId: string;
  document: unknown;
  expectedPayloadVersion?: number;
  title?: string;
}): Promise<DraftServiceResult<DraftDetail>> {
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return { ok: false, code: "mode_unavailable" };
  }
  const parsed = DraftDocumentSchema.safeParse(args.document);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }
  try {
    const row = await persistence.repositories.draft.savePayload({
      id: args.draftId,
      payload: parsed.data,
      expectedPayloadVersion: args.expectedPayloadVersion,
      title: args.title,
    });
    return { ok: true, value: rowToDetail(row) };
  } catch (err) {
    if (err instanceof PersistenceError) {
      if (err.kind === "conflict") {
        return { ok: false, code: "conflict", message: err.message };
      }
      if (err.kind === "not_found") {
        return { ok: false, code: "not_found", draftId: args.draftId };
      }
    }
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function renameDraft(args: {
  draftId: string;
  title: string;
}): Promise<DraftServiceResult<DraftDetail>> {
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return { ok: false, code: "mode_unavailable" };
  }
  const title = args.title.trim().slice(0, 200);
  if (!title) {
    return {
      ok: false,
      code: "invalid_input",
      issues: [{ path: "title", message: "title_required" }],
    };
  }
  try {
    const row = await persistence.repositories.draft.rename({
      id: args.draftId,
      title,
    });
    return { ok: true, value: rowToDetail(row) };
  } catch (err) {
    if (err instanceof PersistenceError && err.kind === "not_found") {
      return { ok: false, code: "not_found", draftId: args.draftId };
    }
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Publish
// ─────────────────────────────────────────────────────────────────────────

export interface PublishedRecord {
  id: string;
  draftId: string;
  storeId: string;
  slug: string;
  version: number;
  publishedAt: string;
  publishedBy: string;
}

export function rowToPublishedRecord(row: StudioPublishedProductRow): PublishedRecord {
  return {
    id: row.id,
    draftId: row.draftId,
    storeId: row.storeId,
    slug: row.slug,
    version: row.version,
    publishedAt: row.publishedAt.toISOString(),
    publishedBy: row.publishedBy,
  };
}

export async function publishDraft(args: {
  draftId: string;
  publishedBy?: string;
}): Promise<DraftServiceResult<{ record: PublishedRecord; warnings: PublishIssue[] }>> {
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return { ok: false, code: "mode_unavailable" };
  }
  const draft = await persistence.repositories.draft.findById(args.draftId);
  if (!draft) {
    return { ok: false, code: "not_found", draftId: args.draftId };
  }
  if (draft.payload === null || draft.payload === undefined) {
    return {
      ok: false,
      code: "publish_blocked",
      issues: [
        {
          level: "error",
          code: "draft_empty",
          message: "Draft has no payload — open the builder and save before publishing.",
        },
      ],
    };
  }
  const validated = validateForPublish(draft.payload);
  if (!validated.ok) {
    return { ok: false, code: "publish_blocked", issues: validated.issues };
  }
  try {
    const { row } = await persistence.repositories.published.publish({
      draftId: draft.id,
      storeId: draft.storeId,
      slug: draft.slug,
      document: validated.document,
      publishedBy: args.publishedBy ?? "studio_ui",
    });
    await persistence.repositories.draft.updateStatus({
      id: draft.id,
      status: "published",
      publishedAt: row.publishedAt,
      publishedRef: row.id,
    });
    await persistence.repositories.event.append({
      storeId: draft.storeId,
      draftId: draft.id,
      kind: "draft.published",
      actor: args.publishedBy ?? "studio_ui",
      payload: { publishedId: row.id, version: row.version },
    });

    /*
     * M12 / Step 2 / Phase 2.3 — best-effort catalog upsert.
     *
     * Pulls the operator-edited `catalogMetadata` from the validated
     * draft document and writes it to `storefront_catalog_product`
     * so the fanaa hybrid loader (Phase 2.2) overlays it onto the
     * snapshot on the next ISR cycle.
     *
     * # Best-effort contract
     *
     *   • The upsert runs AFTER the publish artifact + status flip
     *     have committed. If the catalog write fails, the publish
     *     itself still succeeds — the operator can re-publish or
     *     edit the catalog row out-of-band later.
     *   • Failure is LOGGED to stderr but NEVER throws, so the
     *     publish never regresses to "published row exists but
     *     publish flow returned an error" (the bug class the C3.1
     *     hardening eliminated).
     *   • Catalog upsert is skipped when `catalogMetadata` is absent
     *     (legacy draft) or when `priceMinor === 0` (operator
     *     deliberately left the panel blank). Legacy publishes that
     *     never touched the panel keep the same behaviour they had
     *     before Phase 2.3.
     *
     * # Source classification
     *
     * Studio publishes are always `ai_generated` source — they came
     * from the AI pipeline. Curated rows are seeded separately by
     * the storefront-catalog-auto-seed bootstrap (Phase 2.2) and
     * MUST NOT be overwritten here. The fanaa-storefront-catalog
     * seed file uses `source: "curated"`; the upsert below uses
     * `source: "ai_generated"`, and the underlying SQL `upsert` is
     * keyed on `(storeId, slug)`. The slugs for curated products
     * (`glow-serum`, `barrier-cream`, etc.) intentionally collide
     * with what an operator-published draft would use — see
     * `apps/studio/lib/studio/storefront-catalog-auto-seed.ts` for
     * the corresponding "skip if already present" guard.
     */
    // ── Verified-durable hero gate (Step 4 Phase 4.5, ADR-S4-3) ──
    //
    // GUARANTEE: the storefront NEVER receives a rotting vendor (fal) URL or
    // an unusable ref as its hero. We resolve the draft's hero ref, and if it
    // is not durable (our CDN / inline data) we attempt one last-chance
    // re-host, then fall back to `null` (→ deterministic placeholder) rather
    // than persisting a URL that will 404 and render black. The recurring
    // hero bug is eliminated at the data boundary, not patched per-surface.
    const heroGate = await prepareDurableHeroUrl({
      rawHero: extractHeroImageUrl(validated.document),
      draftId: draft.id,
      storeId: draft.storeId,
      persistence,
    });
    if (heroGate.warning) {
      validated.warnings.push({
        level: "warning",
        code: "hero_image_not_durable",
        message: heroGate.warning,
      });
    }

    const upsertResult = await tryUpsertCatalogRow({
      persistence,
      storeId: draft.storeId,
      slug: draft.slug,
      publishedProductId: row.id,
      catalogMetadata: validated.document.catalogMetadata,
      heroImageUrl: heroGate.url,
      croContent: validated.document.croContent ?? null,
    });
    if (upsertResult.kind === "logged_failure") {
      // Surface as a publish WARNING so the UI banner can show it
      // alongside successful publish. We don't promote it to error —
      // the publish itself succeeded.
      validated.warnings.push({
        level: "warning",
        code: "catalog_upsert_failed",
        message: upsertResult.message,
      });
    }

    return {
      ok: true,
      value: {
        record: rowToPublishedRecord(row),
        warnings: validated.warnings,
      },
    };
  } catch (err) {
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Read the latest published snapshot for `(storeId, slug)`. */
export async function findCurrentPublished(args: {
  storeId: string;
  slug: string;
}): Promise<DraftServiceResult<{ row: StudioPublishedProductRow; document: DraftDocument }>> {
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return { ok: false, code: "mode_unavailable" };
  }
  const row = await persistence.repositories.published.findCurrent(args);
  if (!row) return { ok: false, code: "not_found" };
  const parsed = DraftDocumentSchema.safeParse(row.document);
  if (!parsed.success) {
    return {
      ok: false,
      code: "internal",
      message: "published_document_schema_invalid",
    };
  }
  return { ok: true, value: { row, document: parsed.data } };
}

/**
 * Shape returned to the products-list catalog browser. One entry per
 * `isCurrent=true` `studio_published_product` row for the store.
 *
 * `document` is the parsed `DraftDocument` (already schema-validated
 * here) so callers can pull the title, ogImage, and any section
 * details without re-running `DraftDocumentSchema.safeParse()`.
 *
 * `documentInvalid` is set when the on-row JSON failed the Zod
 * schema. We still surface the row so it doesn't silently disappear
 * from the operator's catalog — the loader maps it to a "corrupted"
 * card the same way the legacy filesystem path does.
 */
export interface PublishedListItem {
  row: StudioPublishedProductRow;
  document: DraftDocument | null;
  documentInvalid: boolean;
}

/**
 * List every current published row for a store, parsed for catalog
 * display.
 *
 * # Why this exists
 *
 * C3 polished the `/products` surface but the page was reading
 * `.platform-data/products/<storeId>/*.json` — the legacy M7
 * `FanaaPublisher` CLI artifact path. The M11 publish flow writes to
 * `studio_published_product` (DB) instead, which left every newly-
 * published product invisible to the catalog. This helper is the
 * DB side of the C3.1 UNION-read fix.
 *
 * # Degradation
 *
 *   • File-only mode → returns `mode_unavailable`. The product-loader
 *     treats that as "no DB rows" and falls back to the FS-only path.
 *   • DB exception → propagated so the caller surfaces it in
 *     diagnostics instead of silently hiding products.
 */
export async function listPublishedProducts(args: {
  storeId: string;
  take?: number;
}): Promise<DraftServiceResult<PublishedListItem[]>> {
  const persistence = getStudioPersistence();
  if (!persistence.repositories) {
    return { ok: false, code: "mode_unavailable" };
  }
  let rows: StudioPublishedProductRow[];
  try {
    rows = await persistence.repositories.published.listCurrent(args);
  } catch (err) {
    return {
      ok: false,
      code: "internal",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  const items: PublishedListItem[] = rows.map((row) => {
    const parsed = DraftDocumentSchema.safeParse(row.document);
    if (parsed.success) {
      return { row, document: parsed.data, documentInvalid: false };
    }
    // Surface schema-invalid rows so the catalog flags them rather
    // than hiding them. The product-loader maps `documentInvalid`
    // onto a "corrupted" card.
    return { row, document: null, documentInvalid: true };
  });
  return { ok: true, value: items };
}

// ─────────────────────────────────────────────────────────────────────────
// Catalog upsert helper (M12 / Step 2 / Phase 2.3)
// ─────────────────────────────────────────────────────────────────────────

type CatalogUpsertOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "ok" }
  | { kind: "logged_failure"; message: string };

/**
 * `tryUpsertCatalogRow` — best-effort write from publishDraft into
 * `storefront_catalog_product`.
 *
 * Three branches:
 *
 *   • `skipped` — `catalogMetadata` is missing or
 *     `hasMeaningfulCatalogMetadata` returns false (e.g.
 *     `priceMinor === 0`). Legacy publishes that never touched the
 *     panel land here and preserve the pre-Phase-2.3 behaviour.
 *
 *   • `ok` — the catalog row was written. The fanaa hybrid loader
 *     overlays it onto the build-time snapshot on the next ISR
 *     cycle (≤60s after publish).
 *
 *   • `logged_failure` — the upsert threw. The publish itself
 *     still succeeded (status flip, audit event); the failure is
 *     logged to stderr AND attached to the publish result as a
 *     warning so the UI surfaces it. We DO NOT throw — Phase 2.3
 *     decision: a catalog upsert failure must never roll back a
 *     successful publish.
 */
/**
 * Pull the durable hero image URL out of a published document so the
 * fanaa catalog row can carry it (M12 / Step 2 image fix).
 *
 * Precedence:
 *   1. First enabled `hero` section's `media.desktopSrc` (the image
 *      that renders at the top of the PDP).
 *   2. `meta.ogImage` (the social-card image — also seeded from the
 *      hero in `product-to-draft.ts`).
 *
 * By the time we get here the value has already been re-hosted to
 * durable R2/CDN by `persistGeneratedImages` (during the run→draft
 * step), so this is a plain absolute URL in the happy path. We return
 * `null` for anything that isn't a non-empty string; the storefront
 * treats `null` as "no hero image" and falls back to the placeholder.
 */
function extractHeroImageUrl(document: DraftDocument): string | null {
  const sections = Array.isArray(document.sections) ? document.sections : [];
  for (const section of sections) {
    if (!section || (section as { kind?: unknown }).kind !== "hero") continue;
    const media = (section as { media?: unknown }).media as
      | { kind?: unknown; desktopSrc?: unknown }
      | null
      | undefined;
    if (media && media.kind === "image" && typeof media.desktopSrc === "string") {
      const src = media.desktopSrc.trim();
      if (src) return src;
    }
  }
  const ogImage = (document.meta as { ogImage?: unknown } | undefined)?.ogImage;
  if (typeof ogImage === "string" && ogImage.trim()) return ogImage.trim();
  return null;
}

/**
 * Public CDN fallback used when `R2_PUBLIC_BASE_URL_FANAA` is unset/misconfigured
 * — already whitelisted in fanaa's `next.config.mjs` remotePatterns and bound to
 * the bucket root. It is a PUBLIC URL, not a credential, so it is safe to default.
 */
const FANAA_PUBLIC_CDN_FALLBACK = "https://cdn.elfanaa.com";

/**
 * Verified-durable hero resolution (Step 4 Phase 4.5).
 *
 * Returns a hero URL that is GUARANTEED durable (our CDN or inline data) — or
 * `null` when no durable hero is available. Never returns a vendor/foreign URL.
 *
 *   1. Resolve the raw ref (bare key / r2:// / absolute) to a public URL.
 *   2. Durable already? → use it.
 *   3. Foreign/vendor URL? → last-chance re-host (only succeeds if the vendor
 *      URL is still alive); if that yields a durable ref → use it.
 *   4. Otherwise → `null` + a publish warning. The storefront then renders its
 *      deterministic "image pending" placeholder (never black/broken).
 */
export async function prepareDurableHeroUrl(args: {
  rawHero: string | null;
  draftId: string;
  storeId: string;
  persistence: NonNullable<ReturnType<typeof getStudioPersistence>>;
}): Promise<{ url: string | null; warning?: string }> {
  const { rawHero, draftId, storeId, persistence } = args;
  if (!rawHero) return { url: null };

  const r2 = persistence.config.r2;
  const publicBaseUrl =
    r2.driver === "r2" ? r2.publicBaseUrls[storeId] : undefined;
  const cdnBase = resolvePublicCdnBase(publicBaseUrl, FANAA_PUBLIC_CDN_FALLBACK);

  const resolved = resolveStorageRef(rawHero, { cdnBase });
  if (isDurablePublicUrl(resolved, cdnBase)) {
    return { url: resolved };
  }

  // `resolved` is null (unusable) or a FOREIGN/vendor URL that will rot.
  // Try one last-chance re-host while the source may still be alive.
  if (resolved && r2.driver === "r2") {
    const bucket = r2.buckets[storeId];
    if (bucket) {
      const durable = await rehostImageUrl({
        src: resolved,
        draftId,
        bucket,
        publicBaseUrl,
        mediaStore: persistence.mediaStore,
      });
      const reResolved = durable ? resolveStorageRef(durable, { cdnBase }) : null;
      if (isDurablePublicUrl(reResolved, cdnBase)) {
        return { url: reResolved };
      }
    }
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[drafts-service] hero_not_durable storeId=${storeId} draftId=${draftId} rawHero=${String(
      rawHero,
    ).slice(0, 120)} — persisting null hero (storefront shows placeholder)`,
  );
  return {
    url: null,
    warning:
      "Hero image was not durable (vendor URL or unresolved ref) and could not be " +
      "re-hosted at publish — the storefront will show the placeholder. Re-generate " +
      "this product so the hero is re-hosted while the source image is still available.",
  };
}

async function tryUpsertCatalogRow(args: {
  persistence: NonNullable<ReturnType<typeof getStudioPersistence>>;
  storeId: string;
  slug: string;
  publishedProductId: string;
  catalogMetadata: CatalogMetadata | undefined;
  heroImageUrl?: string | null;
  /** Step 4 — CRO projection from the draft, persisted for the storefront PDP. */
  croContent?: unknown;
}): Promise<CatalogUpsertOutcome> {
  const { persistence, catalogMetadata } = args;
  if (!persistence.repositories) {
    return { kind: "skipped", reason: "no_repositories" };
  }
  if (!catalogMetadata) {
    return { kind: "skipped", reason: "no_catalog_metadata" };
  }
  if (!hasMeaningfulCatalogMetadata(catalogMetadata)) {
    return { kind: "skipped", reason: "price_minor_zero" };
  }

  try {
    await persistence.repositories.storefrontCatalog.upsert({
      storeId: args.storeId,
      slug: args.slug,
      source: "ai_generated",
      publishedProductId: args.publishedProductId,
      sku: catalogMetadata.sku,
      priceMinor: catalogMetadata.priceMinor,
      priceCurrency: catalogMetadata.priceCurrency,
      offerTiers: catalogMetadata.offerTiers,
      collection: catalogMetadata.collection,
      productType: catalogMetadata.productType,
      target: catalogMetadata.target,
      problems: catalogMetadata.problems,
      badges: catalogMetadata.badges,
      rating: catalogMetadata.rating,
      stockLeft: catalogMetadata.stockLeft,
      recentBuyers: catalogMetadata.recentBuyers,
      upsellIds: catalogMetadata.upsellIds,
      landingPath: catalogMetadata.landingPath,
      heroImageUrl: args.heroImageUrl ?? null,
      croContent: args.croContent ?? null,
      isLive: true,
    });
    return { kind: "ok" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn(
      `[drafts-service] catalog_upsert_failed storeId=${args.storeId} slug=${args.slug} error=${message}`,
    );
    return {
      kind: "logged_failure",
      message: `Catalog row was not written: ${message}`,
    };
  }
}
