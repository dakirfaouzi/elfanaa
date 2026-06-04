"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaRef } from "@platform/builder-schema";
import type { BuilderAction } from "@platform/builder-state";
import { resolveAssetUrl } from "@/lib/studio/asset-url";
import { durableUploadRef } from "@/lib/studio/upload-ref";
import { uploadFile } from "./uploader";

/**
 * SectionImagesPanel — Draft Asset Review MVP.
 *
 * Lets the operator REVIEW and manually REPLACE the generated section images of
 * a draft BEFORE publishing, without leaving the Draft Editor and without
 * re-running generation.
 *
 * # Why a panel (not per-card controls)
 *
 * The storefront's section scenes (Ingredients / How-It-Works / Results /
 * Benefits / Social-Proof / Lifestyle) are NOT builder sections — they live in
 * the opaque `croContent.lifestyleImages[]` pool and are assigned to sections
 * at render time by `intent`. They therefore have no section card to host
 * controls. This panel surfaces that pool (plus the Hero, which IS a builder
 * `MediaRef`) as a single review surface.
 *
 * # Replacement = identical to generated
 *
 * Uploads reuse the existing presign→PUT→confirm pipeline (`uploadFile`) so the
 * bytes land on the same durable R2/CDN layer as generated assets. The renderer
 * resolves the resulting `src` exactly like a generated one — origin is
 * invisible downstream. Hero replacement dispatches `SET_SECTION_MEDIA`; scene
 * replacement dispatches `REPLACE_CRO_IMAGE` (preserving `intent`). Autosave
 * persists the draft; publish durability-gates every `src`.
 *
 * SCOPE: manual replacement only. No regenerate, no version history, no media
 * library — those are explicitly out of scope for this MVP.
 */

type CroImage = {
  src?: unknown;
  alt?: unknown;
  intent?: unknown;
  origin?: unknown;
  width?: unknown;
  height?: unknown;
};

export interface SectionImagesPanelProps {
  draftId: string;
  /** The opaque CRO bag from the draft document. */
  croContent: Record<string, unknown> | undefined;
  /** The hero builder section (kind === "hero"), if present. */
  heroSection: { id: string; media: MediaRef | null | undefined } | null;
  dispatch: React.Dispatch<BuilderAction>;
  readOnly?: boolean;
}

/** Map a scene's free-form `intent` to the storefront section it feeds. */
function sectionLabelForIntent(intent: string | undefined): string {
  const i = (intent ?? "").toLowerCase();
  if (!i) return "Lifestyle / section scene";
  if (/ingredient|detail|texture|swatch|macro/.test(i)) return "Ingredients";
  if (/mechanism|apply|applicat|step|usage|how/.test(i)) return "How It Works";
  if (/result|outcome|after|transform/.test(i)) return "Results";
  if (/benefit|problem|solution|concern|relief/.test(i)) return "Benefits";
  if (/proof|testimonial|customer|review/.test(i)) return "Social Proof";
  if (/context|lifestyle|home/.test(i)) return "Lifestyle";
  return "Section scene";
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

/** The minimal, validated descriptor a card hands to `apply`. */
interface ResolvedUpload {
  src: string;
  assetId: string;
  width?: number;
  height?: number;
}

/** A single reviewable asset, abstracting hero (MediaRef) vs scene (CroImage). */
interface ReviewItem {
  key: string;
  label: string;
  previewSrc: string;
  replaced: boolean;
  apply: (upload: ResolvedUpload) => void;
}

export function SectionImagesPanel(
  props: SectionImagesPanelProps,
): React.ReactElement | null {
  const { dispatch } = props;

  const items = useMemo<ReviewItem[]>(() => {
    const out: ReviewItem[] = [];

    // Hero — a builder MediaRef. Replacement → SET_SECTION_MEDIA.
    if (props.heroSection) {
      const hero = props.heroSection;
      const src = hero.media?.desktopSrc ?? "";
      out.push({
        key: `hero:${hero.id}`,
        label: "Hero",
        previewSrc: resolveAssetUrl(src),
        replaced: false,
        apply: (upload) => {
          const media: MediaRef = {
            kind: "image",
            desktopSrc: upload.src,
            assetId: upload.assetId,
            ...(upload.width ? { width: upload.width } : {}),
            ...(upload.height ? { height: upload.height } : {}),
            ...(hero.media?.alt ? { alt: hero.media.alt } : {}),
          };
          dispatch({
            type: "SET_SECTION_MEDIA",
            sectionId: hero.id,
            slot: "media",
            media,
          });
        },
      });
    }

    // Generated scene pool — croContent.lifestyleImages[]. Replacement →
    // REPLACE_CRO_IMAGE (preserves intent so section assignment is unchanged).
    const pool = props.croContent?.lifestyleImages;
    if (Array.isArray(pool)) {
      pool.forEach((raw, index) => {
        const img = (raw ?? {}) as CroImage;
        const intent = asString(img.intent);
        const replaced = asString(img.origin) === "operator";
        out.push({
          key: `scene:${index}`,
          label: `${sectionLabelForIntent(intent)}${intent ? ` · ${intent}` : ""}`,
          previewSrc: resolveAssetUrl(asString(img.src) ?? ""),
          replaced,
          apply: (upload) => {
            dispatch({
              type: "REPLACE_CRO_IMAGE",
              bag: "lifestyleImages",
              index,
              src: upload.src,
              ...(upload.width ? { width: upload.width } : {}),
              ...(upload.height ? { height: upload.height } : {}),
            });
          },
        });
      });
    }

    return out;
  }, [props.heroSection, props.croContent, dispatch]);

  const [collapsed, setCollapsed] = useState(false);
  // Lightbox holds only the already-resolved preview URL + label — it
  // reuses the same `src` the card renders, so there is no image-data
  // duplication (no re-fetch, no re-upload, no copy of bytes).
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(
    null,
  );

  if (items.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: 14 }}>Section Images</strong>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            Review the generated images and replace any bad ones before publishing.
          </span>
        </div>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      {collapsed ? null : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          {items.map((item) => (
            <ReviewCard
              key={item.key}
              item={item}
              draftId={props.draftId}
              readOnly={props.readOnly}
              onZoom={(src, label) => setLightbox({ src, label })}
            />
          ))}
        </div>
      )}

      <ImageLightbox value={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

/**
 * ImageLightbox — full-size preview overlay.
 *
 * Reuses the card's already-resolved `src` (no data duplication). Closes
 * on Escape and on backdrop click. The image is `object-fit: contain` so
 * the FULL image is visible regardless of aspect ratio.
 */
function ImageLightbox(props: {
  value: { src: string; label: string } | null;
  onClose: () => void;
}): React.ReactElement | null {
  const { value, onClose } = props;

  useEffect(() => {
    if (!value) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onClose]);

  if (!value) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${value.label}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 9, 14, 0.88)",
        backdropFilter: "blur(6px)",
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "4vh 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "min(1100px, 100%)",
        }}
      >
        <span style={{ fontSize: 12, color: "#e7e7ea", wordBreak: "break-word" }}>
          {value.label}
        </span>
        <button
          type="button"
          className="btn btn-small"
          onClick={onClose}
          aria-label="Close preview"
        >
          Close
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={value.src}
        alt={value.label}
        style={{
          maxWidth: "min(1100px, 100%)",
          maxHeight: "82vh",
          objectFit: "contain",
          borderRadius: 12,
          boxShadow: "0 24px 64px -24px rgba(0,0,0,0.7)",
        }}
      />
    </div>
  );
}

