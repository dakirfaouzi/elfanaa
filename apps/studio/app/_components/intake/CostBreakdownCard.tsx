"use client";

import { useCallback, useId, useMemo } from "react";
// Deep-import the metadata subpath — see TargetingControls.tsx for
// the full rationale. The root `@platform/ingest` barrel pulls in
// `FileQueue` → `node:fs` and breaks the client bundle.
import type { CostBreakdown } from "@platform/ingest/metadata";
import {
  computeLandedCost,
  computeRealisedMarginPercent,
} from "@/lib/studio/intake/serialize-cost-breakdown";

/**
 * Structured cost breakdown card (Phase B3).
 *
 * Replaces the M9 "Margin notes" free-text input with a 5-field
 * structured editor (product / shipping / COD / packaging /
 * target margin %) plus a live "landed cost" + "realised margin"
 * panel that recalculates on every keystroke.
 *
 * # Controlled state
 *
 * The parent (IntakeForm) owns the `CostBreakdown` state — same
 * pattern as `TargetingControls`. This component never mutates
 * internal state; every input change calls `onChange` with the
 * full next object.
 *
 * # `priceHintMajor` for live preview
 *
 * Passed from the parent (which holds the form's controlled
 * price input). The live margin% preview is the operator's
 * primary feedback loop here — without it the breakdown is just
 * data entry. NULL when the price field is blank or invalid;
 * the preview gracefully hides in that case.
 *
 * # Why no currency conversion at the input
 *
 * Operators think in major units when planning margins ("supplier
 * is 4.20 USD"). MAJOR→MINOR conversion is applied at the
 * `priceHintMajor` field for the `priceHint.amount` field on
 * `IngestJob` — but the cost breakdown serialises to the
 * `marginNotes` string only, so no conversion is needed.
 */

interface CostBreakdownCardProps {
  value: CostBreakdown;
  onChange: (next: CostBreakdown) => void;
  /** Currency from the form's currency dropdown — drives the
   *  unit suffix on the inputs. */
  currency: string;
  /** Live price hint in MAJOR units — drives the realised-margin
   *  preview. Null when the input is blank / invalid. */
  priceHintMajor: number | null;
}

export function CostBreakdownCard({
  value,
  onChange,
  currency,
  priceHintMajor,
}: CostBreakdownCardProps) {
  const ids = {
    product: useId(),
    shipping: useId(),
    cod: useId(),
    packaging: useId(),
    targetMargin: useId(),
  };

  const update = useCallback(
    <K extends keyof CostBreakdown>(
      key: K,
      newVal: CostBreakdown[K] | undefined,
    ) => {
      const next: CostBreakdown = { ...value };
      if (newVal === undefined) {
        delete next[key];
      } else {
        next[key] = newVal;
      }
      onChange(next);
    },
    [value, onChange],
  );

  // ── Live preview math ──────────────────────────────────────────
  const landed = useMemo(() => computeLandedCost(value), [value]);
  const realisedMargin = useMemo(
    () => computeRealisedMarginPercent(priceHintMajor, landed),
    [priceHintMajor, landed],
  );
  const targetDelta =
    typeof value.targetMarginPercent === "number" && realisedMargin !== null
      ? realisedMargin - value.targetMarginPercent
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Input zone header — currency chip lifted out of each
         input label, so the four cost fields read cleanly without
         "(SAR)" repeated four times. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            fontWeight: 600,
          }}
        >
          Per-unit costs
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--text-dim)",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "var(--bg-elev)",
          }}
        >
          {currency}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <NumberField
          id={ids.product}
          label="Product cost"
          value={value.productCost}
          onChange={(n) => update("productCost", n)}
          step={0.01}
          min={0}
        />
        <NumberField
          id={ids.shipping}
          label="Shipping"
          value={value.shipping}
          onChange={(n) => update("shipping", n)}
          step={0.01}
          min={0}
        />
        <NumberField
          id={ids.cod}
          label="COD fee"
          value={value.codFee}
          onChange={(n) => update("codFee", n)}
          step={0.01}
          min={0}
          hint="Cash-on-delivery surcharge per order (common in GCC)."
        />
        <NumberField
          id={ids.packaging}
          label="Packaging"
          value={value.packaging}
          onChange={(n) => update("packaging", n)}
          step={0.01}
          min={0}
        />
        <NumberField
          id={ids.targetMargin}
          label="Target margin (%)"
          value={value.targetMarginPercent}
          onChange={(n) => update("targetMarginPercent", n)}
          step={1}
          min={0}
          max={95}
          hint="Desired gross margin. The preview compares to your live realised margin."
        />
      </div>

      <LivePreview
        currency={currency}
        landed={landed}
        realisedMargin={realisedMargin}
        targetDelta={targetDelta}
        target={value.targetMarginPercent}
        priceHintMajor={priceHintMajor}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Live preview panel
// ─────────────────────────────────────────────────────────────────────────

