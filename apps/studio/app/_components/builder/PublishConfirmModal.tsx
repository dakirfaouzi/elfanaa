"use client";

import { useEffect } from "react";
import { StatusIcon } from "../StatusIcon";

/**
 * PublishConfirmModal — explicit confirmation before a draft goes live.
 *
 * Sprint 1: publishing previously fired immediately once the client
 * validation gate passed — a single mis-click shipped a half-reviewed PDP
 * to live paid-social traffic. This modal forces an explicit confirm and
 * shows exactly WHAT is about to ship (title, draft id, language, number
 * of section images, destination).
 *
 * The publish logic itself is UNCHANGED — the parent calls its existing
 * publish routine from `onConfirm`. This component only gates it.
 *
 * Mirrors `AssetPickerDialog`'s overlay pattern (role=dialog, backdrop
 * click closes); adds Escape-to-cancel.
 */
export interface PublishConfirmModalProps {
  productTitle: string;
  draftId: string;
  languageLabel: string;
  imageCount: number;
  /** Sprint 3 — Image-QA review progress (non-blocking warning). */
  imagesReviewed: number;
  imagesTotal: number;
  destination: string;
  publishing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PublishConfirmModal(props: PublishConfirmModalProps) {
  const { onCancel, publishing } = props;
  const unreviewed = Math.max(0, props.imagesTotal - props.imagesReviewed);
  const hasUnreviewed = props.imagesTotal > 0 && unreviewed > 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !publishing) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, publishing]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm publish"
      onClick={(e) => {
        if (e.target === e.currentTarget && !publishing) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 9, 14, 0.78)",
        backdropFilter: "blur(6px)",
        zIndex: 55,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "8vh 16px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 18,
          width: "min(480px, 100%)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
              fontWeight: 700,
            }}
          >
            Confirm publish
          </span>
          <strong style={{ fontSize: 16 }}>Publish this draft to live?</strong>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            This makes the page publicly available on the storefront.
          </span>
        </header>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "8px 14px",
            margin: 0,
            fontSize: 13,
            alignItems: "baseline",
          }}
        >
          <SummaryRow label="Product">
            <span style={{ fontWeight: 600 }}>{props.productTitle}</span>
          </SummaryRow>
          <SummaryRow label="Draft id">
            <code className="code">{props.draftId}</code>
          </SummaryRow>
          <SummaryRow label="Language">{props.languageLabel}</SummaryRow>
          <SummaryRow label="Section images">
            {props.imageCount} {props.imageCount === 1 ? "image" : "images"}
          </SummaryRow>
          {props.imagesTotal > 0 ? (
            <SummaryRow label="Reviewed">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {props.imagesReviewed} / {props.imagesTotal}
              </span>
            </SummaryRow>
          ) : null}
          <SummaryRow label="Destination">
            <code className="code">{props.destination}</code>
          </SummaryRow>
        </dl>

        {hasUnreviewed ? (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 12.5,
              lineHeight: 1.45,
              color: "var(--warning)",
              background: "color-mix(in srgb, var(--warning) 12%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
            }}
          >
            <StatusIcon kind="warning" size={15} />
            <span style={{ color: "var(--text)" }}>
              <strong>
                {unreviewed} {unreviewed === 1 ? "image hasn’t" : "images haven’t"}{" "}
                been marked reviewed.
              </strong>{" "}
              You can still publish — this is only a reminder to QA the section
              images first.
            </span>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            paddingTop: 4,
          }}
        >
          <button
            type="button"
            className="btn btn-small"
            onClick={onCancel}
            disabled={publishing}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={props.onConfirm}
            disabled={publishing}
            style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <StatusIcon kind="published" />
            {publishing ? "Publishing…" : "Publish to live"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow(props: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={{ color: "var(--text-faint)", whiteSpace: "nowrap" }}>
        {props.label}
      </dt>
      <dd style={{ margin: 0, wordBreak: "break-word" }}>{props.children}</dd>
    </>
  );
}
