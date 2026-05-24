"use client";

import { useCallback, useId, useRef, useState } from "react";
import { studioPath } from "@/lib/base-path";

/**
 * Drag-and-drop multi-image uploader for the intake form.
 *
 * # What this component does
 *
 * Replaces the M9 "paste URLs in a textarea" UX with a modern
 * uploader that handles:
 *
 *   • Drag-and-drop (file → drop zone).
 *   • Click-to-browse (file picker).
 *   • Multi-file selection.
 *   • Live thumbnail preview from a local object URL.
 *   • Reorder via up/down buttons (keyboard-accessible, no DnD lib).
 *   • Primary-image selection (the FIRST item is primary; the
 *     "set primary" button reorders that image to position 0).
 *   • Delete.
 *   • Per-file upload progress + error states.
 *
 * # Contract with the parent form
 *
 * Calls `onChange(items)` whenever the list changes. `items` are
 * `{ src, alt? }` objects identical to the M9 textarea-derived
 * shape, so the IntakeForm doesn't change its payload structure.
 * `src` is the R2 key (e.g. `studio-intake/fanaa/01HZ.../...webp`)
 * once the upload completes; before that, the item lives in
 * `pending` state and is NOT included in `onChange`'s output.
 *
 * # Why no drag-and-drop reorder
 *
 * The two-button reorder (↑/↓) is keyboard- AND screen-reader-
 * accessible without adding a 30kB DnD library. The intake list
 * is typically 3-5 images; richer DnD pays off for 20+ items.
 *
 * # Why we DON'T persist the asset row here
 *
 * The Studio's asset-confirm flow (which writes `studio_asset`
 * rows) is draft-scoped. Intake uploads have no draft yet, so we
 * intentionally skip persistence — the R2 key is the only handle
 * the form needs. The eventual dispatch carries the key into the
 * `IngestJob.uploadedImages` field; the worker handles it from
 * there. Orphans (operator uploads then walks away) are GC'd by
 * the R2 lifecycle rule on the `studio-intake/` prefix.
 */

export interface IntakeImageItem {
  /** R2 key — populated once the upload PUT completes. */
  src: string;
  /** Optional alt text — operator hasn't been asked for this in
   *  Phase B1; future revisions may surface a small caption input. */
  alt?: string;
}

interface PendingItem {
  /** Local UUID for React keys. Unrelated to the R2 ULID. */
  localId: string;
  /** Local object URL for thumbnail render. Revoked on unmount /
   *  delete to prevent memory leak. */
  previewUrl: string;
  /** Original file name, for the delete-confirm tooltip. */
  filename: string;
  /** Mirrors XHR lifecycle. */
  status: "uploading" | "uploaded" | "error";
  /** 0-100 once a PUT is in flight; null before XHR starts. */
  progress: number | null;
  /** Populated once `status = uploaded`. */
  src?: string;
  /** Populated when `status = error`. */
  errorMessage?: string;
}

const ACCEPTED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
];
const ACCEPTED_HTML_ATTR = ACCEPTED_MIME.join(",");
const MAX_FILES = 10;
const MAX_BYTES = 50 * 1024 * 1024; // mirrors AssetUploadIntentSchema cap

interface ImageUploaderProps {
  storeId: string;
  /** Fires whenever the COMPLETED items list changes (uploaded only).
   *  In-flight uploads are not included; the form can't submit them. */
  onChange: (items: IntakeImageItem[]) => void;
  /** Optional initial items — supports re-rendering on form refresh. */
  initial?: IntakeImageItem[];
}

