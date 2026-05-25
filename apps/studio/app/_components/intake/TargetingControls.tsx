"use client";

import { useCallback, useId } from "react";
// Deep-import the metadata subpath rather than the root barrel.
// The root `@platform/ingest` barrel re-exports `FileQueue`, which
// transitively imports `node:fs` / `node:path` / `node:fs/promises`.
// Pulling that graph into a `"use client"` component fails the
// webpack build with `UnhandledSchemeError: node:fs` because the
// browser bundler can't resolve Node built-in schemes. The
// `@platform/ingest/metadata` subpath (declared in the ingest
// package.json `exports` map) gives us exactly the schemas /
// const arrays / types we need with zero Node-runtime dependencies.
import {
  AWARENESS_VALUES,
  EMOTIONAL_ANGLE_VALUES,
  GENDER_VALUES,
  PRIMARY_LANGUAGE_VALUES,
  SOPHISTICATION_VALUES,
  TONE_STYLE_VALUES,
  type AwarenessValue,
  type EmotionalAngleValue,
  type GenderValue,
  type PrimaryLanguageValue,
  type SophisticationValue,
  type Targeting,
  type ToneStyleValue,
} from "@platform/ingest/metadata";
import {
  AWARENESS_LABELS,
  EMOTIONAL_ANGLE_LABELS,
  GENDER_LABELS,
  MARKET_LABELS,
  PRIMARY_LANGUAGE_LABELS,
  SOPHISTICATION_LABELS,
  TONE_STYLE_LABELS,
} from "@/lib/studio/intake/targeting-options";
import {
  TARGETING_PRESETS,
  isPresetActive,
  togglePreset,
  type TargetingPreset,
} from "@/lib/studio/intake/targeting-presets";
import {
  TargetingSelect,
  type TargetingSelectOption,
} from "./TargetingSelect";

/**
 * Structured audience-targeting controls (Phase B2).
 *
 * # What this component does
 *
 * Renders an 8-field grid of custom dropdowns + range inputs that
 * populate the `Targeting` object on `IngestJob.intakeMetadata`.
 * Every field is OPTIONAL — operators may pick zero, some, or
 * all.
 *
 * # Controlled vs uncontrolled
 *
 * Controlled. The parent IntakeForm owns the state (so it can
 * mirror it into the submit payload). This component never
 * mutates state internally; every change goes through `onChange`.
 *
 * # Why a custom <TargetingSelect> instead of native <select>
 *
 * Native `<select>` option lists are styled by the OS, not the
 * page — `<option>` padding / hover / typography are not
 * authorable. The Audience polish pass demanded taller option
 * rows, clearer hover state, contextual placeholders and a clear-
 * selection affordance, none of which are reachable with a native
 * select. See `TargetingSelect.tsx` for the contract; the
 * value-mapping here is straightforward — `undefined` from the
 * select means "clear this key", everything else is a typed enum
 * value cast to the matching schema field.
 */

interface TargetingControlsProps {
  value: Targeting;
  onChange: (next: Targeting) => void;
}

