"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  subMonths,
} from "date-fns";

/**
 * Lightweight range calendar.
 *
 * Why a custom component (vs `react-day-picker` etc.)
 * ──────────────────────────────────────────────────
 *   • Native `<input type="date">` renders inconsistently across
 *     Chrome Android / Firefox Android / iOS Safari — the very issue
 *     called out in the bug report.
 *   • A library would add ~30 KB to the admin bundle for what is
 *     ultimately a 6×7 grid of buttons and two arrow icons.
 *   • Theming is one CSS file in `admin.css` instead of yet another
 *     CSS-Modules / palette override layer to keep in sync.
 *
 * Contract
 * ────────
 *   value     — `{ from, to }` with optional Date endpoints.  `null`
 *               means "no selection yet".  Out-of-order pairs are
 *               normalised automatically (clicking a date earlier
 *               than the current start swaps it).
 *   onChange  — fires on every click; the picker shell decides when
 *               to commit by calling its own Apply button.
 *   maxDate   — upper bound for selectable cells (defaults to today).
 *
 * No business logic, no fetches, no side effects on the URL — the
 * date-range URL params are owned by `DateRangePicker.tsx`.
 */

type DateRangeValue = { from: Date | null; to: Date | null };

type Props = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  maxDate?: Date;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export function Calendar({ value, onChange, maxDate }: Props) {
  // The visible month is independent of the selected range — when the
  // user opens a fresh picker we anchor on the existing start, the
  // existing end (in priority order), or today.
  const [cursor, setCursor] = useState<Date>(() => {
    if (value.from) return startOfMonth(value.from);
    if (value.to) return startOfMonth(value.to);
    return startOfMonth(new Date());
  });

  const max = maxDate ?? new Date();

  const cells = useMemo(() => buildCells(cursor), [cursor]);

  const goPrev = () => setCursor((c) => subMonths(c, 1));
  const goNext = () => setCursor((c) => addMonths(c, 1));

  const handleClick = (day: Date) => {
    if (isAfter(day, max)) return;

    // Range selection logic:
    //   • If neither end is set, day becomes `from`.
    //   • If only `from` is set, day becomes `to` (or swaps to `from`
    //     if the click is earlier than the existing `from`).
    //   • If both ends are set, start a new range with `from = day`.
    const { from, to } = value;
    if (!from || (from && to)) {
      onChange({ from: day, to: null });
      return;
    }
    if (isSameDay(day, from)) {
      onChange({ from: day, to: day });
      return;
    }
    if (isBefore(day, from)) {
      onChange({ from: day, to: from });
      return;
    }
    onChange({ from, to: day });
  };

  return (
    <div className="fa-cal">
      <div className="fa-cal-head">
        <button
          type="button"
          className="fa-cal-nav"
          onClick={goPrev}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="fa-cal-month">{format(cursor, "MMMM yyyy")}</div>
        <button
          type="button"
          className="fa-cal-nav"
          onClick={goNext}
          disabled={isAfter(addMonths(cursor, 1), max) && !isSameMonth(addMonths(cursor, 1), max)}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="fa-cal-weekdays" aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="fa-cal-grid" role="grid">
        {cells.map((cell) => {
          const outside = !isSameMonth(cell, cursor);
          const disabled = isAfter(cell, max);
          const isStart = !!(value.from && isSameDay(cell, value.from));
          const isEnd = !!(value.to && isSameDay(cell, value.to));
          const inRange =
            !!value.from &&
            !!value.to &&
            !isBefore(cell, value.from) &&
            !isAfter(cell, value.to);
          return (
            <button
              key={cell.toISOString()}
              type="button"
              className="fa-cal-cell"
              data-outside={outside ? "true" : "false"}
              data-today={isToday(cell) ? "true" : "false"}
              data-in-range={inRange ? "true" : "false"}
              data-range-start={isStart ? "true" : "false"}
              data-range-end={isEnd ? "true" : "false"}
              disabled={disabled}
              onClick={() => handleClick(cell)}
              aria-label={format(cell, "PPPP")}
              aria-current={isToday(cell) ? "date" : undefined}
              aria-selected={isStart || isEnd ? true : undefined}
            >
              {cell.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Build the 6×7 = 42 cells for a calendar grid.  We always render
 * exactly six weeks so the grid height doesn't jiggle between months
 * with 28 vs 31 days.
 */
function buildCells(cursor: Date): Date[] {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
  const cells: Date[] = [];
  let d = start;
  while (!isAfter(d, end)) {
    cells.push(d);
    d = addDays(d, 1);
  }
  // Pad to six rows if the month spans only five.
  while (cells.length < 42) cells.push(addDays(cells[cells.length - 1], 1));
  return cells.slice(0, 42);
}
