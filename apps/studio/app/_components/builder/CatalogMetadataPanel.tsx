"use client";

import { useMemo, useState } from "react";
import {
  emptyCatalogMetadata,
  type CatalogMetadata,
  type CatalogOfferTier,
} from "@platform/builder-schema";

/**
 * Catalog metadata panel (M12 / Step 2 / Phase 2.3).
 *
 * Renders the operator's view of the commerce shape that the publish
 * flow upserts into `storefront_catalog_product`. Mounted above the
 * section list in `BuilderClient` (Phase 2.3 decision 2 — always-
 * visible card).
 *
 * # Design choices
 *
 * - **Controlled inputs over local form state.** Each input dispatches
 *   `UPDATE_CATALOG_METADATA` on change. This keeps the panel in lock-
 *   step with the rest of the builder's autosave flow — operator edits
 *   here are recorded in the same `documentVersion` stream as section
 *   edits, so the draft saves in one round-trip.
 *
 * - **Major-unit input, minor-unit storage.** Operators type prices in
 *   major SAR (e.g. `199` for 199 SAR). The panel converts to minor
 *   units (`19_900`) at the input boundary so the schema never has to
 *   handle floats and the storefront-side merge logic in
 *   `apps/fanaa/lib/catalog/merge.ts` reads integers directly.
 *
 * - **Collapsible card.** Catalog metadata isn't always the operator's
 *   focus — when working on hero/copy, they want the section list
 *   front-and-center. A collapsed header keeps the panel discoverable
 *   without consuming vertical space.
 *
 * - **Conservative dropdowns.** Enum-like fields (productType / target
 *   / problems / collection) read from the schema-loose string column
 *   in the DB. The panel shows curated Fanaa taxonomy as dropdown
 *   options with a "Custom…" escape so future stores with different
 *   taxonomies can still type any value. Keep this list aligned with
 *   `apps/fanaa/lib/types.ts::ProductType / ProductTarget / ProductProblem`
 *   so the snapshot fallback matches the dropdown options exactly.
 */

/* -------------------------------------------------------------------------- */
/*                              Tier-A option sets                             */
/* -------------------------------------------------------------------------- */

const PRODUCT_TYPE_OPTIONS = [
  "serum",
  "cream",
  "mask",
  "oil",
  "capsules",
  "spray",
  "device",
  "bundle",
] as const;

const PRODUCT_TARGET_OPTIONS = ["women", "men", "unisex"] as const;

const PRODUCT_PROBLEM_OPTIONS = [
  "dark-spots",
  "dryness",
  "uneven-tone",
  "barrier-damage",
  "sensitive-skin",
  "oily-skin",
  "pores",
  "hair-damage",
  "hair-dryness",
  "breakage",
  "color-treated",
  "hair-loss",
  "complete-care",
] as const;

const COLLECTION_OPTIONS = [
  "best-sellers",
  "face",
  "body",
  "hair",
  "wellness",
] as const;

const CURRENCY_OPTIONS = ["SAR", "AED", "USD", "EUR", "KWD", "QAR", "BHD", "OMR"] as const;

/* -------------------------------------------------------------------------- */
/*                                  Component                                  */
/* -------------------------------------------------------------------------- */

export interface CatalogMetadataPanelProps {
  /**
   * The current catalog metadata. May be `undefined` for legacy drafts
   * created before Phase 2.3 — the panel auto-seeds an empty default
   * on the first mutation via the reducer's UPDATE_CATALOG_METADATA
   * branch, so we just render the empty shape here.
   */
  value: CatalogMetadata | undefined;
  /** Patch the catalog metadata (shallow merge into the document). */
  onPatch: (patch: Partial<CatalogMetadata>) => void;
  /** True when the draft is locked (file-only mode). */
  readOnly?: boolean;
}