export function TargetingControls({ value, onChange }: TargetingControlsProps) {
  const ids = {
    gender: useId(),
    market: useId(),
    lang: useId(),
    ageMin: useId(),
    ageMax: useId(),
    awareness: useId(),
    sophistication: useId(),
    angle: useId(),
    tone: useId(),
  };

  // Helper: produce an updater that sets a single key, removing
  // it entirely (not just `= undefined`) when the operator picks
  // "— No preference —". Keeping the object lean makes the
  // serialised JSON in IngestJob easier to scan in run records.
  const update = useCallback(
    <K extends keyof Targeting>(key: K, newVal: Targeting[K] | undefined) => {
      const next: Targeting = { ...value };
      if (newVal === undefined) {
        delete next[key];
      } else {
        next[key] = newVal;
      }
      onChange(next);
    },
    [value, onChange],
  );

  // Preset toggle handler — delegates to the pure helper in
  // `targeting-presets.ts` so the behaviour (merge / toggle-off /
  // preserve manual edits) is unit-tested independently of React.
  const onTogglePreset = useCallback(
    (preset: TargetingPreset) => {
      onChange(togglePreset(value, preset));
    },
    [value, onChange],
  );

  // Pre-build option lists once per render — cheap (tiny arrays) and
  // keeps the JSX block below readable.
  const genderOptions: TargetingSelectOption[] = GENDER_VALUES.map((v) => ({
    value: v,
    label: GENDER_LABELS[v],
  }));
  const marketOptions: TargetingSelectOption[] = Object.entries(
    MARKET_LABELS,
  ).map(([code, label]) => ({ value: code, label: `${code} — ${label}` }));
  const langOptions: TargetingSelectOption[] = PRIMARY_LANGUAGE_VALUES.map(
    (v) => ({ value: v, label: PRIMARY_LANGUAGE_LABELS[v] }),
  );
  const awarenessOptions: TargetingSelectOption[] = AWARENESS_VALUES.map(
    (v) => ({ value: v, label: AWARENESS_LABELS[v] }),
  );
  const sophisticationOptions: TargetingSelectOption[] =
    SOPHISTICATION_VALUES.map((v) => ({
      value: v,
      label: SOPHISTICATION_LABELS[v],
    }));
  const angleOptions: TargetingSelectOption[] = EMOTIONAL_ANGLE_VALUES.map(
    (v) => ({ value: v, label: EMOTIONAL_ANGLE_LABELS[v] }),
  );
  const toneOptions: TargetingSelectOption[] = TONE_STYLE_VALUES.map((v) => ({
    value: v,
    label: TONE_STYLE_LABELS[v],
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Preset chips row ──────────────────────────────────────
         Six one-click bundles for the highest-frequency operator
         archetypes. Composable (clicking two chips merges both
         pick sets); active chips read as filled accent pills with
         a soft glow. Clicking an active chip clears exactly the
         keys it set (see `togglePreset`). */}
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
          Quick presets
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TARGETING_PRESETS.map((p) => (
            <PresetChip
              key={p.id}
              preset={p}
              active={isPresetActive(value, p)}
              onToggle={onTogglePreset}
            />
          ))}
        </div>
      </div>

      {/* ── Group A: WHO (audience demographics) ─────────────────
         Gender / market / language / age range — the "who is the
         buyer" facts. Grouped together so operators can think
         demographics-first, copy-style second. */}
      <FieldGroup label="Who is this audience?">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <FieldShell id={ids.gender} label="Gender">
            <TargetingSelect
              id={ids.gender}
              value={value.gender}
              placeholder="Select gender"
              options={genderOptions}
              onChange={(v) => update("gender", v as GenderValue | undefined)}
            />
          </FieldShell>

          <FieldShell id={ids.market} label="Market">
            <TargetingSelect
              id={ids.market}
              value={value.market}
              placeholder="Select market"
              options={marketOptions}
              onChange={(v) => update("market", v)}
            />
          </FieldShell>

          <FieldShell id={ids.lang} label="Primary language">
            <TargetingSelect
              id={ids.lang}
              value={value.primaryLanguage}
              placeholder="Select primary language"
              options={langOptions}
              onChange={(v) =>
                update(
                  "primaryLanguage",
                  v as PrimaryLanguageValue | undefined,
                )
              }
            />
          </FieldShell>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              alignItems: "end",
            }}
          >
            <NumberField
              id={ids.ageMin}
              label="Age min"
              value={value.ageMin}
              onChange={(n) => update("ageMin", n)}
              min={13}
              max={100}
            />
            <NumberField
              id={ids.ageMax}
              label="Age max"
              value={value.ageMax}
              onChange={(n) => update("ageMax", n)}
              min={13}
              max={100}
            />
          </div>
        </div>
      </FieldGroup>

      {/* ── Group B: HOW TO SELL (creative direction) ────────────
         Awareness / sophistication / angle / tone — the levers
         that change the COPY, not the audience. Visually separated
         so operators don't conflate "who" with "how". */}
      <FieldGroup label="How should we sell to them?">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <FieldShell id={ids.awareness} label="Awareness stage">
            <TargetingSelect
              id={ids.awareness}
              value={value.awarenessLevel}
              placeholder="Select awareness stage"
              options={awarenessOptions}
              onChange={(v) =>
                update("awarenessLevel", v as AwarenessValue | undefined)
              }
            />
          </FieldShell>

          <FieldShell id={ids.sophistication} label="Sophistication level">
            <TargetingSelect
              id={ids.sophistication}
              value={value.sophisticationLevel}
              placeholder="Select sophistication level"
              options={sophisticationOptions}
              onChange={(v) =>
                update(
                  "sophisticationLevel",
                  v as SophisticationValue | undefined,
                )
              }
            />
          </FieldShell>

          <FieldShell id={ids.angle} label="Emotional angle">
            <TargetingSelect
              id={ids.angle}
              value={value.emotionalAngle}
              placeholder="Select emotional angle"
              options={angleOptions}
              onChange={(v) =>
                update("emotionalAngle", v as EmotionalAngleValue | undefined)
              }
            />
          </FieldShell>

          <FieldShell id={ids.tone} label="Tone style">
            <TargetingSelect
              id={ids.tone}
              value={value.toneStyle}
              placeholder="Select tone style"
              options={toneOptions}
              onChange={(v) =>
                update("toneStyle", v as ToneStyleValue | undefined)
              }
            />
          </FieldShell>
        </div>
      </FieldGroup>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Preset chip — extracted from inline so the hover-state ref logic