function LivePreview(props: {
  currency: string;
  landed: number | null;
  realisedMargin: number | null;
  targetDelta: number | null;
  target: number | undefined;
  priceHintMajor: number | null;
}) {
  // Nothing populated → render a thin placeholder so the slot
  // doesn't pop in/out as the operator types (avoids layout shift).
  const hasAnyMath = props.landed !== null || props.realisedMargin !== null;
  if (!hasAnyMath) {
    return (
      <div
        className="text-faint"
        style={{
          fontSize: 11,
          padding: "10px 14px",
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius)",
          background: "color-mix(in srgb, var(--surface-2) 40%, transparent)",
        }}
      >
        Fill any cost field above to see landed cost + realised margin.
      </div>
    );
  }

  // Profitability state drives the headline KPI's tint AND the
  // delta glyph. Order of precedence:
  //   1. If target is set + we're at/above → success
  //   2. If target is set + we're below     → danger (red)
  //   3. No target set + margin ≥ 30%       → success
  //   4. No target set + margin < 30%       → neutral (no tint)
  //   5. Negative margin                    → danger
  type KpiState = "neutral" | "success" | "warning" | "danger";
  const realisedState: KpiState = (() => {
    if (props.realisedMargin === null) return "neutral";
    if (props.realisedMargin < 0) return "danger";
    if (props.targetDelta !== null) {
      return props.targetDelta >= 0 ? "success" : "danger";
    }
    if (props.realisedMargin >= 30) return "success";
    if (props.realisedMargin < 15) return "warning";
    return "neutral";
  })();
  const deltaState: KpiState = (() => {
    if (props.targetDelta === null) return "neutral";
    return props.targetDelta >= 0 ? "success" : "danger";
  })();
  // ▲ / ▼ glyph for at-a-glance direction on the delta card.
  const deltaGlyph =
    props.targetDelta === null
      ? null
      : props.targetDelta >= 0
        ? "▲"
        : "▼";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          fontWeight: 600,
        }}
      >
        Live profitability
      </span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}
      >
        <KpiCard
          label="Landed cost"
          value={
            props.landed !== null
              ? props.landed.toFixed(2)
              : "—"
          }
          suffix={props.landed !== null ? props.currency : undefined}
          state="neutral"
        />
        <KpiCard
          label="Realised margin"
          value={
            props.realisedMargin !== null
              ? props.realisedMargin.toFixed(1)
              : "—"
          }
          suffix={props.realisedMargin !== null ? "%" : undefined}
          state={realisedState}
          hint={
            props.realisedMargin === null && props.landed !== null
              ? "Enter a unit price hint above"
              : undefined
          }
          emphasis
        />
        <KpiCard
          label={
            props.target !== undefined
              ? `vs target ${props.target}%`
              : "Target Δ"
          }
          value={
            props.targetDelta !== null
              ? `${props.targetDelta >= 0 ? "+" : ""}${props.targetDelta.toFixed(1)}`
              : "—"
          }
          suffix={props.targetDelta !== null ? "%" : undefined}
          glyph={deltaGlyph}
          state={deltaState}
        />
      </div>
    </div>
  );
}

function KpiCard(props: {
  label: string;
  value: string;
  suffix?: string;
  /** Optional direction glyph (▲ / ▼) rendered before the value. */
  glyph?: string | null;
  hint?: string;
  state: "neutral" | "success" | "warning" | "danger";
  /** When true: bigger numeric (the headline KPI). */
  emphasis?: boolean;
}) {
  // Map state → border-tint + accent-text triple. We deliberately
  // avoid filling the card background to keep the preview panel
  // visually quiet when nothing is wrong — the colour reads as
  // "status", not "alert".
  const palette = (() => {
    switch (props.state) {
      case "success":
        return {
          color: "var(--success)",
          border: "color-mix(in srgb, var(--success) 40%, var(--border))",
          tint: "color-mix(in srgb, var(--success) 8%, transparent)",
        };
      case "warning":
        return {
          color: "var(--warning)",
          border: "color-mix(in srgb, var(--warning) 40%, var(--border))",
          tint: "color-mix(in srgb, var(--warning) 8%, transparent)",
        };
      case "danger":
        return {
          color: "var(--danger)",
          border: "color-mix(in srgb, var(--danger) 40%, var(--border))",
          tint: "color-mix(in srgb, var(--danger) 8%, transparent)",
        };
      default:
        return {
          color: "var(--text)",
          border: "var(--border)",
          tint: "color-mix(in srgb, var(--surface-2) 50%, transparent)",
        };
    }
  })();
  const valueSize = props.emphasis ? 22 : 18;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        background: palette.tint,
        border: `1px solid ${palette.border}`,
        borderRadius: "var(--radius)",
        transition:
          "border-color var(--transition-medium) var(--ease-out), background var(--transition-medium) var(--ease-out)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          fontWeight: 600,
        }}
      >
        {props.label}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 4,
          fontSize: valueSize,
          fontWeight: 700,
          color: palette.color,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}
      >
        {props.glyph && (
          <span style={{ fontSize: valueSize * 0.7, lineHeight: 1 }}>
            {props.glyph}
          </span>
        )}
        {props.value}
        {props.suffix && (
          <span
            style={{
              fontSize: valueSize * 0.55,
              fontWeight: 600,
              color: "var(--text-dim)",
            }}
          >
            {props.suffix}
          </span>
        )}
      </span>
      {props.hint && (
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
          {props.hint}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Field primitive
// ─────────────────────────────────────────────────────────────────────────

function NumberField(props: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        htmlFor={props.id}
        style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}
      >
        {props.label}
      </label>
      <input
        id={props.id}
        type="number"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            props.onChange(undefined);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) props.onChange(n);
        }}
      />
      {props.hint && (
        <span className="text-faint" style={{ fontSize: 10 }}>
          {props.hint}
        </span>
      )}
    </div>
  );
}
