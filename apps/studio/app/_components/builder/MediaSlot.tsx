"use client";

import { useState } from "react";
import type { MediaKind, MediaRef } from "@platform/builder-schema";
import { AssetPickerDialog } from "./AssetPickerDialog";

/**
 * MediaSlot — the "media field" used by every section editor.
 *
 * Renders:
 *
 *   • a thumbnail when `media` is non-null
 *   • a placeholder + "Pick from library / Upload new" buttons otherwise
 *
 * Clicking either button opens `AssetPickerDialog`, which is the
 * shared modal for browsing existing R2 assets and triggering a new
 * upload. The dialog calls back with a `MediaRef` (or `null` for
 * clear), which we forward to the section reducer via `onChange`.
 *
 * # `allowed` prop
 *
 * Sections restrict what media kinds they accept:
 *   • Hero        → image | gif | video
 *   • Gallery     → image | gif
 *   • Video       → video only
 *   • BeforeAfter → image | gif
 *
 * The picker filters the visible library by these kinds and rejects
 * uploads that fall outside the allowed set.
 */

export interface MediaSlotProps {
  draftId: string;
  label: string;
  media: MediaRef | null | undefined;
  allowed: MediaKind[];
  /** When true the operator can't clear the slot. */
  required?: boolean;
  onChange: (media: MediaRef | null) => void;
}

export function MediaSlot(props: MediaSlotProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <div className="field">
      <label>{props.label}</label>
      {props.media ? (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <MediaThumb media={props.media} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              flex: 1,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.12 }}>
              {props.media.kind}
            </span>
            <code
              style={{
                fontSize: 11,
                color: "var(--text-faint)",
                wordBreak: "break-all",
              }}
            >
              {props.media.desktopSrc}
            </code>
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setOpen(true)}
              >
                Change
              </button>
              {!props.required ? (
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => props.onChange(null)}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 8,
            padding: 14,
            border: "1px dashed var(--border)",
            borderRadius: 12,
            background: "var(--bg-elev)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            No media attached.
          </span>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setOpen(true)}
          >
            Pick or upload media
          </button>
        </div>
      )}
      {open ? (
        <AssetPickerDialog
          draftId={props.draftId}
          allowed={props.allowed}
          onClose={() => setOpen(false)}
          onPick={(ref) => {
            props.onChange(ref);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MediaThumb(props: { media: MediaRef }) {
  const { media } = props;
  if (media.kind === "video") {
    return (
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 10,
          overflow: "hidden",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <video
          src={media.desktopSrc}
          poster={media.poster}
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }
  return (
    <img
      src={media.desktopSrc}
      alt={media.alt ?? ""}
      style={{
        width: 96,
        height: 96,
        objectFit: "cover",
        borderRadius: 10,
        background: "var(--bg)",
      }}
    />
  );
}