// stays scoped and the parent JSX reads cleanly. Minimal-premium
// aesthetic: subtle border ramp on hover, filled accent + soft glow
// when active, NO loud gradients.
// ─────────────────────────────────────────────────────────────────────────

function PresetChip(props: {
  preset: TargetingPreset;
  active: boolean;
  onToggle: (preset: TargetingPreset) => void;
}) {
  const { preset, active, onToggle } = props;

  // Active palette → restrained-gold tinted fill, accent text, accent
  // border, soft outer glow. Reads as "selected" without yelling.
  const activeStyle: React.CSSProperties = active
    ? {
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--accent) 22%, transparent), color-mix(in srgb, var(--accent) 14%, transparent))",
        borderColor: "var(--accent)",
        color: "var(--accent)",
        boxShadow:
          "0 4px 16px -6px color-mix(in srgb, var(--accent) 55%, transparent), inset 0 1px 0 color-mix(in srgb, var(--accent) 18%, transparent)",
      }
    : {
        background: "var(--bg-elev)",
        borderColor: "var(--border)",
        color: "var(--text-dim)",
        boxShadow: "none",
      };

  return (
    <button
      type="button"
      onClick={() => onToggle(preset)}
      title={preset.description ?? preset.label}
      aria-pressed={active}
      style={{
        appearance: "none",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        padding: "6px 13px",
        borderRadius: 999,
        border: "1px solid",
        letterSpacing: "0.005em",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        transition:
          "background var(--transition-fast) var(--ease-out), border-color var(--transition-fast) var(--ease-out), color var(--transition-fast) var(--ease-out), box-shadow var(--transition-fast) var(--ease-out), transform var(--transition-fast) var(--ease-out)",
        ...activeStyle,
      }}
      onMouseEnter={(e) => {
        if (active) {
          // Active hover: lift the chip slightly + intensify the glow.
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow =
            "0 8px 22px -6px color-mix(in srgb, var(--accent) 70%, transparent), inset 0 1px 0 color-mix(in srgb, var(--accent) 22%, transparent)";
        } else {
          // Inactive hover: brighten border + text, soft surface lift.
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.background = "var(--surface-2)";
          e.currentTarget.style.borderColor = "var(--border-strong)";
          e.currentTarget.style.color = "var(--text)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        if (active) {
          e.currentTarget.style.boxShadow =
            "0 4px 16px -6px color-mix(in srgb, var(--accent) 55%, transparent), inset 0 1px 0 color-mix(in srgb, var(--accent) 18%, transparent)";
        } else {
          e.currentTarget.style.background = "var(--bg-elev)";
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.color = "var(--text-dim)";
        }
      }}
    >
      {active && (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 12,
            height: 12,
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          ✓
        </span>
      )}
      {preset.label}
    </button>
  );
}

// Light visual grouping wrapper — a small subheader above each
// 2x2 grid. Doesn't change any control behaviour; purely splits
// the 8-field wall into two semantically distinct halves.
function FieldGroup(props: { label: string; children: React.ReactNode }) {
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
        {props.label}
      </span>
      {props.children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Field primitives
// ─────────────────────────────────────────────────────────────────────────

// Thin label+control wrapper used by every dropdown row. Same shape
// as the equivalent block in `IntakeForm.tsx`'s `Field` primitive,
// kept local so this component remains self-contained.
function FieldShell(props: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        htmlFor={props.id}
        style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}
      >
        {props.label}
      </label>
      {props.children}
    </div>
  );
}

function NumberField(props: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  min?: number;
  max?: number;
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
    </div>
  );
}
