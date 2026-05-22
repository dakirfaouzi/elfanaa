"use client";

import { useEffect, useState } from "react";
import type { MediaKind, MediaRef } from "@platform/builder-schema";
import { uploadFile, type UploadProgress } from "./uploader";

/**
 * AssetPickerDialog — shared modal for picking a media asset.
 *
 * Two tabs:
 *
 *   1. Library — lists existing assets for the draft (and falls back
 *      to the cross-draft asset list when the draft has none).
 *   2. Upload  — drag-and-drop / file input + real progress bar.
 *
 * # Why a single component for both
 *
 * Reduces friction: the operator sees their library and an upload
 * affordance side-by-side. No tab switching when uploading-then-
 * picking is the common path.
 *
 * # No portal
 *
 * The modal renders inside the section editor's DOM. Sticky styles
 * keep it visible while the user scrolls. Avoids React 19 portal
 * complications inside server-component trees.
 */

interface AssetRow {
  id: string;
  key: string;
  contentType: string;
  publicUrl: string;
  bytes: number;
  width: number | null;
  height: number | null;
  altAr: string | null;
  altEn: string | null;
  draftId: string;
}

export interface AssetPickerDialogProps {
  draftId: string;
  allowed: MediaKind[];
  onClose: () => void;
  onPick: (media: MediaRef) => void;
}

