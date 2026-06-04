/**
 * friendlyError — operator-facing error humaniser (Sprint 2).
 *
 * Studio surfaced raw machine strings to operators: `save_failed:409:…`,
 * `upload_returned_no_usable_ref`, `intake_failed`, `mode_unavailable`,
 * bare HTTP-status messages, etc. This maps the known ones to plain,
 * recovery-oriented sentences while leaving the *technical* string for
 * logs/tooltips (callers pass the raw value to `console`/`title`).
 *
 * # Design
 *
 *   • Pattern table, first match wins (most-specific first).
 *   • Always returns a non-empty, human sentence — never the raw code.
 *   • Pure + dependency-free so it is safe in client and server bundles
 *     and trivially unit-testable.
 *
 * Keep this the single source of truth for operator error copy so the
 * wording stays consistent across the builder, uploader, and forms.
 */

interface ErrorRule {
  match: RegExp;
  message: string;
}

const RULES: ErrorRule[] = [
  // ── Save / autosave ────────────────────────────────────────────────
  {
    match: /save_failed:409|version|conflict.*save|stale/i,
    message:
      "Your draft changed somewhere else. Reload the page to get the latest version, then re-apply your edit.",
  },
  {
    match: /save_failed|autosave/i,
    message:
      "Couldn’t save your latest changes. We’ll keep retrying — check your connection.",
  },

  // ── Uploads ────────────────────────────────────────────────────────
  {
    match: /upload_returned_no_usable_ref|no_usable_ref/i,
    message:
      "That image uploaded but came back unusable. Please try a different file.",
  },
  {
    match: /unsupported file type|invalid.*type|wrong.*format/i,
    message: "That file type isn’t supported. Use a PNG, JPEG, WebP, or AVIF image.",
  },
  {
    match: /too large|file.*size|max.*size|413/i,
    message: "That file is too large. Please use an image under 50 MB.",
  },
  {
    match: /upload_failed|upload.*error|presign|put.*failed/i,
    message: "Image upload failed. Please try again, or use a different file.",
  },
  {
    match: /load_failed|could not load|failed to load/i,
    message: "Couldn’t load your media library. Refresh the page and try again.",
  },

  // ── Publish ────────────────────────────────────────────────────────
  {
    match: /publish_blocked/i,
    message: "This draft isn’t ready to publish yet. Resolve the checklist below.",
  },
  {
    match: /publish.*failed|failed.*publish/i,
    message: "Publishing failed. Please try again in a moment.",
  },

  // ── Draft creation / persistence ───────────────────────────────────
  {
    match: /\bconflict\b|already exists|slug.*taken/i,
    message: "That slug is already in use for this store. Choose a different one.",
  },
  {
    match: /mode_unavailable|persistence.*disabled|dual-?write/i,
    message:
      "Editing is turned off on this deployment. Enable dual-write persistence to create or publish drafts.",
  },
  {
    match: /invalid_input|validation|invalid input/i,
    message: "Some fields need attention before this can be saved.",
  },

  // ── Intake / pipeline ──────────────────────────────────────────────
  {
    match: /intake_failed/i,
    message: "Couldn’t start the run. Check the supplier URL and price, then try again.",
  },

  // ── Catalog / checkout (surfaced for completeness) ─────────────────
  {
    match: /product_unknown|unknown product/i,
    message:
      "This product isn’t in the live catalog yet. Publish the draft before it can be ordered.",
  },

  // ── Network ────────────────────────────────────────────────────────
  {
    match: /network_error|failed to fetch|networkerror|timeout|econn/i,
    message: "Network problem. Check your connection and try again.",
  },
];

/** HTTP-status fallback so a bare `Publish failed (502)` still reads well. */
function statusFallback(raw: string): string | null {
  const m = raw.match(/\((\d{3})\)|:\s?(\d{3})\b|\b(4\d\d|5\d\d)\b/);
  const code = m ? Number(m[1] ?? m[2] ?? m[3]) : NaN;
  if (!Number.isFinite(code)) return null;
  if (code === 401 || code === 403) {
    return "Your session may have expired. Refresh the page and sign in again.";
  }
  if (code === 404) return "We couldn’t find that item. It may have been removed.";
  if (code === 409) {
    return "This changed somewhere else. Reload to get the latest version, then retry.";
  }
  if (code >= 500) return "The server had a problem. Please try again in a moment.";
  if (code >= 400) return "That request couldn’t be completed. Please try again.";
  return null;
}

/**
 * Convert a raw error string/code into an operator-friendly sentence.
 * Returns a sensible generic message when nothing matches.
 */
export function friendlyError(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) {
    return "Something went wrong. Please try again.";
  }
  for (const rule of RULES) {
    if (rule.match.test(raw)) return rule.message;
  }
  const byStatus = statusFallback(raw);
  if (byStatus) return byStatus;
  return "Something went wrong. Please try again.";
}
