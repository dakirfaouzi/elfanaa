"use client";

import { useCallback, useId } from "react";
// Deep-import the metadata subpath — see TargetingControls.tsx for
// the full rationale. The root barrel pulls `node:fs` into the
// browser bundle and the webpack build fails.
import type { OfferTier } from "@platform/ingest/metadata";
import {
  baselinePerUnit,
  bundleMarginPercent,
  mostPopularTier,
  pricePerUnit,
  savingsPercentVsBaseline,
} from "@/lib/studio/intake/offer-math";

/**
 * Multi-tier offer / pricing-pack builder (Phase B4).
 *
 * # What this component does
 *
 * Lets operators define their offer ladder explicitly — one row
 * per tier (label + quantity + bundle price + "Most Popular"
 * radio) — with a live derivation panel showing:
 *
 *   • Per-unit price.
 *   • Savings % vs the single-unit baseline (or `priceHintMajor`
 *     when no single-unit tier exists yet).
 *   • Bundle margin % (when `landedCostPerUnit` is provided by
 *     the cost-breakdown card upstream).
 *   • Headline AOV (the "Most Popular" tier's `bundlePrice`).
 *
 * # Controlled state
 *
 * Parent owns the `OfferTier[]` state. Same pattern as
 * `TargetingControls` + `CostBreakdownCard`.
 *
 * # Default ladder
 *
 * The operator clicks "Add tier" to start building — we do NOT
 * pre-seed with a default 1/2/3 ladder because:
 *
 *   1. The publisher's existing default ladder synthesis still
 *      runs from `priceHint.amount` when `offers` is empty
 *      (Phase B is no-op vs current behaviour by design).
 *   2. Showing pre-filled rows the operator didn't author would
 *      muddy "did the operator make this choice or did the form?"
 *
 * # Most-popular radio behaviour
 *
 * Clicking the radio on a non-most-popular row PROMOTES that
 * row and demotes all others. Clicking the radio on the current
 * most-popular row CLEARS the flag entirely (no tier is
 * marked) — operator opt-out.
 */

interface OfferBuilderProps {
  value: OfferTier[];
  onChange: (next: OfferTier[]) => void;
  /** Currency suffix on price inputs + stat labels. */
  currency: string;
  /** Landed cost per unit from the cost-breakdown card. Drives
   *  the live margin % cell. Null when no cost components are
   *  populated yet — the margin column shows "—" in that case. */
  landedCostPerUnit: number | null;
  /** Fallback baseline for savings % when no single-unit tier
   *  exists. Null when the operator hasn't entered a price hint yet. */
  priceHintMajor: number | null;
}