export function AssetPickerDialog(props: AssetPickerDialogProps) {
  const [tab, setTab] = useState<"library" | "upload">("library");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick asset"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 9, 14, 0.78)",
        backdropFilter: "blur(6px)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 16px",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 18,
          width: "min(800px, 100%)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <strong>Pick or upload media</strong>
          <button
            type="button"
            className="btn btn-small"
            onClick={props.onClose}
            aria-label="Close"
          >
            Close
          </button>
        </header>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            className={`btn btn-small${tab === "library" ? " btn-accent" : ""}`}
            onClick={() => setTab("library")}
          >
            Library
          </button>
          <button
            type="button"
            className={`btn btn-small${tab === "upload" ? " btn-accent" : ""}`}
            onClick={() => setTab("upload")}
          >
            Upload new
          </button>
        </div>
        {tab === "library" ? (
          <LibraryTab
            draftId={props.draftId}
            allowed={props.allowed}
            onPick={props.onPick}
          />
        ) : (
          <UploadTab
            draftId={props.draftId}
            allowed={props.allowed}
            onUploaded={props.onPick}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Library tab
// ─────────────────────────────────────────────────────────────────────────

function LibraryTab(props: {
  draftId: string;
  allowed: MediaKind[];
  onPick: (media: MediaRef) => void;
}) {
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const draftResp = await fetch(
          `/api/studio/drafts/${encodeURIComponent(props.draftId)}/assets`,
        );
        let assets: AssetRow[] = [];
        if (draftResp.ok) {
          const json = await draftResp.json();
          assets = Array.isArray(json.assets) ? json.assets : [];
        }
        if (assets.length === 0) {
          // Fall back to the global library.
          const allResp = await fetch(`/api/studio/assets?take=60`);
          if (allResp.ok) {
            const json = await allResp.json();
            assets = json.value?.assets ?? [];
          }
        }
        if (!cancelled) {
          setRows(assets.filter((r) => allowedByKind(r.contentType, props.allowed)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "load_failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [props.draftId, props.allowed]);

  if (loading) return <p className="text-dim">Loading library…</p>;
  if (error) return <p className="banner danger">Could not load library: {error}</p>;
  if (rows.length === 0) {
    return (
      <p className="empty-card">
        No assets uploaded yet for this draft or the matching kinds. Switch
        to the Upload tab to add some.
      </p>
    );
  }
  return (
    <div className="asset-grid" style={{ maxHeight: "60vh", overflowY: "auto" }}>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          className="asset-card"
          style={{ textAlign: "left", background: "var(--surface)", cursor: "pointer" }}
          onClick={() =>
            props.onPick(rowToMediaRef(row))
          }
        >
          <div className="asset-thumb">
            {row.contentType.startsWith("video/") ? (
              <video src={row.publicUrl} muted playsInline />
            ) : (
              <img src={row.publicUrl} alt={row.altEn ?? row.altAr ?? ""} />
            )}
          </div>
          <div className="asset-meta">
            <span className="filename">{shortKey(row.key)}</span>
            <span>
              {row.contentType} · {formatBytes(row.bytes)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Upload tab
// ─────────────────────────────────────────────────────────────────────────

function UploadTab(props: {
  draftId: string;
  allowed: MediaKind[];
  onUploaded: (media: MediaRef) => void;
}) {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abortFn, setAbortFn] = useState<(() => void) | null>(null);

  async function onFile(file: File) {
    setError(null);
    setProgress(null);
    if (!allowedByKind(file.type, props.allowed)) {
      setError(`Unsupported file type "${file.type}" for this slot.`);
      return;
    }
    try {
      const result = await uploadFile({
        file,
        draftId: props.draftId,
        onProgress: setProgress,
        registerAbort: (fn) => setAbortFn(() => fn),
      });
      setProgress(null);
      setAbortFn(null);
      props.onUploaded(assetToMediaRef(result));
    } catch (err) {
      setProgress(null);
      setAbortFn(null);
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Upload cancelled.");
        return;
      }
      setError(err instanceof Error ? err.message : "upload_failed");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label
        className="btn"
        style={{
          padding: 24,
          border: "1px dashed var(--border)",
          background: "var(--bg-elev)",
          cursor: "pointer",
          flexDirection: "column",
          gap: 6,
          textAlign: "center",
        }}
      >
        <strong>Click to choose a file</strong>
        <span className="text-dim" style={{ fontSize: 12 }}>
          {allowedAccept(props.allowed)} · up to 50 MB
        </span>
        <input
          type="file"
          accept={allowedAcceptAttr(props.allowed)}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </label>
      {progress ? (
        <div className="upload-row">
          <span>
            {progress.fileName} — {Math.round(progress.percent)}%
            <button
              type="button"
              className="btn btn-small btn-danger"
              style={{ marginInlineStart: 8 }}
              onClick={() => abortFn?.()}
            >
              Cancel
            </button>
          </span>
          <div className="progress" aria-hidden>
            <span style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      ) : null}
      {error ? <p className="banner danger">{error}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────

function allowedByKind(contentType: string, allowed: MediaKind[]): boolean {
  const ct = contentType.toLowerCase();
  if (allowed.includes("video") && ct.startsWith("video/")) return true;
  if (allowed.includes("gif") && ct === "image/gif") return true;
  if (allowed.includes("image") && ct.startsWith("image/") && ct !== "image/gif") return true;
  // Treat gif as a subtype of image for the "image" slot too.
  if (allowed.includes("image") && ct === "image/gif") return true;
  return false;
}

function allowedAccept(allowed: MediaKind[]): string {
  const parts: string[] = [];
  if (allowed.includes("image")) parts.push("Images");
  if (allowed.includes("gif")) parts.push("GIFs");
  if (allowed.includes("video")) parts.push("Videos (mp4/webm)");
  return parts.join(", ");
}

function allowedAcceptAttr(allowed: MediaKind[]): string {
  const parts: string[] = [];
  if (allowed.includes("image")) parts.push("image/png,image/jpeg,image/webp,image/avif");
  if (allowed.includes("gif")) parts.push("image/gif");
  if (allowed.includes("video")) parts.push("video/mp4,video/webm");
  return parts.join(",");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function shortKey(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] ?? key;
}

function rowToMediaRef(row: AssetRow): MediaRef {
  const kind: MediaKind = row.contentType.startsWith("video/")
    ? "video"
    : row.contentType === "image/gif"
      ? "gif"
      : "image";
  return {
    kind,
    desktopSrc: row.publicUrl,
    alt: row.altEn ?? row.altAr ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    assetId: row.id,
  };
}

function assetToMediaRef(asset: {
  id: string;
  publicUrl: string;
  contentType: string;
  width: number | null;
  height: number | null;
  altAr: string | null;
  altEn: string | null;
}): MediaRef {
  const kind: MediaKind = asset.contentType.startsWith("video/")
    ? "video"
    : asset.contentType === "image/gif"
      ? "gif"
      : "image";
  return {
    kind,
    desktopSrc: asset.publicUrl,
    alt: asset.altEn ?? asset.altAr ?? undefined,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    assetId: asset.id,
  };
}
