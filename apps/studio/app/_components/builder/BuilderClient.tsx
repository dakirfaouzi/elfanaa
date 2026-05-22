"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import { studioPath } from "@/lib/base-path";

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

const BUILD_KINDS_FOR_PICKER: SectionKind[] = [
  "hero",
  "benefits",
  "before_after",
  "testimonials",
  "cta",
  "faq",
  "sticky_cta",
  "video",
  "image_gallery",
  "rich_text",
];

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
  const dirty = isDirty(props.state);
  const status =
    props.state.saveState === "saving"
      ? "Saving…"
      : props.state.saveState === "error"
        ? `Save error: ${props.state.lastError ?? "unknown"}`
        : dirty
          ? "Unsaved changes"
          : "All changes saved";
  const tone =
    props.state.saveState === "error"
      ? "banner danger"
      : dirty
        ? "banner"
        : "banner success";
  return (
    <div className="toolbar">
      <span className={tone} style={{ padding: "4px 10px" }}>{status}</span>
      <div className="grow" />
      <button
        type="button"
        className="btn btn-small"
        onClick={() => props.dispatch({ type: "UNDO" })}
        disabled={!canUndo(props.state) || props.readOnly}
      >
        Undo
      </button>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => props.dispatch({ type: "REDO" })}
        disabled={!canRedo(props.state) || props.readOnly}
      >
        Redo
      </button>
      <select
        value={props.primary}
        onChange={(e) => props.onPrimaryChange(e.target.value as "ar" | "en")}
        title="Preview locale"
        style={{ padding: "6px 8px", borderRadius: 8 }}
      >
        <option value="ar">عربي</option>
        <option value="en">English</option>
      </select>
      <a
        className="btn btn-small"
        href={`/p/${encodeURIComponent(props.slug)}`}
        target="_blank"
        rel="noopener"
      >
        Open preview ↗
      </a>
      <button
        type="button"
        className="btn btn-small btn-accent"
        onClick={props.onPublish}
        disabled={props.publishing || props.readOnly}
      >
        {props.publishing ? "Publishing…" : "Publish"}
      </button>
      {props.publishMessage ? (
        <span className="text-dim" style={{ fontSize: 12 }}>
          {props.publishMessage}
        </span>
      ) : null}
    </div>
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
  return (
    <div
      className="section-block"
      data-collapsed={props.collapsed}
      data-disabled={props.section.enabled === false}
    >
      <div className="section-block-head">
        <span className="kind">{sectionKindLabel(props.section.kind)}</span>
        <span className="title">
          {summariseSection(props.section)}
        </span>
        <div className="actions">
          <button
            type="button"
            className="btn btn-small btn-icon"
            onClick={props.onMoveUp}
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn-small btn-icon"
            onClick={props.onMoveDown}
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={props.onDuplicate}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={props.onToggleEnabled}
          >
            {props.section.enabled === false ? "Enable" : "Disable"}
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={props.onToggleCollapse}
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

function SectionPicker(props: { onAdd: (kind: SectionKind) => void }) {
  return (
    <div className="section-block">
      <strong>Add section</strong>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {BUILD_KINDS_FOR_PICKER.map((kind) => (
          <button
            key={kind}
            type="button"
            className="btn btn-small"
            onClick={() => props.onAdd(kind)}
          >
            + {SECTION_LABELS[kind]}
          </button>
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
