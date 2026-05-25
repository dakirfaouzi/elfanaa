"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  SECTION_LABELS,
  makeBlankSection,
  validateForPublish,
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
import { RelativeTime } from "../RelativeTime";
import { studioPath } from "@/lib/base-path";
import { SECTION_PICKER_GROUPS } from "@/lib/studio/section-picker-groups";

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
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());
  const [primary, setPrimary] = useState<"ar" | "en">(
    props.primaryLocale ?? "ar",
  );
  const expectedVersionRef = useRef(props.initialPayloadVersion);

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
      onError: (err) =>
        dispatch({ type: "MARK_SAVE_ERROR", message: err.message }),
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

  async function publish() {
    const result = validateForPublish(state.document);
    if (!result.ok) {
      setPublishIssues(result.issues);
      setPublishMessage("Resolve the issues below before publishing.");
      return;
    }
    setPublishIssues(result.warnings);
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
          setPublishMessage(json?.message ?? `Publish failed (${resp.status}).`);
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
        onPublish={publish}
        publishing={publishing}
        publishMessage={publishMessage}
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
          gridTemplateColumns: "minmax(320px, 1.2fr) minmax(320px, 1fr)",
          gap: 20,
        }}
        className="builder-split"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
        <PreviewPane document={state.document} primary={primary} />
      </div>
      <style>{`
        @media (max-width: 960px) {
          .builder-split { grid-template-columns: 1fr !important; }
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
      <Link
        className="btn btn-small"
        href={`/p/${encodeURIComponent(props.slug)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open preview ↗
      </Link>
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
        title={state.lastError ?? "Unknown save error"}
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
      className="section-block"
      data-collapsed={props.collapsed}
      data-disabled={disabled}
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
  return (
    <div style={{ position: "sticky", top: 60, alignSelf: "start" }}>
      <div className="preview-frame">
        <DraftRenderer document={props.document} primary={props.primary} />
      </div>
    </div>
  );
}
