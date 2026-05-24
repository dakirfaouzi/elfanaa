"use client";

import { useCallback, useId } from "react";
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
} from "@platform/ingest";
import {
  AWARENESS_LABELS,
  EMOTIONAL_ANGLE_LABELS,
  GENDER_LABELS,
  MARKET_LABELS,
  PRIMARY_LANGUAGE_LABELS,
  SOPHISTICATION_LABELS,
  TONE_STYLE_LABELS,
} from "@/lib/studio/intake/targeting-options";

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

  return (
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