export function ImageUploader({
  storeId,
  onChange,
  initial = [],
}: ImageUploaderProps) {
  // Two lists: completed (have `src`) and pending (uploading / errored).
  // Kept separate because pending items have a different shape (local
  // preview URL, no R2 key yet) and shouldn't be in the parent's
  // payload until they finish.
  const [completed, setCompleted] = useState<IntakeImageItem[]>(initial);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track all preview blob URLs so we can revoke on cleanup —
  // unrevoked blob URLs leak per-tab until close.
  const previewRegistry = useRef<Set<string>>(new Set());

  // ── Helpers ──────────────────────────────────────────────────────

  const pushCompleted = useCallback(
    (next: IntakeImageItem[]) => {
      setCompleted(next);
      onChange(next);
    },
    [onChange],
  );

  const totalSlotsUsed = completed.length + pending.length;
  const slotsRemaining = Math.max(0, MAX_FILES - totalSlotsUsed);

  // ── Upload pipeline ──────────────────────────────────────────────

  const uploadOne = useCallback(
    async (file: File, localId: string) => {
      // STEP 1 — presign request.
      let presignBody;
      try {
        const presignRes = await fetch(
          studioPath("/api/studio/intake/assets/presign"),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              storeId,
              source: "upload",
              contentType: file.type,
              bytes: file.size,
            }),
          },
        );
        presignBody = await presignRes.json();
        if (!presignRes.ok) {
          throw new Error(
            presignBody?.error ?? `presign_http_${presignRes.status}`,
          );
        }
      } catch (err) {
        markPendingError(
          localId,
          err instanceof Error ? err.message : "presign_failed",
        );
        return;
      }

      const { presigned } = presignBody as {
        presigned: {
          url: string;
          headers: Record<string, string>;
          method: "PUT";
          ref: { key: string; bucket: string };
        };
      };

      // STEP 2 — direct PUT to R2 via XHR (XHR gives us progress
      // events; fetch() doesn't natively).
      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presigned.url);
        for (const [k, v] of Object.entries(presigned.headers)) {
          xhr.setRequestHeader(k, v);
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setPending((prev) =>
              prev.map((p) =>
                p.localId === localId ? { ...p, progress: pct } : p,
              ),
            );
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Promote pending → completed.
            setPending((prev) => prev.filter((p) => p.localId !== localId));
            setCompleted((prev) => {
              const next = [...prev, { src: presigned.ref.key }];
              onChange(next);
              return next;
            });
          } else {
            markPendingError(localId, `r2_put_${xhr.status}`);
          }
          resolve();
        };
        xhr.onerror = () => {
          markPendingError(localId, "r2_put_network");
          resolve();
        };
        xhr.send(file);
      });
    },
    [storeId, onChange],
  );

  const markPendingError = useCallback(
    (localId: string, message: string) => {
      setPending((prev) =>
        prev.map((p) =>
          p.localId === localId
            ? { ...p, status: "error", errorMessage: message }
            : p,
        ),
      );
    },
    [],
  );

  // ── File intake (from picker OR drop) ────────────────────────────

  const onFilesPicked = useCallback(
    (files: FileList | File[]) => {
      setGlobalError(null);
      const list = Array.from(files);
      // Filter + bounds-check up front so we don't half-process a batch.
      const accepted: File[] = [];
      const rejected: string[] = [];
      for (const file of list) {
        if (!ACCEPTED_MIME.includes(file.type)) {
          rejected.push(`${file.name}: unsupported type (${file.type})`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          rejected.push(
            `${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds 50 MB`,
          );
          continue;
        }
        accepted.push(file);
      }
      if (rejected.length > 0) {
        setGlobalError(rejected.join(" • "));
      }
      const overflow = Math.max(0, accepted.length - slotsRemaining);
      if (overflow > 0) {
        accepted.splice(slotsRemaining); // truncate
        setGlobalError(
          (prev) =>
            (prev ? prev + " • " : "") +
            `Only ${slotsRemaining} more slot${slotsRemaining === 1 ? "" : "s"} (max ${MAX_FILES} images total).`,
        );
      }

      // Mint pending entries up-front so the UI shows progress
      // immediately rather than waiting for the presign roundtrip.
      const newPending: PendingItem[] = accepted.map((file) => {
        const localId = `pend_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const previewUrl = URL.createObjectURL(file);
        previewRegistry.current.add(previewUrl);
        return {
          localId,
          previewUrl,
          filename: file.name,
          status: "uploading",
          progress: null,
        };
      });
      setPending((prev) => [...prev, ...newPending]);

      // Kick off uploads in parallel (R2 supports concurrent PUTs).
      accepted.forEach((file, i) => {
        const localId = newPending[i]!.localId;
        void uploadOne(file, localId);
      });
    },
    [slotsRemaining, uploadOne],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        onFilesPicked(e.dataTransfer.files);
      }
    },
    [onFilesPicked],
  );

  // ── List mutations on completed items ────────────────────────────

  const moveItem = useCallback(
    (index: number, delta: -1 | 1) => {
      setCompleted((prev) => {
        const target = index + delta;
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        const tmp = next[index]!;
        next[index] = next[target]!;
        next[target] = tmp;
        onChange(next);
        return next;
      });
    },
    [onChange],
  );

  const setPrimary = useCallback(
    (index: number) => {
      setCompleted((prev) => {
        if (index === 0) return prev;
        const next = [...prev];
        const [picked] = next.splice(index, 1);
        if (!picked) return prev;
        next.unshift(picked);
        onChange(next);
        return next;
      });
    },
    [onChange],
  );

  const removeCompleted = useCallback(
    (index: number) => {
      setCompleted((prev) => {
        const next = prev.filter((_, i) => i !== index);
        onChange(next);
        return next;
      });
    },
    [onChange],
  );

  const removePending = useCallback((localId: string) => {
    setPending((prev) => {
      const dropped = prev.find((p) => p.localId === localId);
      if (dropped) {
        URL.revokeObjectURL(dropped.previewUrl);
        previewRegistry.current.delete(dropped.previewUrl);
      }
      return prev.filter((p) => p.localId !== localId);
    });
  }, []);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        style={{
          padding: "28px 16px",
          border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius-lg)",
          background: dragOver
            ? "color-mix(in srgb, var(--accent) 8%, transparent)"
            : "color-mix(in srgb, var(--surface) 60%, transparent)",
          textAlign: "center",
          cursor: slotsRemaining > 0 ? "pointer" : "not-allowed",
          opacity: slotsRemaining > 0 ? 1 : 0.5,
          transition: "background 0.15s, border-color 0.15s",
        }}
        aria-disabled={slotsRemaining === 0}
      >
        <input
          id={fileInputId}
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_HTML_ATTR}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFilesPicked(e.target.files);
              e.target.value = ""; // allow re-picking the same file
            }
          }}
          style={{ display: "none" }}
        />
        <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>
          {slotsRemaining > 0
            ? "Drop images here or click to browse"
            : "Limit reached (10 images)"}
        </div>
        <div
          className="text-faint"
          style={{ fontSize: 11, marginTop: 4 }}
        >
          PNG, JPEG, WebP, GIF, AVIF · up to 50 MB each · {slotsRemaining} slot
          {slotsRemaining === 1 ? "" : "s"} left
        </div>
      </div>

      {globalError && (
        <div style={{ color: "var(--danger)", fontSize: 12 }}>
          {globalError}
        </div>
      )}

      {(completed.length > 0 || pending.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {completed.map((item, i) => (
            <CompletedTile
              key={item.src}
              item={item}
              index={i}
              isPrimary={i === 0}
              total={completed.length}
              onMove={moveItem}
              onSetPrimary={setPrimary}
              onRemove={removeCompleted}
            />
          ))}
          {pending.map((p) => (
            <PendingTile
              key={p.localId}
              item={p}
              onRemove={() => removePending(p.localId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tiles
// ─────────────────────────────────────────────────────────────────────────

function CompletedTile(props: {
  item: IntakeImageItem;
  index: number;
  isPrimary: boolean;
  total: number;
  onMove: (index: number, delta: -1 | 1) => void;
  onSetPrimary: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  // We render a small filename hint from the R2 key tail so the
  // operator can correlate tiles back to source files at a glance.
  const tailHint = props.item.src.split("/").pop() ?? "image";
  return (
    <div
      style={{
        position: "relative",
        border: `1px solid ${props.isPrimary ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius-md, 8px)",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      {/* Image refs are R2 keys (not URLs) so we cannot render the
          actual image without a presigned GET. For Phase B1 we show
          a generic placeholder; Phase B5 visual-polish adds the
          presigned-GET fetch for live thumbnails. */}
      <div
        style={{
          aspectRatio: "1",
          background: "color-mix(in srgb, var(--text) 8%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "var(--text-dim)",
          padding: 8,
          wordBreak: "break-all",
          textAlign: "center",
        }}
      >
        {tailHint}
      </div>
      {props.isPrimary && (
        <span
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            background: "var(--accent)",
            color: "var(--accent-fg, #000)",
            fontSize: 10,
            padding: "2px 6px",
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          Primary
        </span>
      )}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: 4,
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={() => props.onMove(props.index, -1)}
          disabled={props.index === 0}
          title="Move left"
          className="btn btn-ghost"
          style={tileBtnStyle}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => props.onMove(props.index, 1)}
          disabled={props.index === props.total - 1}
          title="Move right"
          className="btn btn-ghost"
          style={tileBtnStyle}
        >
          ↓
        </button>
        {!props.isPrimary && (
          <button
            type="button"
            onClick={() => props.onSetPrimary(props.index)}
            title="Set as primary image"
            className="btn btn-ghost"
            style={{ ...tileBtnStyle, flex: 1 }}
          >
            ★
          </button>
        )}
        <button
          type="button"
          onClick={() => props.onRemove(props.index)}
          title="Remove"
          className="btn btn-ghost"
          style={{ ...tileBtnStyle, color: "var(--danger)" }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function PendingTile(props: {
  item: PendingItem;
  onRemove: () => void;
}) {
  const { item } = props;
  return (
    <div
      style={{
        position: "relative",
        border: `1px solid ${item.status === "error" ? "var(--danger)" : "var(--border)"}`,
        borderRadius: "var(--radius-md, 8px)",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          aspectRatio: "1",
          background: `url(${item.previewUrl}) center/cover no-repeat, color-mix(in srgb, var(--text) 8%, transparent)`,
          position: "relative",
        }}
      >
        {item.status === "uploading" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {item.progress !== null ? `${item.progress}%` : "Uploading…"}
          </div>
        )}
        {item.status === "error" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              color: "white",
              padding: 8,
              fontSize: 11,
              textAlign: "center",
              gap: 4,
            }}
          >
            <div>Upload failed</div>
            <div style={{ opacity: 0.8, fontSize: 10 }}>
              {item.errorMessage}
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          padding: 4,
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={props.onRemove}
          title="Cancel / remove"
          className="btn btn-ghost"
          style={{ ...tileBtnStyle, color: "var(--danger)" }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

const tileBtnStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "2px 6px",
  minWidth: 24,
  lineHeight: 1,
};
