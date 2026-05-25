import {
  DraftDocumentSchema,
  makeBlankDraft,
  validateForPublish,
  type DraftDocument,
  type PublishIssue,
} from "@platform/builder-schema";
import {
  PersistenceError,
  type StudioDraftRow,
  type StudioPublishedProductRow,
} from "@platform/persistence";
import { fanaaStore } from "@platform/stores";
import { getStudioPersistence } from "./persistence";

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
