"use client";

import { useCallback, useId, useMemo } from "react";
import type { CostBreakdown } from "@platform/ingest";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <NumberField
          id={ids.product}
          label={`Product cost (${currency})`}
          value={value.productCost}
          onChange={(n) => update("productCost", n)}
          step={0.01}
          min={0}
        />
        <NumberField
          id={ids.shipping}
          label={`Shipping (${currency})`}
          value={value.shipping}
          onChange={(n) => update("shipping", n)}
          step={0.01}
          min={0}
        />
        <NumberField
          id={ids.cod}
          label={`COD fee (${currency})`}
          value={value.codFee}
          onChange={(n) => update("codFee", n)}
          step={0.01}
          min={0}
          hint="Cash-on-delivery surcharge per order (common in GCC)."
        />
        <NumberField
          id={ids.packaging}
          label={`Packaging (${currency})`}
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
          padding: "8px 12px",
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius-md, 8px)",
        }}
      >
        Fill any cost field above to see landed cost + realised margin.
      </div>
    );
  }

  // Colour-code the delta — green when at/above target, red below.
  const deltaColor =
    props.targetDelta === null
      ? "var(--text-dim)"
      : props.targetDelta >= 0
        ? "var(--accent)"
        : "var(--danger)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
        padding: 10,
        background: "color-mix(in srgb, var(--accent) 4%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 25%, var(--border))",
        borderRadius: "var(--radius-md, 8px)",
      }}
    >
      <Stat
        label="Landed cost"
        value={
          props.landed !== null
            ? `${props.landed.toFixed(2)} ${props.currency}`
            : "—"
        }
      />
      <Stat
        label="Realised margin"
        value={
          props.realisedMargin !== null
            ? `${props.realisedMargin.toFixed(1)}%`
            : "—"
        }
        hint={
          props.realisedMargin === null && props.landed !== null
            ? "Enter a unit price hint above"
            : undefined
        }
      />
      <Stat
        label={
          props.target !== undefined ? `vs target ${props.target}%` : "Target Δ"
        }
        value={
          props.targetDelta !== null
            ? `${props.targetDelta >= 0 ? "+" : ""}${props.targetDelta.toFixed(1)}%`
            : "—"
        }
        valueColor={deltaColor}
      />
    </div>
  );
}

function Stat(props: {
  label: string;
  value: string;
  hint?: string;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}
      >
        {props.label.toUpperCase()}
      </span>
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: props.valueColor ?? "var(--text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {props.value}
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
