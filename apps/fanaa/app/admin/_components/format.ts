/**
 * Format helpers for admin UI.
 *
 * All money values in the DB are stored as halalas (1 SAR = 100 halalas).
 * The dashboard prefers compact, scannable numbers — 12.3k, 1.2M — over
 * raw values. Hover/title attributes can carry the precise figure when
 * needed.
 */

export function formatCurrency(minor: number | string | undefined, currency = "SAR"): string {
  const n = typeof minor === "string" ? Number(minor) : minor ?? 0;
  const value = Math.round((n || 0)) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatNumber(n: number | undefined): string {
  return new Intl.NumberFormat("en-US").format(n ?? 0);
}

export function formatCompact(n: number | undefined): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    n ?? 0
  );
}

export function formatPercent(n: number | undefined, digits = 1): string {
  return `${(n ?? 0).toFixed(digits)}%`;
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
  });
}

export function formatDay(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Riyadh",
  });
}
