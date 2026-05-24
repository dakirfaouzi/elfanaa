"use client";

import { useCallback, useId } from "react";
import type { OfferTier } from "@platform/ingest";
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {value.length === 0 ? (
        <div
          className="text-faint"
          style={{
            fontSize: 12,
            padding: "16px 12px",
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius-md, 8px)",
            textAlign: "center",
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
            gridTemplateColumns:
              "minmax(140px, 1.4fr) 80px minmax(110px, 1fr) 90px 90px 90px 60px 36px",
            gap: 6,
            alignItems: "center",
            fontSize: 12,
          }}
        >
          {/* Header row */}
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
          justifyContent: "space-between",
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

        <AovStat
          popularTier={popularTier}
          currency={currency}
          baseline={baseline}
          landedCostPerUnit={landedCostPerUnit}
        />
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

  return (
    <>
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
            ? `${props.savingsPercent > 0 ? "" : ""}${props.savingsPercent.toFixed(0)}%`
            : "—"
        }
        color={
          props.savingsPercent !== null && props.savingsPercent > 0
            ? "var(--accent)"
            : undefined
        }
      />
      <DerivedCell
        value={
          props.marginPercent !== null
            ? `${props.marginPercent.toFixed(0)}%`
            : "—"
        }
        color={
          props.marginPercent !== null
            ? props.marginPercent >= 30
              ? "var(--accent)"
              : props.marginPercent < 0
                ? "var(--danger)"
                : undefined
            : undefined
        }
      />
      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          onClick={() => props.onTogglePopular(props.index)}
          title={isPopular ? "Unset most popular" : "Mark as most popular"}
          aria-pressed={isPopular}
          style={{
            background: isPopular ? "var(--accent)" : "transparent",
            color: isPopular ? "var(--accent-fg, #000)" : "var(--text-dim)",
            border: `1px solid ${isPopular ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 999,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
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
    </>
  );
}

function DerivedCell(props: { value: string; color?: string }) {
  return (
    <div
      style={{
        textAlign: "right",
        padding: "0 6px",
        fontVariantNumeric: "tabular-nums",
        color: props.color ?? "var(--text)",
        fontWeight: 600,
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
  if (!props.popularTier) {
    return (
      <span className="text-faint" style={{ fontSize: 11 }}>
        Mark a tier as <strong>★ Popular</strong> to set the headline AOV.
      </span>
    );
  }
  const margin = bundleMarginPercent(
    props.popularTier,
    props.landedCostPerUnit,
  );
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "center",
        padding: "6px 12px",
        background: "color-mix(in srgb, var(--accent) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 30%, var(--border))",
        borderRadius: 999,
        fontSize: 12,
      }}
    >
      <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>
        ESTIMATED AOV
      </span>
      <span
        style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
      >
        {props.popularTier.bundlePrice.toFixed(2)} {props.currency}
      </span>
      {margin !== null && (
        <span
          style={{
            color: margin >= 30 ? "var(--accent)" : "var(--text-dim)",
            fontWeight: 600,
          }}
        >
          {margin.toFixed(0)}% margin
        </span>
      )}
    </div>
  );
}