export function OfferBuilder({
  value,
  onChange,
  currency,
  landedCostPerUnit,
  priceHintMajor,
}: OfferBuilderProps) {
  const tableId = useId();
  const baseline = baselinePerUnit(value, priceHintMajor);
  const popularTier = mostPopularTier(value);

  // ── Tier mutations ───────────────────────────────────────────────

  const updateTier = useCallback(
    (index: number, patch: Partial<OfferTier>) => {
      const next = value.map((t, i) => (i === index ? { ...t, ...patch } : t));
      onChange(next);
    },
    [value, onChange],
  );

  const removeTier = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const addTier = useCallback(() => {
    if (value.length >= 10) return;
    // Sensible defaults: quantity follows ordinal position
    // (1st tier → qty 1, 2nd → qty 2, etc.) so a fresh ladder
    // looks reasonable before the operator types anything.
    const nextQty = value.length + 1;
    const newTier: OfferTier = {
      id: `tier_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: nextQty === 1 ? "Single" : `${nextQty}-Pack`,
      quantity: nextQty,
      bundlePrice: 0,
    };
    onChange([...value, newTier]);
  }, [value, onChange]);

  const togglePopular = useCallback(
    (index: number) => {
      const current = value[index];
      if (!current) return;
      const wasFlagged = current.mostPopular === true;
      // Clearing if already flagged (operator opt-out); otherwise
      // demote others + promote this one.
      const next = value.map((t, i) => {
        if (i === index) {
          const copy = { ...t };
          if (wasFlagged) delete copy.mostPopular;
          else copy.mostPopular = true;
          return copy;
        }
        if (t.mostPopular) {
          const copy = { ...t };
          delete copy.mostPopular;
          return copy;
        }
        return t;
      });
      onChange(next);
    },
    [value, onChange],
  );

  // 8-column template reused by header AND every tier subgrid row,
  // so the table stays perfectly column-aligned while each row gets
  // independent styling (gradient / scale / ribbon on the popular
  // tier). CSS `subgrid` is the cleanest tool for this — broadly
  // supported (Chrome 117+, Safari 16+, Firefox 71+).
  const columnTemplate =
    "minmax(140px, 1.4fr) 80px minmax(110px, 1fr) 90px 90px 90px 78px 36px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── KPI promotion: AOV stat lifted from below the table to
         a primary callout above it. Operators look here first to
         see what the headline offer is — it deserves prominence. */}
      <AovStat
        popularTier={popularTier}
        currency={currency}
        baseline={baseline}
        landedCostPerUnit={landedCostPerUnit}
      />

      {value.length === 0 ? (
        <div
          className="text-faint"
          style={{
            fontSize: 12,
            padding: "20px 16px",
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius)",
            background: "color-mix(in srgb, var(--surface-2) 40%, transparent)",
            textAlign: "center",
            lineHeight: 1.55,
          }}
        >
          No offer tiers defined — the publisher will fall back to its default
          ladder from the unit price hint. Click <strong>+ Add tier</strong> to
          shape it explicitly.
        </div>
      ) : (
        <div
          role="table"
          aria-label="Offer tiers"
          id={tableId}
          style={{
            display: "grid",
            gridTemplateColumns: columnTemplate,
            rowGap: 8,
            columnGap: 6,
            alignItems: "center",
            fontSize: 12,
          }}
        >
          {/* Header row — 8 direct grid children, same column slots. */}
          <HeaderCell>Label</HeaderCell>
          <HeaderCell align="right">Qty</HeaderCell>
          <HeaderCell align="right">Bundle ({currency})</HeaderCell>
          <HeaderCell align="right">Per unit</HeaderCell>
          <HeaderCell align="right">Savings</HeaderCell>
          <HeaderCell align="right">Margin</HeaderCell>
          <HeaderCell align="center">Popular</HeaderCell>
          <HeaderCell />

          {value.map((tier, i) => {
            const perUnit = pricePerUnit(tier);
            const savings = savingsPercentVsBaseline(tier, baseline);
            const margin = bundleMarginPercent(tier, landedCostPerUnit);
            return (
              <TierRow
                key={tier.id ?? `idx_${i}`}
                tier={tier}
                index={i}
                perUnit={perUnit}
                savingsPercent={savings}
                marginPercent={margin}
                currency={currency}
                onUpdate={updateTier}
                onRemove={removeTier}
                onTogglePopular={togglePopular}
              />
            );
          })}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={addTier}
          disabled={value.length >= 10}
          style={{ fontSize: 12 }}
        >
          + Add tier {value.length >= 10 ? "(max 10)" : ""}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────

function HeaderCell({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <div
      role="columnheader"
      style={{
        fontSize: 10,
        color: "var(--text-dim)",
        fontWeight: 600,
        textTransform: "uppercase",
        textAlign: align,
        padding: "0 4px",
      }}
    >
      {children}
    </div>
  );
}

function TierRow(props: {
  tier: OfferTier;
  index: number;
  perUnit: number;
  savingsPercent: number | null;
  marginPercent: number | null;
  currency: string;
  onUpdate: (index: number, patch: Partial<OfferTier>) => void;
  onRemove: (index: number) => void;
  onTogglePopular: (index: number) => void;
}) {
  const isPopular = props.tier.mostPopular === true;

  // Margin-cell background tint — adds a subtle wash beneath the
  // existing colored text so the operator's eye lands on the
  // profitability column without reading every number.
  const marginCellTint = (() => {
    if (props.marginPercent === null) return undefined;
    if (props.marginPercent < 0) {
      return "color-mix(in srgb, var(--danger) 14%, transparent)";
    }
    if (props.marginPercent < 20) {
      return "color-mix(in srgb, var(--warning) 12%, transparent)";
    }
    if (props.marginPercent >= 30) {
      return "color-mix(in srgb, var(--success) 12%, transparent)";
    }
    return undefined;
  })();
  const marginCellColor =
    props.marginPercent !== null
      ? props.marginPercent >= 30
        ? "var(--success)"
        : props.marginPercent < 0
          ? "var(--danger)"
          : props.marginPercent < 20
            ? "var(--warning)"
            : undefined
      : undefined;

  // Popular-tier row wrapper — uses CSS subgrid so each row gets a
  // single layout box (for the gradient + ribbon + scale) while
  // staying perfectly column-aligned with the header row above. The
  // ribbon is an absolutely-positioned span anchored to the
  // wrapper's top-left; it overflows the row box deliberately.
  return (
    <div
      role="row"
      style={{
        gridColumn: "1 / -1",
        display: "grid",
        gridTemplateColumns: "subgrid",
        alignItems: "center",
        position: "relative",
        padding: isPopular ? "10px 8px 10px 14px" : "4px 0",
        borderRadius: "var(--radius)",
        border: isPopular
          ? "1px solid var(--accent)"
          : "1px solid transparent",
        background: isPopular
          ? "linear-gradient(90deg, color-mix(in srgb, var(--accent) 18%, transparent) 0%, color-mix(in srgb, var(--accent) 6%, transparent) 60%, transparent 100%)"
          : "transparent",
        boxShadow: isPopular
          ? "0 4px 18px -8px color-mix(in srgb, var(--accent) 55%, transparent)"
          : "none",
        transform: isPopular ? "scale(1.01)" : "scale(1)",
        transformOrigin: "left center",
        transition:
          "transform var(--transition-medium) var(--ease-out), background var(--transition-medium) var(--ease-out), border-color var(--transition-medium) var(--ease-out), box-shadow var(--transition-medium) var(--ease-out)",
      }}
    >
      {isPopular && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -10,
            left: 8,
            background: "var(--accent)",
            color: "var(--accent-fg, #0b0c10)",
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 999,
            boxShadow:
              "0 2px 10px -2px color-mix(in srgb, var(--accent) 60%, transparent)",
          }}
        >
          ★ Most Popular
        </span>
      )}
      <input
        type="text"
        value={props.tier.label}
        onChange={(e) => props.onUpdate(props.index, { label: e.target.value })}
        placeholder="Tier label"
        maxLength={80}
      />
      <input
        type="number"
        min={1}
        max={99}
        value={props.tier.quantity}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n))
            props.onUpdate(props.index, { quantity: Math.max(1, Math.floor(n)) });
        }}
        style={{ textAlign: "right" }}
      />
      <input
        type="number"
        min={0}
        step={0.01}
        value={props.tier.bundlePrice === 0 ? "" : props.tier.bundlePrice}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            props.onUpdate(props.index, { bundlePrice: 0 });
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n))
            props.onUpdate(props.index, { bundlePrice: Math.max(0, n) });
        }}
        placeholder="0.00"
        style={{ textAlign: "right" }}
      />
      <DerivedCell value={props.perUnit > 0 ? props.perUnit.toFixed(2) : "—"} />
      <DerivedCell
        value={
          props.savingsPercent !== null
            ? `${props.savingsPercent.toFixed(0)}%`
            : "—"
        }
        color={
          props.savingsPercent !== null && props.savingsPercent > 0
            ? "var(--success)"
            : undefined
        }
      />
      <DerivedCell
        value={
          props.marginPercent !== null
            ? `${props.marginPercent.toFixed(0)}%`
            : "—"
        }
        color={marginCellColor}
        backgroundTint={marginCellTint}
      />
      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          onClick={() => props.onTogglePopular(props.index)}
          title={isPopular ? "Unset most popular" : "Mark as most popular"}
          aria-pressed={isPopular}
          style={{
            background: isPopular ? "var(--accent)" : "transparent",
            color: isPopular ? "var(--accent-fg, #0b0c10)" : "var(--text-dim)",
            border: `1px solid ${isPopular ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 999,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            transition:
              "background var(--transition-fast) var(--ease-out), color var(--transition-fast) var(--ease-out), border-color var(--transition-fast) var(--ease-out)",
          }}
        >
          {isPopular ? "★ Popular" : "Set"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => props.onRemove(props.index)}
        className="btn btn-ghost"
        title="Remove tier"
        style={{ color: "var(--danger)", padding: "2px 6px", fontSize: 14 }}
      >
        ×
      </button>
    </div>
  );
}

function DerivedCell(props: {
  value: string;
  color?: string;
  /** Optional background tint that wraps the cell with a soft
   *  status colour — used on the Margin column to draw the eye. */
  backgroundTint?: string;
}) {
  return (
    <div
      style={{
        textAlign: "right",
        padding: props.backgroundTint ? "4px 8px" : "0 6px",
        fontVariantNumeric: "tabular-nums",
        color: props.color ?? "var(--text)",
        fontWeight: 600,
        background: props.backgroundTint,
        borderRadius: props.backgroundTint ? 6 : 0,
        transition:
          "background var(--transition-fast) var(--ease-out), color var(--transition-fast) var(--ease-out)",
      }}
    >
      {props.value}
    </div>
  );
}

function AovStat(props: {
  popularTier: OfferTier | null;
  currency: string;
  baseline: number | null;
  landedCostPerUnit: number | null;
}) {
  // Empty / no-popular state: keep a hint visible so the operator
  // knows the slot exists and what it'll surface once filled.
  if (!props.popularTier) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius)",
          background: "color-mix(in srgb, var(--surface-2) 40%, transparent)",
          fontSize: 12,
          color: "var(--text-dim)",
        }}
      >
        <span style={{ fontSize: 16, color: "var(--text-faint)" }}>★</span>
        <span>
          Mark a tier as <strong>★ Popular</strong> to set the headline AOV.
        </span>
      </div>
    );
  }

  const margin = bundleMarginPercent(
    props.popularTier,
    props.landedCostPerUnit,
  );
  const marginColor =
    margin === null
      ? "var(--text-dim)"
      : margin < 0
        ? "var(--danger)"
        : margin >= 30
          ? "var(--success)"
          : margin < 20
            ? "var(--warning)"
            : "var(--text)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "12px 16px",
        background:
          "linear-gradient(90deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent) 3%, transparent))",
        border: "1px solid color-mix(in srgb, var(--accent) 35%, var(--border))",
        borderRadius: "var(--radius)",
        transition:
          "background var(--transition-medium) var(--ease-out), border-color var(--transition-medium) var(--ease-out)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
            fontWeight: 700,
          }}
        >
          Estimated AOV
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 6,
            fontSize: 22,
            fontWeight: 700,
            color: "var(--accent)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          {props.popularTier.bundlePrice.toFixed(2)}
          <span
            style={{
              fontSize: 13,
              color: "var(--text-dim)",
              fontWeight: 600,
            }}
          >
            {props.currency}
          </span>
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
            fontWeight: 700,
          }}
        >
          Bundle margin
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: marginColor,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1,
          }}
        >
          {margin !== null ? `${margin.toFixed(0)}%` : "—"}
        </span>
      </div>
    </div>
  );
}
