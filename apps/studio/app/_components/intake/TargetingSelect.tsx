"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Custom dropdown used by the Audience section of the intake form.
 *
 * # Why we rolled our own rather than `<select>`
 *
 * Native `<select>` option lists are styled by the OS, not the page.
 * Browsers refuse `padding` / `background` / `font-size` on `<option>`
 * elements for security + a11y reasons. That hard-blocks every item
 * on the operator's Audience-polish wishlist:
 *
 *   • taller option rows
 *   • clearer hover state
 *   • cleaner typography rhythm
 *   • better contrast separation between selected / hover / default
 *
 * So we build the closed control + popover ourselves and keep the
 * behaviour-equivalent of a `<select>`:
 *
 *   • Single-select.
 *   • Keyboard nav (Arrow Up/Down, Home/End, Enter, Escape, Space).
 *   • Click-outside dismisses.
 *   • Optional explicit "Clear selection" row (returns
 *     `onChange(undefined)`).
 *   • Focus moves back to the trigger button on close.
 *   • ARIA: `role="combobox"` trigger → `role="listbox"` popover
 *     with `role="option"` rows + `aria-selected` on the picked one.
 *
 * # Why no FormData / `name` prop
 *
 * The Audience section is fully controlled — `TargetingControls`
 * mirrors every pick into React state and the intake form
 * serialises the structured object directly via `intakeMetadata`
 * (it never reads targeting from FormData). Skipping a hidden
 * `<input>` keeps the DOM lean and avoids two-source-of-truth bugs.
 *
 * # Why no portal
 *
 * The intake form is short and the dropdowns never need to overflow
 * a scrolling parent — the menu's absolute positioning + `z-index`
 * is sufficient. If a future surface puts this inside a
 * `overflow: hidden` container, portal-ising the menu is the
 * additive next step (no API change required).
 */

export interface TargetingSelectOption {
  value: string;
  label: string;
}

interface TargetingSelectProps {
  id: string;
  /** Currently-picked option value, or `undefined` when nothing is
   *  selected. Driven by the parent's mirror-controlled state. */
  value: string | undefined;
  /** Shown in the closed trigger when `value` is undefined. Field-
   *  specific copy (e.g. "Select gender") reads cleaner than the
   *  old generic "— No preference —" placeholder. */
  placeholder: string;
  options: TargetingSelectOption[];
  /** Called with the picked value, or `undefined` when the operator
   *  uses the "Clear selection" row. Parent decides what `undefined`
   *  means semantically (in TargetingControls it deletes the key). */
  onChange: (next: string | undefined) => void;
  /** When false, the "Clear selection" row is suppressed even when
   *  a value is currently selected. Defaults to true. */
  clearable?: boolean;
}