export function CatalogMetadataPanel(props: CatalogMetadataPanelProps) {
  const meta: CatalogMetadata = props.value ?? emptyCatalogMetadata();
  const [collapsed, setCollapsed] = useState(false);

  const priceMajor = useMemo(() => minorToMajor(meta.priceMinor), [meta.priceMinor]);

  function disabled<T>(value: T): T | undefined {
    return props.readOnly ? undefined : value;
  }

  return (
    <div
      className="section-block"
      data-collapsed={collapsed}
      data-disabled={false}
      style={{ marginBottom: 4 }}
    >
      <div className="section-block-head">
        <span
          className="kind"
          style={{ color: "var(--accent)", letterSpacing: "0.18em" }}
        >
          CATALOG
        </span>
        <span className="title">Catalog metadata</span>
        <span
          className="tag"
          title={
            meta.priceMinor > 0
              ? "Catalog row will be upserted on publish."
              : "Set a price > 0 to enable storefront catalog publishing."
          }
          style={{ fontSize: 10 }}
        >
          {meta.priceMinor > 0
            ? `${priceMajor} ${meta.priceCurrency}`
            : "no price"}
        </span>
        <div className="actions">
          <button
            type="button"
            className="btn btn-small btn-icon"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand panel" : "Collapse panel"}
            title={collapsed ? "Expand panel" : "Collapse panel"}
          >
            {collapsed ? "▾" : "▴"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="builder-grid" style={{ padding: "12px 0 4px" }}>
          {/* Pricing row */}
          <div className="field-row">
            <NumberField
              label={`Price (major units, ${meta.priceCurrency})`}
              value={priceMajor}
              min={0}
              step={0.01}
              onChange={(v) =>
                props.onPatch({ priceMinor: majorToMinor(v ?? 0) })
              }
              disabled={props.readOnly}
              hint="Operators type 199 for 199 SAR. Stored as integer minor units."
            />
            <EnumField
              label="Currency"
              value={meta.priceCurrency}
              options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))}
              onChange={(v) => props.onPatch({ priceCurrency: v })}
              disabled={props.readOnly}
            />
          </div>

          <div className="field-row">
            <TextField
              label="SKU"
              value={meta.sku ?? ""}
              onChange={(v) => props.onPatch({ sku: nullableString(v) })}
              disabled={props.readOnly}
              hint="Operational SKU shown to warehouse / Aramex / accounting."
            />
            <TextField
              label="Landing path"
              value={meta.landingPath ?? ""}
              onChange={(v) =>
                props.onPatch({ landingPath: nullableString(v) })
              }
              disabled={props.readOnly}
              hint="Optional bespoke landing (e.g. /sugarbear). Must start with /."
            />
          </div>

          {/* Offer tiers */}
          <OfferTierList
            tiers={meta.offerTiers}
            currency={meta.priceCurrency}
            onChange={(tiers) =>
              disabled(props.onPatch({ offerTiers: tiers }))
            }
            readOnly={props.readOnly}
          />

          {/* Taxonomy row */}
          <div className="field-row">
            <ComboField
              label="Product type"
              value={meta.productType}
              options={PRODUCT_TYPE_OPTIONS}
              onChange={(v) => props.onPatch({ productType: v })}
              disabled={props.readOnly}
            />
            <ComboField
              label="Target audience"
              value={meta.target}
              options={PRODUCT_TARGET_OPTIONS}
              onChange={(v) => props.onPatch({ target: v })}
              disabled={props.readOnly}
            />
          </div>

          <div className="field-row">
            <ComboField
              label="Collection"
              value={meta.collection}
              options={COLLECTION_OPTIONS}
              onChange={(v) => props.onPatch({ collection: v })}
              disabled={props.readOnly}
              hint="Storefront grouping slug — drives /collections/<slug>."
            />
            <ChipMultiSelectField
              label="Problems addressed"
              values={meta.problems}
              options={PRODUCT_PROBLEM_OPTIONS}
              onChange={(values) => props.onPatch({ problems: values })}
              disabled={props.readOnly}
            />
          </div>

          {/* Badges */}
          <BadgeList
            badges={meta.badges}
            onChange={(badges) => props.onPatch({ badges })}
            readOnly={props.readOnly}
          />

          {/* Rating */}
          <div className="field-row">
            <NumberField
              label="Rating value (0–5)"
              value={meta.rating?.value ?? null}
              min={0}
              max={5}
              step={0.1}
              allowEmpty
              onChange={(v) => {
                if (v === null) {
                  props.onPatch({ rating: null });
                  return;
                }
                const count = meta.rating?.count ?? 0;
                props.onPatch({ rating: { value: v, count } });
              }}
              disabled={props.readOnly}
              hint="Leave blank to hide the rating widget on the PDP."
            />
            <NumberField
              label="Rating count"
              value={meta.rating?.count ?? null}
              min={0}
              step={1}
              allowEmpty
              onChange={(v) => {
                if (v === null) {
                  props.onPatch({ rating: null });
                  return;
                }
                const value = meta.rating?.value ?? 0;
                props.onPatch({
                  rating: { value, count: Math.round(v) },
                });
              }}
              disabled={props.readOnly || meta.rating === null}
            />
          </div>

          {/* Scarcity row */}
          <div className="field-row">
            <NumberField
              label="Stock left (display-only)"
              value={meta.stockLeft ?? null}
              min={0}
              step={1}
              allowEmpty
              onChange={(v) =>
                props.onPatch({
                  stockLeft: v === null ? null : Math.round(v),
                })
              }
              disabled={props.readOnly}
              hint='Drives "Only X left" badge. Display-only; does NOT gate inventory.'
            />
            <NumberField
              label="Recent buyers (display-only)"
              value={meta.recentBuyers ?? null}
              min={0}
              step={1}
              allowEmpty
              onChange={(v) =>
                props.onPatch({
                  recentBuyers: v === null ? null : Math.round(v),
                })
              }
              disabled={props.readOnly}
              hint='Drives "X people bought today" hint.'
            />
          </div>

          {/* Upsell ids */}
          <StringListField
            label="Upsell product ids"
            values={meta.upsellIds}
            onChange={(values) => props.onPatch({ upsellIds: values })}
            disabled={props.readOnly}
            hint="UniversalProduct ids / slugs to surface as cross-sells on this PDP."
          />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Sub-fields                                 */
