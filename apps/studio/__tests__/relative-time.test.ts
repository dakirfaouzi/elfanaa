import { describe, expect, it } from "vitest";
import { formatRelative } from "../app/_components/RelativeTime";

/**
 * Pure-formatter unit tests for `formatRelative`. The component
 * itself owns the mount + interval lifecycle (covered manually);
 * these tests pin the formatter's contract so any rounding regression
 * surfaces in CI.
 */

describe("formatRelative — past timestamps", () => {
  const now = 1_000_000_000_000;

  it("renders 'just now' under 5 seconds", () => {
    expect(formatRelative(new Date(now - 2_000), now)).toBe("just now");
    expect(formatRelative(new Date(now - 4_000), now)).toBe("just now");
  });

  it("renders seconds 5..59", () => {
    expect(formatRelative(new Date(now - 5_000), now)).toBe("5s ago");
    expect(formatRelative(new Date(now - 30_000), now)).toBe("30s ago");
    expect(formatRelative(new Date(now - 59_000), now)).toBe("59s ago");
  });

  it("renders minutes 1..59", () => {
    expect(formatRelative(new Date(now - 60_000), now)).toBe("1 min ago");
    expect(formatRelative(new Date(now - 5 * 60_000), now)).toBe("5 min ago");
    expect(formatRelative(new Date(now - 59 * 60_000), now)).toBe("59 min ago");
  });

  it("renders hours 1..23", () => {
    expect(formatRelative(new Date(now - 60 * 60_000), now)).toBe("1 hr ago");
    expect(formatRelative(new Date(now - 5 * 60 * 60_000), now)).toBe("5 hr ago");
    expect(formatRelative(new Date(now - 23 * 60 * 60_000), now)).toBe("23 hr ago");
  });

  it("renders days 1..6", () => {
    const day = 24 * 60 * 60_000;
    expect(formatRelative(new Date(now - day), now)).toBe("1 day ago");
    expect(formatRelative(new Date(now - 6 * day), now)).toBe("6 days ago");
  });

  it("renders weeks 1..4", () => {
    const day = 24 * 60 * 60_000;
    expect(formatRelative(new Date(now - 7 * day), now)).toBe("1 week ago");
    expect(formatRelative(new Date(now - 21 * day), now)).toBe("3 weeks ago");
  });

  it("falls back to absolute date past five weeks", () => {
    const day = 24 * 60 * 60_000;
    const out = formatRelative(new Date(now - 200 * day), now);
    // We don't assert the locale-formatted string verbatim — just
    // that the fallback path picks up (no relative phrasing).
    expect(out).not.toMatch(/ago$/);
    expect(out).not.toMatch(/^in /);
  });
});

describe("formatRelative — future timestamps", () => {
  const now = 1_000_000_000_000;

  it("renders 'in a moment' under 5 seconds", () => {
    expect(formatRelative(new Date(now + 2_000), now)).toBe("in a moment");
  });

  it("renders 'in Xs', 'in X min', 'in X hr'", () => {
    expect(formatRelative(new Date(now + 30_000), now)).toBe("in 30s");
    expect(formatRelative(new Date(now + 5 * 60_000), now)).toBe("in 5 min");
    expect(formatRelative(new Date(now + 2 * 60 * 60_000), now)).toBe("in 2 hr");
  });
});
