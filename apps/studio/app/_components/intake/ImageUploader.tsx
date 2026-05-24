"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  /** Held on the item itself so a Retry click can resubmit without
   *  re-prompting the operator (the <input type=file> dialog can't
   *  be opened programmatically a second time for the same file).
   *  This adds a per-pending-tile heap reference equal to the file
   *  size — bounded by `MAX_FILES * MAX_BYTES = 500 MB` worst case,
   *  in practice ~50 MB for typical 5-image intake batches. */
  file: File;
  /** Mirrors the full upload lifecycle.
   *
   *   • `presigning` — POST /api/.../presign in flight. No XHR yet,
   *     so progress is null.
   *   • `uploading`  — Presign succeeded, PUT to R2 in flight.
   *     `progress` updates 0→100 from XHR `upload.onprogress`.
   *   • `error`      — Either presign or PUT failed. `errorCode`
   *     drives the human-readable message in the UI.
   *
   * `uploaded` is intentionally NOT in the union: once an upload
   * completes the item is moved into `completed[]` and the pending
   * entry is removed. */
  status: "presigning" | "uploading" | "error";
  /** 0-100 once a PUT is in flight; null while presigning or errored. */
  progress: number | null;
  /** Populated when `status = error` — machine code from the server
   *  (e.g. `bucket_missing`, `presign_failed`, `r2_put_403`). Mapped
   *  to a human-readable string at render time. */
  errorCode?: string;
  /** Verbatim server reason where applicable (StorageError message,
   *  validation issues). Shown in the tile's expandable details. */
  errorDetail?: string;
  /** Server-side requestId from the presign route — printed next to
   *  the error so operators can correlate to log lines. */
  requestId?: string;
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
  // Lookup map: R2 key -> local blob URL. Populated when a pending
  // tile promotes to `completed`; lets `CompletedTile` render a
  // thumbnail straight from the operator's machine without a
  // round-trip back to R2. A `useRef` (not state) is fine because
  // every write to this map is immediately followed by a
  // `setCompleted` call — React's render reads the ref AFTER that
  // state update commits, so the new entry is always visible on
  // the next render. Revoked + cleared when the tile is removed
  // or the uploader unmounts.
  const previewBySrc = useRef<Map<string, string>>(new Map());

  // Cleanup: revoke every preview blob URL on unmount. Each
  // outstanding URL pins a reference to its underlying File in
  // browser memory; without this hook a long intake session
  // accumulates tens of MB per tab. Safe to run on unmount only —
  // per-tile removals already revoke their own URL eagerly.
  useEffect(() => {
    const registry = previewRegistry.current;
    const previews = previewBySrc.current;
    return () => {
      for (const url of registry) {
        URL.revokeObjectURL(url);
      }
      registry.clear();
      previews.clear();
    };
  }, []);

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

  // Single-shot error setter that records the machine code, the
  // (optional) server detail, and the (optional) requestId so the
  // tile can show a precise diagnostic. Reset `progress` to null
  // so the percentage overlay doesn't bleed through the error
  // overlay if the operator hammers Retry mid-PUT.
  const markPendingError = useCallback(
    (
      localId: string,
      errorCode: string,
      errorDetail?: string,
      requestId?: string,
    ) => {
      setPending((prev) =>
        prev.map((p) =>
          p.localId === localId
            ? {
                ...p,
                status: "error",
                progress: null,
                errorCode,
                errorDetail,
                requestId,
              }
            : p,
        ),
      );
    },
    [],
  );

  const uploadOne = useCallback(
    async (file: File, localId: string) => {
      // STEP 1 — presign request. Tile starts in `presigning` state
      // (set by caller). Don't touch progress here — it's null while
      // we wait for the round-trip.
      let presignBody: {
        presigned?: {
          url: string;
          headers: Record<string, string>;
          method: "PUT";
          ref: { key: string; bucket: string };
        };
        error?: string;
        reason?: string;
        requestId?: string;
        storeId?: string;
      };
      let serverRequestId: string | undefined;
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
        presignBody = (await presignRes.json()) as typeof presignBody;
        serverRequestId = presignBody?.requestId;
        if (!presignRes.ok) {
          markPendingError(
            localId,
            presignBody?.error ?? `presign_http_${presignRes.status}`,
            presignBody?.reason,
            serverRequestId,
          );
          return;
        }
      } catch (err) {
        // Network-level failure (CORS, DNS, offline). The server
        // never received the request so there's no requestId.
        markPendingError(
          localId,
          "presign_network",
          err instanceof Error ? err.message : undefined,
        );
        return;
      }

      const presigned = presignBody.presigned!;

      // STEP 2 — promote to `uploading` so the tile flips from
      // "Preparing…" to "0%" immediately, then direct PUT to R2 via
      // XHR (XHR gives us progress events; fetch() doesn't natively).
      setPending((prev) =>
        prev.map((p) =>
          p.localId === localId
            ? { ...p, status: "uploading", progress: 0 }
            : p,
        ),
      );
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
            // Promote pending → completed. Transfer the preview blob
            // URL into `previewBySrc` keyed by the just-minted R2
            // key so the CompletedTile can render an instant
            // thumbnail without a round-trip to R2. We deliberately
            // do NOT revoke here — the URL is revoked when the
            // operator removes the tile (`removeCompleted`) or the
            // component unmounts (effect above). Memory cost is
            // bounded by `MAX_FILES * MAX_BYTES` worst case, and is
            // already held for the in-flight tile anyway.
            setPending((prev) => {
              const dropped = prev.find((p) => p.localId === localId);
              if (dropped) {
                previewBySrc.current.set(presigned.ref.key, dropped.previewUrl);
              }
              return prev.filter((p) => p.localId !== localId);
            });
            setCompleted((prev) => {
              const next = [...prev, { src: presigned.ref.key }];
              onChange(next);
              return next;
            });
          } else {
            // R2 (or any S3-compatible) returns a small XML error
            // body. We surface the status code as the machine code
            // (`r2_put_403`, `r2_put_400` etc.) and a tiny excerpt
            // of the response text as detail so operators can spot
            // the AWS-style error code (e.g. SignatureDoesNotMatch).
            const detail = xhr.responseText
              ? xhr.responseText.slice(0, 240)
              : undefined;
            markPendingError(
              localId,
              `r2_put_${xhr.status}`,
              detail,
              serverRequestId,
            );
          }
          resolve();
        };
        xhr.onerror = () => {
          // Two near-indistinguishable failure modes funnel into
          // `xhr.onerror`:
          //
          //   1. CORS preflight rejection — by far the dominant cause
          //      on a freshly-deployed R2 bucket. R2 ships with NO
          //      CORS rules, and our PUT carries `Content-Type:
          //      image/...` which is NOT a CORS-safelisted value
          //      (only `text/plain`, `application/x-www-form-urlencoded`
          //      and `multipart/form-data` are safelisted), so the
          //      browser sends a preflight OPTIONS first. R2 answers
          //      it (often with 200) but WITHOUT the
          //      `Access-Control-Allow-Origin: https://elfanaa.com`
          //      header, so the browser refuses to fire the PUT.
          //
          //   2. Actual transport failure — DNS, TCP RST, TLS, network
          //      partition. Far rarer in practice (everything else in
          //      the page just worked, so name resolution is fine).
          //
          // The browser deliberately hides the distinction from JS
          // (the CORS error only appears in DevTools console) to avoid
          // leaking cross-origin response data. We can however use
          // `xhr.status === 0` to confirm "the response never reached
          // us" — true for both cases — and surface a CORS-leading
          // operator message via the dedicated `r2_put_blocked` code.
          //
          // When `xhr.status !== 0` (rare — can happen for certain
          // proxy timeouts that synthesise a status without a body)
          // we fall back to the more generic `r2_put_network`.
          const code =
            xhr.status === 0 ? "r2_put_blocked" : "r2_put_network";
          markPendingError(localId, code, undefined, serverRequestId);
          resolve();
        };
        xhr.send(file);
      });
    },
    [storeId, onChange, markPendingError],
  );

  // Re-run uploadOne for an errored pending item. Resets the entry
  // to `presigning` (clearing `errorCode` / `errorDetail`) so the
  // operator sees an immediate state change. The held File ref makes
  // this possible without re-prompting via the file picker.
  const retryPending = useCallback(
    (localId: string) => {
      let file: File | undefined;
      setPending((prev) => {
        const target = prev.find((p) => p.localId === localId);
        if (!target || target.status !== "error") return prev;
        file = target.file;
        return prev.map((p) =>
          p.localId === localId
            ? {
                ...p,
                status: "presigning",
                progress: null,
                errorCode: undefined,
                errorDetail: undefined,
                requestId: undefined,
              }
            : p,
        );
      });
      if (file) {
        void uploadOne(file, localId);
      }
    },
    [uploadOne],
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

      // Mint pending entries up-front so the UI shows a "Preparing…"
      // overlay immediately rather than looking dead while the
      // presign roundtrip happens. We hold the File ref on each
      // entry so the Retry button can resubmit without re-prompting
      // via the picker dialog.
      const newPending: PendingItem[] = accepted.map((file) => {
        const localId = `pend_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const previewUrl = URL.createObjectURL(file);
        previewRegistry.current.add(previewUrl);
        return {
          localId,
          previewUrl,
          filename: file.name,
          file,
          status: "presigning",
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
        const removed = prev[index];
        if (removed?.src) {
          // Revoke the thumbnail blob URL now that the tile is
          // going away. Skip silently if the entry never had a
          // local preview (e.g. items rehydrated from `initial`
          // by the parent form on first mount).
          const url = previewBySrc.current.get(removed.src);
          if (url) {
            URL.revokeObjectURL(url);
            previewBySrc.current.delete(removed.src);
            previewRegistry.current.delete(url);
          }
        }
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
              previewUrl={previewBySrc.current.get(item.src)}
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
              onRetry={() => retryPending(p.localId)}
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
  /** Local blob URL the operator's browser holds for the original
   *  file. When set, renders the actual image preview. When unset
   *  (e.g. items rehydrated from `initial` on first mount, before a
   *  presigned-GET thumbnail layer exists), falls back to the
   *  filename hint so the tile still says something useful. */
  previewUrl?: string;
  onMove: (index: number, delta: -1 | 1) => void;
  onSetPrimary: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  // Filename hint derived from the R2 key tail — used as the fallback
  // body when there's no local preview, and as the `alt` text on the
  // <img> for accessibility + DevTools inspection.
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
      {props.previewUrl ? (
        // Use a real <img> (not a background-image div) so the
        // browser can decode incrementally, respect the
        // `aspect-ratio` for layout-stable rendering, and report a
        // sensible alt to screen readers. `object-fit: cover` mirrors
        // the cropped-square look of the PendingTile preview so
        // there's zero visual jump at the promote-to-completed moment.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.previewUrl}
          alt={tailHint}
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "1",
            objectFit: "cover",
            background: "color-mix(in srgb, var(--text) 8%, transparent)",
          }}
        />
      ) : (
        // Fallback for items without a local blob (rare today,
        // common once intake drafts persist across reloads — a
        // future presigned-GET fetch can drop in right here).
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
      )}
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

/**
 * Map an internal machine error code to a short, operator-friendly
 * one-line message. The full machine code + server detail are still
 * shown below the message in monospace for ops triage.
 *
 * Keep this list in sync with:
 *   • Server side: app/api/studio/intake/assets/presign/route.ts
 *     (the `result.status` switch + thrown errors)
 *   • R2 / S3 PUT response codes the browser surfaces as `r2_put_<n>`.
 */
function humaniseUploadError(code: string | undefined): string {
  if (!code) return "Upload failed";
  switch (code) {
    case "bucket_missing":
      // The single most-encountered failure when first enabling R2.
      // Make the next-action explicit so an operator can fix it
      // without bothering an engineer.
      return "Storage misconfigured (no bucket for this store). Set R2_BUCKET_FANAA in EasyPanel → Environment Variables and restart the Studio service.";
    case "invalid_store_id":
      return "Unrecognised store. Refresh the page; if it persists, contact ops.";
    case "validation_failed":
      return "Upload rejected — file failed validation (size or content type).";
    case "presign_failed":
      return "Storage backend rejected the presign request. R2 credentials may be invalid.";
    case "presign_network":
      return "Network error while requesting the upload URL. Check your connection.";
    case "r2_put_blocked":
      // Specific to the xhr.status === 0 case — almost always CORS,
      // occasionally a TLS/DNS issue. Lead with the actionable fix
      // (CORS policy) and mention the alternative cause briefly.
      return "Browser blocked the upload (R2 CORS policy is likely missing or doesn't allow this origin). Apply the R2 CORS rule documented in docs/M10-MANUAL-SETUP.md, then retry.";
    case "r2_put_network":
      return "Transport error while uploading to storage. Retry usually works; if it persists, check R2 status.";
    case "r2_put_403":
      return "Storage rejected the upload (signature mismatch). Most often: R2 credentials were rotated server-side mid-upload.";
    case "r2_put_400":
      return "Storage rejected the upload (bad request). Check the file is a real image.";
    case "r2_put_413":
      return "File too large for storage policy.";
    default:
      if (code.startsWith("r2_put_"))
        return `Storage upload failed (HTTP ${code.slice(7)}).`;
      if (code.startsWith("presign_http_"))
        return `Presign request failed (HTTP ${code.slice(13)}).`;
      return "Upload failed";
  }
}

function PendingTile(props: {
  item: PendingItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const { item } = props;
  const isError = item.status === "error";
  const isPresigning = item.status === "presigning";
  const isUploading = item.status === "uploading";
  return (
    <div
      style={{
        position: "relative",
        border: `1px solid ${isError ? "var(--danger)" : "var(--border)"}`,
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
        {isPresigning && (
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
            Preparing…
          </div>
        )}
        {isUploading && (
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
        {isError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              color: "white",
              padding: 8,
              fontSize: 11,
              textAlign: "center",
              gap: 6,
              overflow: "hidden",
            }}
          >
            <div style={{ fontWeight: 600 }}>Upload failed</div>
            <div style={{ opacity: 0.92, lineHeight: 1.35 }}>
              {humaniseUploadError(item.errorCode)}
            </div>
            <div
              style={{
                opacity: 0.55,
                fontSize: 9,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, monospace",
                wordBreak: "break-all",
              }}
            >
              {item.errorCode ?? "unknown"}
              {item.requestId ? ` · req=${item.requestId}` : ""}
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          padding: 4,
          gap: 2,
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          justifyContent: "flex-end",
        }}
      >
        {isError && (
          <button
            type="button"
            onClick={props.onRetry}
            title="Retry upload"
            className="btn btn-ghost"
            style={{ ...tileBtnStyle, color: "var(--accent)", flex: 1 }}
          >
            ↻ Retry
          </button>
        )}
        <button
          type="button"
          onClick={props.onRemove}
          title={isError ? "Discard" : "Cancel / remove"}
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
