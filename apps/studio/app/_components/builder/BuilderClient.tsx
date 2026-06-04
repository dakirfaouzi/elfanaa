"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  SECTION_LABELS,
  makeBlankSection,
  validateForPublish,
  type CatalogMetadata,
  type DraftDocument,
  type PublishIssue,
  type Section,
  type SectionKind,
} from "@platform/builder-schema";
import {
  canRedo,
  canUndo,
  createAutosaveScheduler,
  initialState,
  isDirty,
  reducer,
  type BuilderState,
} from "@platform/builder-state";
import { DraftRenderer } from "@platform/runtime-renderer";
import { SectionEditor, sectionKindLabel } from "./editors";
import { CatalogMetadataPanel } from "./CatalogMetadataPanel";
import { SectionImagesPanel } from "./SectionImagesPanel";
import { PublishConfirmModal } from "./PublishConfirmModal";
import { RelativeTime } from "../RelativeTime";
import { StatusIcon, type StatusGlyphKind } from "../StatusIcon";
import { studioPath } from "@/lib/base-path";
import { friendlyError } from "@/lib/studio/error-messages";
import { SECTION_PICKER_GROUPS } from "@/lib/studio/section-picker-groups";
import { resolveDocumentSrcs } from "@/lib/studio/resolve-document-srcs";

/**
 * BuilderClient — the top-level client component the
 * `/drafts/[draftId]` route hydrates.
 *
 * # Composition
 *
 *   ┌── Toolbar (status, undo/redo, publish) ────┐
 *   │                                            │
 *   ├── SectionList ┬── SectionBlock (per item)  │
 *   │              ├── add-section picker        │
 *   │                                            │
 *   └── PreviewPane (DraftRenderer)              │
 *
 * # Hydration safety
 *
 * The page server-renders the toolbar shell + the section labels;
 * BuilderClient hydrates the interactive bits. The reducer's initial
 * state comes from the server-rendered `initialDocument` prop —
 * server and client render identical markup on first paint.
 *
 * # Autosave
 *
 * Wired via `@platform/builder-state`'s scheduler. The PATCH route
 * receives the full DraftDocument; optimistic concurrency is enforced
 * by `expectedPayloadVersion`.
 *
 * # Beforeunload guard
 *
 * When `isDirty(state)`, navigating away triggers the browser's
 * native "are you sure" prompt. The hook below adds the listener
 * lazily so the guard only fires on real edits.
 */

export interface BuilderClientProps {
  draftId: string;
  storeId: string;
  slug: string;
  initialDocument: DraftDocument;
  initialPayloadVersion: number;
  primaryLocale?: "ar" | "en";
  /** When true the operator can't publish — DB persistence is off. */
  readOnly?: boolean;
}