function ReviewCard(props: {
  item: ReviewItem;
  draftId: string;
  readOnly?: boolean;
  onZoom: (src: string, label: string) => void;
}): React.ReactElement {
  const { item } = props;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const upload = await uploadFile({ file, draftId: props.draftId });
      const src = durableUploadRef(upload);
      // Diagnostics for the replace pipeline (presign/PUT/confirm happen inside
      // uploadFile and throw on failure; this logs the confirm result + the ref
      // we will persist, which is the step that previously broke silently).
      // eslint-disable-next-line no-console
      console.debug("[SectionImages] replace", {
        label: item.label,
        confirmedKey: upload.key,
        confirmedPublicUrl: upload.publicUrl,
        storedSrc: src,
      });
      if (!src) {
        // Never write the non-fetchable r2:// sentinel (or an empty ref) — that
        // is the bug that produced a blank/broken preview that never persisted.
        throw new Error(
          `upload_returned_no_usable_ref (key="${upload.key}", publicUrl="${upload.publicUrl}")`,
        );
      }
      item.apply({
        src,
        assetId: upload.id,
        width: upload.width ?? undefined,
        height: upload.height ?? undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 8,
        background: "var(--bg)",
      }}
    >
      <div
        role={item.previewSrc ? "button" : undefined}
        tabIndex={item.previewSrc ? 0 : undefined}
        aria-label={item.previewSrc ? `Open large preview: ${item.label}` : undefined}
        onClick={
          item.previewSrc
            ? () => props.onZoom(item.previewSrc, item.label)
            : undefined
        }
        onKeyDown={
          item.previewSrc
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onZoom(item.previewSrc, item.label);
                }
              }
            : undefined
        }
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 5",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--bg-elev)",
          cursor: item.previewSrc ? "zoom-in" : "default",
        }}
      >
        {item.previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.previewSrc}
            alt={item.label}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "var(--text-faint)",
            }}
          >
            No image
          </div>
        )}
        {item.replaced ? (
          <span
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 6,
              background: "var(--accent, #2563eb)",
              color: "#fff",
            }}
          >
            Replaced
          </span>
        ) : null}
      </div>

      <span
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          wordBreak: "break-word",
        }}
      >
        {item.label}
      </span>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="btn btn-small"
        disabled={busy || props.readOnly}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? "Uploading…" : "Replace Image"}
      </button>
      {error ? (
        <span style={{ fontSize: 10, color: "var(--danger, #dc2626)" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
