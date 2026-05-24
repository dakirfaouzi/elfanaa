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

/**
 * Structured audience-targeting controls (Phase B2).
 *
 * # What this component does
 *
 * Renders an 8-field grid of dropdowns + range inputs that
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
 * # Why explicit "—" (none) options on every select
 *
 * The schema treats `undefined` as "no preference". A `<select>`
 * with no empty option would force the operator into a pick on
 * every dropdown. The "— No preference —" option maps to
 * `undefined` in the emitted object, which becomes the
 * "do-nothing" semantics the rest of the system expects.
 */

const NONE_VALUE = "__none__";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Preset chips row ──────────────────────────────────────
         Six one-click bundles for the highest-frequency operator
         archetypes. Composable (clicking two chips merges both
         pick sets); active chips read as filled accent pills.
         Clicking an active chip clears exactly the keys it set
         (see `togglePreset`). */}
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {TARGETING_PRESETS.map((p) => {
            const active = isPresetActive(value, p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onTogglePreset(p)}
                title={p.description ?? p.label}
                aria-pressed={active}
                style={{
                  appearance: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: `1px solid ${
                    active
                      ? "var(--accent)"
                      : "color-mix(in srgb, var(--border-strong) 80%, var(--border))"
                  }`,
                  background: active
                    ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                    : "var(--bg-elev)",
                  color: active ? "var(--accent)" : "var(--text-dim)",
                  transition:
                    "background var(--transition-fast) var(--ease-out), border-color var(--transition-fast) var(--ease-out), color var(--transition-fast) var(--ease-out)",
                }}
              >
                {active ? "✓ " : ""}
                {p.label}
              </button>
            );
          })}
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
          <SelectField
            id={ids.gender}
            label="Gender"
            value={value.gender ?? NONE_VALUE}
            options={GENDER_VALUES.map((v) => ({
              value: v,
              label: GENDER_LABELS[v],
            }))}
            onChange={(v) =>
              update("gender", v === NONE_VALUE ? undefined : (v as GenderValue))
            }
          />

          <SelectField
            id={ids.market}
            label="Market"
            value={value.market ?? NONE_VALUE}
            options={Object.entries(MARKET_LABELS).map(([code, label]) => ({
              value: code,
              label: `${code} — ${label}`,
            }))}
            onChange={(v) => update("market", v === NONE_VALUE ? undefined : v)}
          />

          <SelectField
            id={ids.lang}
            label="Primary language"
            value={value.primaryLanguage ?? NONE_VALUE}
            options={PRIMARY_LANGUAGE_VALUES.map((v) => ({
              value: v,
              label: PRIMARY_LANGUAGE_LABELS[v],
            }))}
            onChange={(v) =>
              update(
                "primaryLanguage",
                v === NONE_VALUE ? undefined : (v as PrimaryLanguageValue),
              )
            }
          />

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
          <SelectField
            id={ids.awareness}
            label="Awareness level"
            value={value.awarenessLevel ?? NONE_VALUE}
            options={AWARENESS_VALUES.map((v) => ({
              value: v,
              label: AWARENESS_LABELS[v],
            }))}
            onChange={(v) =>
              update(
                "awarenessLevel",
                v === NONE_VALUE ? undefined : (v as AwarenessValue),
              )
            }
          />

          <SelectField
            id={ids.sophistication}
            label="Sophistication"
            value={value.sophisticationLevel ?? NONE_VALUE}
            options={SOPHISTICATION_VALUES.map((v) => ({
              value: v,
              label: SOPHISTICATION_LABELS[v],
            }))}
            onChange={(v) =>
              update(
                "sophisticationLevel",
                v === NONE_VALUE ? undefined : (v as SophisticationValue),
              )
            }
          />

          <SelectField
            id={ids.angle}
            label="Emotional angle"
            value={value.emotionalAngle ?? NONE_VALUE}
            options={EMOTIONAL_ANGLE_VALUES.map((v) => ({
              value: v,
              label: EMOTIONAL_ANGLE_LABELS[v],
            }))}
            onChange={(v) =>
              update(
                "emotionalAngle",
                v === NONE_VALUE ? undefined : (v as EmotionalAngleValue),
              )
            }
          />

          <SelectField
            id={ids.tone}
            label="Tone style"
            value={value.toneStyle ?? NONE_VALUE}
            options={TONE_STYLE_VALUES.map((v) => ({
              value: v,
              label: TONE_STYLE_LABELS[v],
            }))}
            onChange={(v) =>
              update(
                "toneStyle",
                v === NONE_VALUE ? undefined : (v as ToneStyleValue),
              )
            }
          />
        </div>
      </FieldGroup>
    </div>
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

function SelectField(props: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        htmlFor={props.id}
        style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}
      >
        {props.label}
      </label>
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value={NONE_VALUE}>— No preference —</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