/* -------------------------------------------------------------------------- */

function OfferTierList(props: {
  tiers: CatalogOfferTier[];
  currency: string;
  onChange: (tiers: CatalogOfferTier[]) => void;
  readOnly?: boolean;
}) {
  function patch(i: number, p: Partial<CatalogOfferTier>) {
    const next = props.tiers.map((t, idx) => (idx === i ? { ...t, ...p } : t));
    props.onChange(next);
  }
  function remove(i: number) {
    props.onChange(props.tiers.filter((_, idx) => idx !== i));
  }
  function add() {
    const nextQty =
      props.tiers.length === 0
        ? 1
        : Math.max(...props.tiers.map((t) => t.quantity)) + 1;
    props.onChange([
      ...props.tiers,
      {
        quantity: nextQty,
        total: { amount: 0, currency: props.currency },
      },
    ]);
  }
  return (
    <div className="field">
      <label>Offer tiers</label>
      <small
        style={{
          color: "var(--text-faint)",
          fontSize: 10,
          marginBottom: 4,
          display: "block",
        }}
      >
        Volume-pricing bundle. Totals are LINE totals (1×, 2×, 3× line
        price), not per-unit.
      </small>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {props.tiers.map((tier, i) => (
          <div
            key={`tier_${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 90px",
              gap: 8,
              alignItems: "end",
              border: "1px dashed var(--border)",
              borderRadius: 10,
              padding: 8,
            }}
          >
            <NumberField
              label="Qty"
              value={tier.quantity}
              min={1}
              max={99}
              step={1}
              onChange={(v) =>
                patch(i, { quantity: Math.max(1, Math.round(v ?? 1)) })
              }
              disabled={props.readOnly}
            />
            <NumberField
              label={`Bundle total (${tier.total.currency})`}
              value={minorToMajor(tier.total.amount)}
              min={0}
              step={0.01}
              onChange={(v) =>
                patch(i, {
                  total: {
                    amount: majorToMinor(v ?? 0),
                    currency: tier.total.currency,
                  },
                })
              }
              disabled={props.readOnly}
            />
            <button
              type="button"
              className="btn btn-small btn-icon btn-danger"
              onClick={() => remove(i)}
              aria-label="Remove tier"
              disabled={props.readOnly}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-small"
        onClick={add}
        disabled={props.readOnly}
        style={{ marginTop: 6 }}
      >
        + Add tier
      </button>
    </div>
  );
}

function BadgeList(props: {
  badges: CatalogMetadata["badges"];
  onChange: (badges: CatalogMetadata["badges"]) => void;
  readOnly?: boolean;
}) {
  function patch(i: number, p: Partial<CatalogMetadata["badges"][number]>) {
    props.onChange(
      props.badges.map((b, idx) => (idx === i ? { ...b, ...p } : b)),
    );
  }
  function remove(i: number) {
    props.onChange(props.badges.filter((_, idx) => idx !== i));
  }
  function add() {
    props.onChange([...props.badges, { ar: "", en: "" }]);
  }
  return (
    <div className="field">
      <label>Display badges</label>
      <small
        style={{
          color: "var(--text-faint)",
          fontSize: 10,
          marginBottom: 4,
          display: "block",
        }}
      >
        Short bilingual chips rendered on the PDP / product card (e.g.
        &ldquo;Best&nbsp;seller&rdquo;).
      </small>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {props.badges.map((badge, i) => (
          <div
            key={`badge_${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 40px",
              gap: 8,
              alignItems: "end",
              border: "1px dashed var(--border)",
              borderRadius: 10,
              padding: 8,
            }}
          >
            <TextField
              label="EN"
              value={badge.en}
              onChange={(v) => patch(i, { en: v })}
              disabled={props.readOnly}
            />
            <TextField
              label="AR"
              value={badge.ar}
              onChange={(v) => patch(i, { ar: v })}
              disabled={props.readOnly}
            />
            <button
              type="button"
              className="btn btn-small btn-icon btn-danger"
              onClick={() => remove(i)}
              aria-label="Remove badge"
              disabled={props.readOnly}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-small"
        onClick={add}
        disabled={props.readOnly}
        style={{ marginTop: 6 }}
      >
        + Add badge
      </button>
    </div>
  );
}

function StringListField(props: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  hint?: string;
  disabled?: boolean;
}) {
  function patch(i: number, v: string) {
    props.onChange(props.values.map((x, idx) => (idx === i ? v : x)));
  }
  function remove(i: number) {
    props.onChange(props.values.filter((_, idx) => idx !== i));
  }
  function add() {
    props.onChange([...props.values, ""]);
  }
  return (
    <div className="field">
      <label>{props.label}</label>
      {props.hint ? (
        <small
          style={{
            color: "var(--text-faint)",
            fontSize: 10,
            marginBottom: 4,
            display: "block",
          }}
        >
          {props.hint}
        </small>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {props.values.map((v, i) => (
          <div
            key={`up_${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 40px",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={v}
              onChange={(e) => patch(i, e.target.value)}
              disabled={props.disabled}
            />
            <button
              type="button"
              className="btn btn-small btn-icon btn-danger"
              onClick={() => remove(i)}
              aria-label="Remove"
              disabled={props.disabled}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-small"
        onClick={add}
        disabled={props.disabled}
        style={{ marginTop: 6 }}
      >
        + Add
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Inputs                                     */
/* -------------------------------------------------------------------------- */

function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      {props.hint ? <FieldHint hint={props.hint} /> : null}
      <input
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
      />
    </div>
  );
}

function NumberField(props: {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  allowEmpty?: boolean;
  onChange: (v: number | null) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      {props.hint ? <FieldHint hint={props.hint} /> : null}
      <input
        type="number"
        value={
          props.value === null || props.value === undefined ? "" : props.value
        }
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            if (props.allowEmpty) {
              props.onChange(null);
            } else {
              props.onChange(0);
            }
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) props.onChange(n);
        }}
        disabled={props.disabled}
      />
    </div>
  );
}

function EnumField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * `ComboField` — a select + custom-text escape hatch.
 *
 * The schema accepts any string for `productType` / `target` /
 * `collection` so future stores can ship their own taxonomies. The
 * dropdown shows Fanaa's canonical options for speed; selecting
 * "Custom…" reveals a free-text input that flows through unchanged.
 *
 * A null value renders as "(none)". Clearing the input emits `null`
 * so the storefront's hybrid loader falls back to the snapshot.
 */
function ComboField(props: {
  label: string;
  value: string | null;
  options: ReadonlyArray<string>;
  onChange: (v: string | null) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const inOptions = props.value === null || props.options.includes(props.value);
  const [customMode, setCustomMode] = useState(!inOptions);
  return (
    <div className="field">
      <label>{props.label}</label>
      {props.hint ? <FieldHint hint={props.hint} /> : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: customMode ? "1fr 90px" : "1fr",
          gap: 6,
          alignItems: "center",
        }}
      >
        {customMode ? (
          <input
            type="text"
            value={props.value ?? ""}
            placeholder="(custom)"
            onChange={(e) => {
              const v = e.target.value.trim();
              props.onChange(v.length > 0 ? v : null);
            }}
            disabled={props.disabled}
          />
        ) : (
          <select
            value={props.value ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              props.onChange(v === "" ? null : v);
            }}
            disabled={props.disabled}
          >
            <option value="">(none)</option>
            {props.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            setCustomMode((c) => !c);
            if (customMode) {
              // Leaving custom mode — if value isn't an option, clear it.
              if (props.value && !props.options.includes(props.value)) {
                props.onChange(null);
              }
            }
          }}
          disabled={props.disabled}
          title={customMode ? "Switch back to dropdown" : "Type a custom value"}
        >
          {customMode ? "List" : "Custom…"}
        </button>
      </div>
    </div>
  );
}

function ChipMultiSelectField(props: {
  label: string;
  values: string[];
  options: ReadonlyArray<string>;
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(opt: string) {
    if (props.values.includes(opt)) {
      props.onChange(props.values.filter((v) => v !== opt));
    } else {
      props.onChange([...props.values, opt]);
    }
  }
  return (
    <div className="field">
      <label>{props.label}</label>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          padding: "6px 0",
        }}
      >
        {props.options.map((opt) => {
          const active = props.values.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              className="btn btn-small"
              onClick={() => toggle(opt)}
              disabled={props.disabled}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                borderColor: active ? "var(--accent)" : "var(--border)",
                background: active
                  ? "color-mix(in oklab, var(--accent) 18%, transparent)"
                  : "transparent",
                color: active ? "var(--accent)" : undefined,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FieldHint({ hint }: { hint: string }) {
  return (
    <small
      style={{
        color: "var(--text-faint)",
        fontSize: 10,
        marginBottom: 4,
        display: "block",
      }}
    >
      {hint}
    </small>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Conversions                                  */
/* -------------------------------------------------------------------------- */

/**
 * Convert MAJOR currency units (operator-facing, e.g. `199`) into the
 * integer MINOR units the schema requires (`19_900`).
 *
 * Rounds to the nearest minor unit; the schema rejects floats so we
 * MUST round before handing the value over. Edge cases:
 *   • Empty / NaN → 0 (consistent with `priceMinor` default).
 *   • Negative → clamped to 0 — the schema's `nonnegative()` would
 *     reject it on next save otherwise.
 */
function majorToMinor(major: number): number {
  if (!Number.isFinite(major) || major < 0) return 0;
  return Math.max(0, Math.round(major * 100));
}

function minorToMajor(minor: number): number {
  if (!Number.isFinite(minor)) return 0;
  return Math.round(minor) / 100;
}

/**
 * Empty-string → null for nullable text fields. The schema accepts
 * `null` as "absent / use snapshot fallback"; an empty string would
 * trip Zod's `min(1)` on the field's inner content.
 */
function nullableString(v: string): string | null {
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}