export function TargetingSelect(props: TargetingSelectProps) {
  const { id, value, placeholder, options, onChange } = props;
  const clearable = props.clearable !== false;

  const [open, setOpen] = useState(false);
  // Index into `options` (NOT including the synthetic clear row) of
  // the currently keyboard-active item. -1 = nothing active yet.
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The closed trigger's display label. Falls back to placeholder if
  // value is unset OR doesn't match any current option (e.g. an
  // operator restored a stale draft with a removed market code).
  const selectedLabel = useMemo(() => {
    if (value === undefined) return placeholder;
    const hit = options.find((o) => o.value === value);
    return hit?.label ?? placeholder;
  }, [value, options, placeholder]);

  const isPlaceholder = value === undefined;

  // ── Close on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDocMouseDown);
    return () => window.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // ── Reset active row when the menu opens ───────────────────────
  // Start on the currently-selected row if there is one; otherwise
  // the first option. Operators expect "open → arrow down → next
  // item past current".
  useEffect(() => {
    if (open) {
      const sel = options.findIndex((o) => o.value === value);
      setActiveIdx(sel >= 0 ? sel : 0);
    }
  }, [open, options, value]);

  // ── Scroll active row into view as the operator keyboard-navs ──
  useEffect(() => {
    if (!open || activeIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>(
      '[data-target-option="1"]',
    );
    const node = items[activeIdx];
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  // ── Selection helpers ──────────────────────────────────────────
  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      buttonRef.current?.focus();
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(undefined);
    setOpen(false);
    buttonRef.current?.focus();
  }, [onChange]);

  // ── Keyboard navigation (combobox pattern) ─────────────────────
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // CLOSED: only Down/Enter/Space open the menu.
      if (!open) {
        if (
          e.key === "ArrowDown" ||
          e.key === "Enter" ||
          e.key === " " ||
          e.key === "ArrowUp"
        ) {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }

      // OPEN:
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setOpen(false);
          buttonRef.current?.focus();
          return;
        case "ArrowDown":
          e.preventDefault();
          setActiveIdx((i) => Math.min(options.length - 1, i + 1));
          return;
        case "ArrowUp":
          e.preventDefault();
          setActiveIdx((i) => Math.max(0, i - 1));
          return;
        case "Home":
          e.preventDefault();
          setActiveIdx(0);
          return;
        case "End":
          e.preventDefault();
          setActiveIdx(Math.max(0, options.length - 1));
          return;
        case "Enter":
        case " ": {
          e.preventDefault();
          const opt = options[activeIdx];
          if (opt) handleSelect(opt.value);
          return;
        }
        case "Tab":
          // Allow Tab to dismiss the menu but NOT swallow the
          // natural focus shift — operators expect Tab to move on.
          setOpen(false);
          return;
        default:
          return;
      }
    },
    [open, options, activeIdx, handleSelect],
  );

  const showClearRow = clearable && value !== undefined;

  return (
    <div
      ref={rootRef}
      onKeyDown={onKeyDown}
      style={{ position: "relative" }}
    >
      {/* ─── Closed trigger ──────────────────────────────────────
         Visually mirrors the global input styling (padding, border,
         border-radius, focus ring) so a Targeting select reads as
         the same input species as the Age min/max number fields
         beside it. */}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-listbox` : undefined}
        onClick={() => setOpen((o) => !o)}
        style={{
          appearance: "none",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          font: "inherit",
          fontSize: 13,
          fontWeight: 500,
          color: isPlaceholder ? "var(--text-faint)" : "var(--text)",
          background: "var(--bg-elev)",
          border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 10,
          padding: "11px 14px",
          cursor: "pointer",
          textAlign: "left",
          outline: "none",
          boxShadow: open
            ? "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)"
            : "none",
          transition:
            "border-color var(--transition-fast) var(--ease-out), box-shadow var(--transition-fast) var(--ease-out), background var(--transition-fast) var(--ease-out)",
        }}
        onFocus={(e) => {
          if (!open) {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.boxShadow =
              "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)";
          }
        }}
        onBlur={(e) => {
          if (!open) {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "none";
          }
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {selectedLabel}
        </span>
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: "var(--text-dim)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform var(--transition-fast) var(--ease-out)",
          }}
        >
          ▾
        </span>
      </button>

      {/* ─── Open popover ─────────────────────────────────────── */}
      {open && (
        <div
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          aria-labelledby={id}
          tabIndex={-1}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
            borderRadius: 12,
            boxShadow:
              "0 16px 40px -12px color-mix(in srgb, var(--bg) 70%, transparent), 0 4px 14px -6px color-mix(in srgb, var(--text) 14%, transparent)",
            maxHeight: 320,
            overflowY: "auto",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {showClearRow && (
            <>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClear}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-faint)",
                  fontSize: 12,
                  fontStyle: "italic",
                  padding: "9px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition:
                    "background var(--transition-fast) var(--ease-out), color var(--transition-fast) var(--ease-out)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-elev)";
                  e.currentTarget.style.color = "var(--text-dim)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-faint)";
                }}
              >
                <span aria-hidden style={{ fontSize: 11 }}>
                  ×
                </span>
                Clear selection
              </button>
              {/* Thin separator between clear + actual options. */}
              <div
                aria-hidden
                style={{
                  height: 1,
                  background: "var(--border)",
                  margin: "4px 4px",
                }}
              />
            </>
          )}
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === activeIdx;
            // Active (keyboard) AND selected can both be true; the
            // active background takes priority because that's where
            // the operator's attention currently sits.
            const background = isActive
              ? "color-mix(in srgb, var(--accent) 14%, var(--bg-elev))"
              : isSelected
                ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                : "transparent";
            const color = isSelected ? "var(--accent)" : "var(--text)";
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-target-option="1"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => handleSelect(opt.value)}
                style={{
                  appearance: "none",
                  border: "none",
                  background,
                  color,
                  font: "inherit",
                  fontSize: 13,
                  fontWeight: isSelected ? 600 : 500,
                  textAlign: "left",
                  padding: "10px 14px",
                  minHeight: 38,
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  lineHeight: 1.35,
                  transition:
                    "background var(--transition-fast) var(--ease-out), color var(--transition-fast) var(--ease-out)",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "normal",
                  }}
                >
                  {opt.label}
                </span>
                {isSelected && (
                  <span
                    aria-hidden
                    style={{
                      flex: "0 0 auto",
                      fontSize: 12,
                      color: "var(--accent)",
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