function makeSectionId(): string {
  return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** localStorage key for the operator's preview-pane visibility choice. */
const PREVIEW_VISIBLE_KEY = "fanaa.studio.builder.previewVisible";

interface Readiness {
  tone: "success" | "warning" | "danger" | "info";
  glyph: StatusGlyphKind;
  label: string;
}

/** Count section images present in the draft + how many actually have a
 *  source. Mirrors what `SectionImagesPanel` surfaces: the hero MediaRef
 *  plus the `croContent.lifestyleImages[]` scene pool. */
function collectImageStats(document: DraftDocument): {
  total: number;
  withSrc: number;
  missing: number;
} {
  const hero = document.sections.find((s) => s.kind === "hero");
  const heroSrc = hero?.media?.desktopSrc;
  const bag = document.croContent as { lifestyleImages?: unknown } | undefined;
  const pool = Array.isArray(bag?.lifestyleImages) ? bag.lifestyleImages : [];
  let total = 0;
  let withSrc = 0;
  if (hero) {
    total += 1;
    if (typeof heroSrc === "string" && heroSrc.trim()) withSrc += 1;
  }
  for (const raw of pool) {
    total += 1;
    const src = (raw as { src?: unknown } | null)?.src;
    if (typeof src === "string" && src.trim()) withSrc += 1;
  }
  return { total, withSrc, missing: total - withSrc };
}

export function BuilderClient(props: BuilderClientProps) {
  const [state, dispatch] = useReducer(
    reducer,
    props.initialDocument,
    initialState,
  );
  const [savedDocumentVersion, setSavedDocumentVersion] = useState(
    props.initialPayloadVersion,
  );
  const [publishIssues, setPublishIssues] = useState<PublishIssue[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());
  const [primary, setPrimary] = useState<"ar" | "en">(
    props.primaryLocale ?? "ar",
  );
  // Preview pane is collapsed by default (Sprint 1) — editor gets full
  // width. The operator's choice persists across drafts via localStorage.
  // Default `false` matches SSR + first client paint, so reading the
  // stored value in an effect cannot cause a hydration mismatch.
  const [previewVisible, setPreviewVisible] = useState(false);
  // Section Navigator (Sprint 2) — the section currently nearest the top
  // of the viewport, tracked by a scroll-spy IntersectionObserver below.
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const expectedVersionRef = useRef(props.initialPayloadVersion);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(PREVIEW_VISIBLE_KEY) === "1") {
        setPreviewVisible(true);
      }
    } catch {
      /* storage disabled — keep default collapsed */
    }
  }, []);

  function togglePreview() {
    setPreviewVisible((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(PREVIEW_VISIBLE_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  }

  // ── Section Navigator (Sprint 2) ──────────────────────────────────
  // Build a flat list of {id,label,enabled} for the jump-nav, and a
  // stable key so the scroll-spy observer re-attaches only when the set
  // of sections actually changes (add / remove / reorder).
  const navItems = useMemo(
    () =>
      state.document.sections.map((s) => ({
        id: s.id,
        label: sectionKindLabel(s.kind),
        enabled: s.enabled !== false,
      })),
    [state.document.sections],
  );
  const sectionAnchorKey = navItems.map((s) => s.id).join("|");

  function jumpToSection(id: string) {
    setActiveSectionId(id);
    const el = document.getElementById(`builder-section-${id}`);
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  useEffect(() => {
    if (sectionAnchorKey === "") return;
    const ids = sectionAnchorKey.split("|");
    const els = ids
      .map((id) => document.getElementById(`builder-section-${id}`))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Active = the visible section whose top is nearest the toolbar.
        let best: string | null = null;
        let bestTop = Number.POSITIVE_INFINITY;
        for (const el of els) {
          if (!visible.has(el.id)) continue;
          const top = el.getBoundingClientRect().top;
          if (top < bestTop) {
            bestTop = top;
            best = el.id;
          }
        }
        if (best) setActiveSectionId(best.replace("builder-section-", ""));
      },
      { rootMargin: "-150px 0px -55% 0px", threshold: [0, 0.25, 0.6, 1] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionAnchorKey]);

  // Autosave scheduler.
  const scheduler = useMemo(() => {
    if (props.readOnly) return null;
    return createAutosaveScheduler({
      debounceMs: 1000,
      save: async (doc, version) => {
        const resp = await fetch(
          studioPath(`/api/studio/drafts/${encodeURIComponent(props.draftId)}`),
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              document: doc,
              expectedPayloadVersion: expectedVersionRef.current,
            }),
          },
        );
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`save_failed:${resp.status}:${text}`);
        }
        const json = await resp.json();
        const next = json.value?.payloadVersion;
        if (typeof next === "number") {
          expectedVersionRef.current = next;
          setSavedDocumentVersion(version);
        }
      },
      onSaving: () => dispatch({ type: "MARK_SAVING" }),
      onSaved: (version, savedAt) =>
        dispatch({
          type: "MARK_SAVED",
          savedAt,
          savedDocumentVersion: version,
        }),
      onError: (err) => {
        // Keep the raw message in the console for forensics; the pill shows
        // a friendly sentence derived from it.
        // eslint-disable-next-line no-console
        console.error("[Builder] autosave failed", err);
        dispatch({ type: "MARK_SAVE_ERROR", message: err.message });
      },
    });
  }, [props.draftId, props.readOnly]);

  useEffect(() => {
    if (!scheduler) return;
    if (state.documentVersion === 0) return;
    if (state.documentVersion === savedDocumentVersion) return;
    scheduler.notify(state.documentVersion, state.document);
  }, [state.documentVersion, state.document, savedDocumentVersion, scheduler]);

  useEffect(() => {
    return () => {
      scheduler?.dispose();
    };
  }, [scheduler]);

  useEffect(() => {
    if (props.readOnly) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty(state) || state.saveState === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state, props.readOnly]);

  // ── handlers ───────────────────────────────────────────────────────
  function patchSection(section: Section, patch: Partial<Section>) {
    dispatch({ type: "UPDATE_SECTION", sectionId: section.id, patch });
  }
  function patchCatalogMetadata(patch: Partial<CatalogMetadata>) {
    dispatch({ type: "UPDATE_CATALOG_METADATA", patch });
  }
  function addSection(kind: SectionKind) {
    dispatch({
      type: "ADD_SECTION",
      kind,
      section: makeBlankSection(kind, makeSectionId),
    });
  }
  function duplicateSection(section: Section) {
    const blank = makeBlankSection(section.kind, makeSectionId);
    dispatch({
      type: "DUPLICATE_SECTION",
      sectionId: section.id,
      newSection: { ...section, ...blank, id: blank.id } as Section,
    });
  }
  function toggleCollapse(sectionId: string) {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  // Publish-readiness, derived purely from real draft state — no fake
  // indicators. `validateForPublish` is the same gate publish uses; image
  // stats mirror what the Section Images panel surfaces.
  const imageStats = useMemo(
    () => collectImageStats(state.document),
    [state.document],
  );
  const readiness = useMemo<Readiness>(() => {
    if (props.readOnly) {
      return { tone: "info", glyph: "info", label: "Read-only" };
    }
    const result = validateForPublish(state.document);
    if (!result.ok) {
      return { tone: "danger", glyph: "error", label: "Missing required data" };
    }
    if (imageStats.missing > 0) {
      return { tone: "warning", glyph: "warning", label: "Images need review" };
    }
    return { tone: "success", glyph: "completed", label: "Ready to publish" };
  }, [props.readOnly, state.document, imageStats]);

  const productTitle = useMemo(() => {
    const title = state.document.meta.title as
      | { ar?: string; en?: string }
      | undefined;
    const picked = primary === "ar" ? title?.ar : title?.en;
    return (
      (picked && picked.trim()) ||
      (title?.ar && title.ar.trim()) ||
      (title?.en && title.en.trim()) ||
      "(untitled)"
    );
  }, [state.document.meta.title, primary]);

  // Step 1 — validate, then open the confirmation modal. The actual
  // publish request stays UNCHANGED and runs from `confirmPublish`.
  function requestPublish() {
    const result = validateForPublish(state.document);
    if (!result.ok) {
      setPublishIssues(result.issues);
      setPublishMessage("Resolve the issues below before publishing.");
      return;
    }
    setPublishIssues(result.warnings);
    setPublishMessage(null);
    setConfirmOpen(true);
  }

  // Step 2 — the operator explicitly confirmed. This is the original
  // publish flow, byte-for-byte, just gated behind the modal.
  async function confirmPublish() {
    setConfirmOpen(false);
    setPublishing(true);
    setPublishMessage(null);
    try {
      // Flush any pending save so the publish reads the latest payload.
      await scheduler?.flush();
      const resp = await fetch(
        studioPath(
          `/api/studio/drafts/${encodeURIComponent(props.draftId)}/publish`,
        ),
        { method: "POST" },
      );
      if (!resp.ok) {
        const json = await resp.json().catch(() => null);
        if (json?.code === "publish_blocked" && Array.isArray(json.issues)) {
          setPublishIssues(json.issues);
          setPublishMessage("Resolve the issues below before publishing.");
        } else {
          // eslint-disable-next-line no-console
          console.error("[Builder] publish failed", {
            status: resp.status,
            message: json?.message,
          });
          setPublishMessage(
            friendlyError(json?.message ?? `publish failed (${resp.status})`),
          );
        }
        return;
      }
      const json = await resp.json();
      const record = json.value?.record;
      setPublishMessage(
        record
          ? `Published v${record.version} (${record.publishedAt}).`
          : "Published.",
      );
    } finally {
      setPublishing(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Toolbar
        state={state}
        dispatch={dispatch}
        primary={primary}
        onPrimaryChange={setPrimary}
        onPublish={requestPublish}
        publishing={publishing}
        publishMessage={publishMessage}
        readiness={readiness}
        previewVisible={previewVisible}
        onTogglePreview={togglePreview}
        slug={props.slug}
        readOnly={props.readOnly}
      />
      {props.readOnly ? (
        <div className="banner">
          Read-only mode — enable dual-write persistence to edit and publish drafts.
        </div>
      ) : null}
      {publishIssues.length > 0 ? (
        <PublishIssuesList issues={publishIssues} />
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: previewVisible
            ? "minmax(320px, 1.2fr) minmax(320px, 1fr)"
            : "1fr",
          gap: 20,
        }}
        className="builder-split"
        data-preview={previewVisible ? "on" : "off"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {navItems.length > 1 ? (
            <SectionNavigator
              items={navItems}
              activeId={activeSectionId}
              onJump={jumpToSection}
            />
          ) : null}
          {/*
           * M12 / Step 2 / Phase 2.3 — Catalog metadata panel.
           *
           * Renders ABOVE the section list as an always-visible card
           * (Phase 2.3 decision 2). The panel is collapsible from
           * its own header, but never hidden from the operator —
           * commerce metadata is half the publish output.
           */}
          <CatalogMetadataPanel
            value={state.document.catalogMetadata}
            onPatch={patchCatalogMetadata}
            readOnly={props.readOnly}
          />
          {/*
           * Draft Asset Review MVP — review + manually replace generated
           * section images (hero + the croContent scene pool) before publish,
           * without leaving the editor or re-running generation.
           */}
          <SectionImagesPanel
            draftId={props.draftId}
            croContent={
              state.document.croContent as Record<string, unknown> | undefined
            }
            heroSection={(() => {
              const hero = state.document.sections.find(
                (s) => s.kind === "hero",
              );
              return hero ? { id: hero.id, media: hero.media } : null;
            })()}
            dispatch={dispatch}
            readOnly={props.readOnly}
          />
          {state.document.sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              draftId={props.draftId}
              collapsed={collapsedSet.has(section.id)}
              onToggleCollapse={() => toggleCollapse(section.id)}
              onMoveUp={() =>
                dispatch({
                  type: "MOVE_SECTION",
                  sectionId: section.id,
                  direction: "up",
                })
              }
              onMoveDown={() =>
                dispatch({
                  type: "MOVE_SECTION",
                  sectionId: section.id,
                  direction: "down",
                })
              }
              onToggleEnabled={() =>
                dispatch({ type: "TOGGLE_SECTION", sectionId: section.id })
              }
              onDelete={() =>
                dispatch({ type: "DELETE_SECTION", sectionId: section.id })
              }
              onDuplicate={() => duplicateSection(section)}
              onPatch={(p) => patchSection(section, p)}
            />
          ))}
          <SectionPicker onAdd={addSection} />
        </div>
        {previewVisible ? (
          <PreviewPane document={state.document} primary={primary} />
        ) : null}
      </div>
      {confirmOpen ? (
        <PublishConfirmModal
          productTitle={productTitle}
          draftId={props.draftId}
          languageLabel={primary === "ar" ? "العربية" : "English"}
          imageCount={imageStats.withSrc}
          destination={`/p/${props.slug}`}
          publishing={publishing}
          onConfirm={confirmPublish}
          onCancel={() => setConfirmOpen(false)}
        />
      ) : null}
      <style>{`
        @media (max-width: 960px) {
          .builder-split[data-preview="on"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Toolbar
// ─────────────────────────────────────────────────────────────────────────

function Toolbar(props: {
  state: BuilderState;
  dispatch: React.Dispatch<{ type: "UNDO" } | { type: "REDO" }>;
  primary: "ar" | "en";
  onPrimaryChange: (locale: "ar" | "en") => void;
  onPublish: () => void;
  publishing: boolean;
  publishMessage: string | null;
  readiness: Readiness;
  previewVisible: boolean;
  onTogglePreview: () => void;
  slug: string;
  readOnly?: boolean;
}) {
  return (
    <div className="toolbar">
      <SavePill state={props.state} />
      <div className="grow" />
      <button
        type="button"
        className="btn btn-small"
        onClick={() => props.dispatch({ type: "UNDO" })}
        disabled={!canUndo(props.state) || props.readOnly}
        title="Undo (⌘Z)"
      >
        Undo
      </button>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => props.dispatch({ type: "REDO" })}
        disabled={!canRedo(props.state) || props.readOnly}
        title="Redo (⌘⇧Z)"
      >
        Redo
      </button>
      <select
        value={props.primary}
        onChange={(e) => props.onPrimaryChange(e.target.value as "ar" | "en")}
        title="Preview locale"
        style={{ padding: "7px 10px", borderRadius: 8, fontSize: 12 }}
      >
        <option value="ar">عربي</option>
        <option value="en">English</option>
      </select>
      {/*
       * Next.js Link is required here — raw <a href="/p/<slug>"> is
       * NOT prefixed with the Studio basePath, so on deployments
       * mounted under "/studio" the browser opens "/p/<slug>" at the
       * domain root and 404s. Same class of bug as the C1.1 SSE wedge.
       * `<Link>` auto-prefixes basePath; `target="_blank"` still works.
       */}
      <button
        type="button"
        className="btn btn-small"
        onClick={props.onTogglePreview}
        aria-pressed={props.previewVisible}
        title={
          props.previewVisible
            ? "Hide the live PDP preview pane"
            : "Show the live PDP preview pane"
        }
      >
        {props.previewVisible ? "Hide preview" : "Show preview"}
      </button>
      <Link
        className="btn btn-small"
        href={`/p/${encodeURIComponent(props.slug)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open preview ↗
      </Link>
      {!props.readOnly ? (
        <span
          className={`tag tag-${props.readiness.tone}`}
          title="Publish readiness — derived from the draft's current state"
        >
          <StatusIcon kind={props.readiness.glyph} />
          {props.readiness.label}
        </span>
      ) : null}
      <button
        type="button"
        className="btn btn-accent"
        onClick={props.onPublish}
        disabled={props.publishing || props.readOnly}
        style={{ minHeight: 36, fontWeight: 700, padding: "8px 16px" }}
      >
        {props.publishing ? "Publishing…" : "Publish"}
      </button>
      {props.publishMessage ? (
        <span
          className="text-dim"
          style={{
            fontSize: 12,
            width: "100%",
            paddingTop: 6,
            borderTop: "1px solid var(--border)",
            marginTop: 4,
          }}
        >
          {props.publishMessage}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Save-status pill — single coloured chip that replaces the M11
 * "banner" approach.
 *
 *   • Saved          → green tag with "Saved · X ago" (refreshes via
 *                       <RelativeTime/>).
 *   • Saving…        → info tag, no relative time.
 *   • Save failed    → red tag, "Save failed".
 *   • Unsaved changes → warning tag, "Unsaved changes".
 *
 * The pill uses the same `.tag` palette as draft status — keeps the
 * Studio's visual vocabulary tight.
 */
function SavePill({ state }: { state: BuilderState }) {
  const dirty = isDirty(state);

  if (state.saveState === "saving") {
    return (
      <span className="tag tag-info" title="Autosave in flight">
        <DotIndicator color="var(--info)" pulse />
        Saving…
      </span>
    );
  }

  if (state.saveState === "error") {
    return (
      <span
        className="tag tag-danger"
        title={friendlyError(state.lastError)}
      >
        <DotIndicator color="var(--danger)" />
        Save failed
      </span>
    );
  }

  if (dirty) {
    return (
      <span className="tag tag-warning" title="Edits pending autosave">
        <DotIndicator color="var(--warning)" />
        Unsaved changes
      </span>
    );
  }

  // Saved.
  return (
    <span className="tag tag-success" title="All changes saved">
      <DotIndicator color="var(--success)" />
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
        Saved
        {typeof state.savedAt === "number" && (
          <>
            <span style={{ opacity: 0.55 }}>·</span>
            <RelativeTime
              value={state.savedAt}
              liveRefreshMs={5_000}
              style={{ letterSpacing: 0, textTransform: "none" }}
            />
          </>
        )}
      </span>
    </span>
  );
}

function DotIndicator({
  color,
  pulse,
}: {
  color: string;
  pulse?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: color,
        display: "inline-block",
        animation: pulse
          ? "intake-stage-pulse 1.4s var(--ease-out) infinite"
          : "none",
        boxShadow: `0 0 6px -1px ${color}`,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Section navigator (Sprint 2)
// ─────────────────────────────────────────────────────────────────────────

/**
 * SectionNavigator — sticky jump-list of the document's sections.
 *
 * Clicking a chip smooth-scrolls to the matching `#builder-section-<id>`
 * anchor; the chip for the section nearest the top is highlighted via the
 * scroll-spy observer in `BuilderClient`. Horizontally scrollable so a
 * long section list never forces the editor column wider (skill: avoid
 * horizontal page scroll — the overflow is contained to this strip).
 */
function SectionNavigator(props: {
  items: Array<{ id: string; label: string; enabled: boolean }>;
  activeId: string | null;
  onJump: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Jump to section"
      style={{
        position: "sticky",
        top: 116,
        zIndex: 4,
        display: "flex",
        gap: 6,
        overflowX: "auto",
        padding: "8px 10px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        scrollbarWidth: "thin",
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          fontWeight: 700,
          alignSelf: "center",
          whiteSpace: "nowrap",
          paddingInlineEnd: 4,
        }}
      >
        Sections
      </span>
      {props.items.map((item) => {
        const active = item.id === props.activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => props.onJump(item.id)}
            aria-current={active ? "true" : undefined}
            title={item.enabled ? item.label : `${item.label} (hidden)`}
            className={active ? "btn btn-small btn-accent" : "btn btn-small"}
            style={{
              whiteSpace: "nowrap",
              fontWeight: active ? 700 : 500,
              opacity: item.enabled ? 1 : 0.55,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Section block
// ─────────────────────────────────────────────────────────────────────────

function SectionBlock(props: {
  section: Section;
  draftId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPatch: (patch: Partial<Section>) => void;
}) {
  const disabled = props.section.enabled === false;
  return (
    <div
      id={`builder-section-${props.section.id}`}
      className="section-block"
      data-collapsed={props.collapsed}
      data-disabled={disabled}
      // Clear the sticky toolbar + section navigator when jumped to via
      // the Section Navigator (Sprint 2).
      style={{ scrollMarginTop: 168 }}
    >
      <div className="section-block-head">
        <span className="kind">{sectionKindLabel(props.section.kind)}</span>
        <span className="title">{summariseSection(props.section)}</span>
        {disabled && (
          <span
            className="tag tag-warning"
            style={{ fontSize: 9, padding: "2px 6px" }}
          >
            Off
          </span>
        )}
        <div className="actions">
          {/* Move cluster — visually tight pair, separated from the
              destructive / state-affecting actions. */}
          <span className="section-block-move-cluster">
            <button
              type="button"
              className="btn btn-small btn-icon"
              onClick={props.onMoveUp}
              aria-label="Move up"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-small btn-icon"
              onClick={props.onMoveDown}
              aria-label="Move down"
              title="Move down"
            >
              ↓
            </button>
          </span>
          <button
            type="button"
            className="btn btn-small"
            onClick={props.onDuplicate}
            title="Duplicate this section"
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={props.onToggleEnabled}
            title={
              disabled
                ? "Re-enable this section"
                : "Hide this section from the published page"
            }
          >
            {disabled ? "Enable" : "Disable"}
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={props.onToggleCollapse}
            title={props.collapsed ? "Expand editor" : "Collapse editor"}
          >
            {props.collapsed ? "Expand" : "Collapse"}
          </button>
          <button
            type="button"
            className="btn btn-small btn-danger"
            onClick={() => {
              if (window.confirm("Delete this section? This can be undone.")) {
                props.onDelete();
              }
            }}
            title="Delete this section (undoable)"
          >
            Delete
          </button>
        </div>
      </div>
      {props.collapsed ? null : (
        <SectionEditor
          section={props.section}
          draftId={props.draftId}
          onPatch={props.onPatch}
        />
      )}
    </div>
  );
}

function summariseSection(section: Section): string {
  switch (section.kind) {
    case "hero":
    case "cta":
      return (
        section.title?.en?.slice(0, 60) ??
        section.title?.ar?.slice(0, 60) ??
        ""
      );
    case "sticky_cta":
      return section.label?.en ?? section.label?.ar ?? "";
    case "rich_text":
      return section.body.en?.slice(0, 60) ?? section.body.ar?.slice(0, 60) ?? "";
    case "benefits":
      return `${section.items.length} item${section.items.length === 1 ? "" : "s"}`;
    case "testimonials":
      return `${section.items.length} review${section.items.length === 1 ? "" : "s"}`;
    case "faq":
      return `${section.items.length} question${section.items.length === 1 ? "" : "s"}`;
    case "image_gallery":
      return `${section.items.length} image${section.items.length === 1 ? "" : "s"}`;
    case "before_after":
      return `${section.pairs.length} pair${section.pairs.length === 1 ? "" : "s"}`;
    case "video":
      return section.media?.desktopSrc ? "Video attached" : "No video";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Section picker
// ─────────────────────────────────────────────────────────────────────────

/**
 * Section picker — grouped into three categories defined in
 * `section-picker-groups.ts`:
 *
 *   • Hero / CTA   — entry / exit / persistent conversion surfaces.
 *   • Storytelling — the narrative that earns the conversion.
 *   • Media        — pure visual payloads.
 *
 * Each group renders as a small eyebrow + chip row. A schema-guard
 * unit test enforces that every `SectionKind` exists in exactly one
 * group, so new kinds added upstream can't silently slip out of the
 * picker.
 */
function SectionPicker(props: { onAdd: (kind: SectionKind) => void }) {
  return (
    <div className="section-block">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <strong style={{ fontSize: 14, letterSpacing: "-0.01em" }}>
          Add section
        </strong>
        <span
          className="text-faint"
          style={{ fontSize: 11, letterSpacing: "0.04em" }}
        >
          Pick a block to append to the page.
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SECTION_PICKER_GROUPS.map((group) => (
          <div
            key={group.id}
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
                fontWeight: 700,
              }}
            >
              {group.label}
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {group.kinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="btn btn-small"
                  onClick={() => props.onAdd(kind)}
                  title={`Append a ${SECTION_LABELS[kind]} section`}
                >
                  + {SECTION_LABELS[kind]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Publish issues
// ─────────────────────────────────────────────────────────────────────────

function PublishIssuesList(props: { issues: PublishIssue[] }) {
  return (
    <div className="banner danger" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <strong>Publish checklist</strong>
      <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13 }}>
        {props.issues.map((issue, i) => (
          <li
            key={i}
            style={{
              color: issue.level === "error" ? "var(--danger)" : "var(--warning)",
            }}
          >
            [{issue.level}] {issue.message}
            {issue.path ? <code className="code" style={{ marginInlineStart: 6 }}>{issue.path}</code> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Preview pane
// ─────────────────────────────────────────────────────────────────────────

function PreviewPane(props: { document: DraftDocument; primary: "ar" | "en" }) {
  // Resolve R2 keys → asset-proxy URLs before rendering so the preview
  // pane mirrors what the storefront serves. Memoised on the document
  // reference so the walker only re-runs when the operator actually
  // edits a section (every keystroke produces a new doc reference via
  // the reducer's immutable updates, but the walk is O(sections) and
  // negligible for typical 10-section drafts).
  const resolved = useMemo(
    () => resolveDocumentSrcs(props.document),
    [props.document],
  );
  return (
    <div style={{ position: "sticky", top: 60, alignSelf: "start" }}>
      <div className="preview-frame">
        <DraftRenderer document={resolved} primary={props.primary} />
      </div>
    </div>
  );
}
