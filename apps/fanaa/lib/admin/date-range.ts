import {
  startOfDay,
  endOfDay,
  startOfYesterday,
  endOfYesterday,
  subDays,
  parseISO,
  isValid,
  differenceInDays,
} from "date-fns";

/**
 * Canonical date-range vocabulary shared by URL params, server queries, and
 * the date-picker UI. All times are UTC ISO strings on the wire — the client
 * converts to Riyadh time for display only.
 */
export type RangePreset = "today" | "yesterday" | "last_7" | "last_30" | "last_90" | "custom";

export type DateRange = {
  preset: RangePreset;
  from: Date;
  to: Date;
  /** Days in the comparison range used for delta calculations. */
  prevFrom: Date;
  prevTo: Date;
};

export function resolveRange(searchParams: URLSearchParams): DateRange {
  const preset = (searchParams.get("range") as RangePreset) ?? "last_30";
  if (preset === "custom") {
    const fromIso = searchParams.get("from");
    const toIso = searchParams.get("to");
    const from = fromIso ? parseISO(fromIso) : subDays(new Date(), 30);
    const to = toIso ? parseISO(toIso) : new Date();
    if (!isValid(from) || !isValid(to)) return defaultRange();
    return withCompare("custom", startOfDay(from), endOfDay(to));
  }
  return presetRange(preset);
}

function presetRange(preset: RangePreset): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return withCompare("today", startOfDay(now), endOfDay(now));
    case "yesterday":
      return withCompare("yesterday", startOfYesterday(), endOfYesterday());
    case "last_7":
      return withCompare("last_7", startOfDay(subDays(now, 6)), endOfDay(now));
    case "last_30":
      return withCompare("last_30", startOfDay(subDays(now, 29)), endOfDay(now));
    case "last_90":
      return withCompare("last_90", startOfDay(subDays(now, 89)), endOfDay(now));
    default:
      return defaultRange();
  }
}

function defaultRange(): DateRange {
  return presetRange("last_30");
}

function withCompare(preset: RangePreset, from: Date, to: Date): DateRange {
  const days = Math.max(1, differenceInDays(to, from) + 1);
  const prevTo = endOfDay(subDays(from, 1));
  const prevFrom = startOfDay(subDays(prevTo, days - 1));
  return { preset, from, to, prevFrom, prevTo };
}

export function buildRangeQuery(range: { preset: RangePreset; from?: Date; to?: Date }): string {
  const params = new URLSearchParams({ range: range.preset });
  if (range.preset === "custom" && range.from && range.to) {
    params.set("from", range.from.toISOString());
    params.set("to", range.to.toISOString());
  }
  return params.toString();
}
