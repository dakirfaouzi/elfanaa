/**
 * Per-query failure isolation for the admin metrics pipeline.
 *
 * Why this exists
 * ───────────────
 * The original metrics routes did `await Promise.all([fn1(), fn2(), …])`
 * which is "all-or-nothing": one bad query (missing table, dropped
 * connection, transient lock) takes the whole `/api/admin/metrics/*`
 * response with it, the route returns an opaque HTTP 500, and the
 * dashboard shows the unhelpful "Couldn't load metrics" banner with no
 * actionable signal for the operator.
 *
 * This helper flips that model:
 *   • Every individual sub-query runs inside `safe(…)`.
 *   • On success the route gets real data.
 *   • On failure the route gets the caller-supplied default value AND
 *     a structured error string that bubbles back to the UI so the
 *     operator can see exactly which sub-query failed and why.
 *
 * The dashboard always renders. Always. Even if Postgres is on fire.
 */

export type SafeResult<T> = {
  data: T;
  /** Null on success. On failure, a short human-readable reason. */
  error: string | null;
  /** The label passed to `safe()` so callers can pinpoint the failure. */
  label: string;
};

export async function safe<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<SafeResult<T>> {
  try {
    const data = await fn();
    return { data, error: null, label };
  } catch (err) {
    const reason = explain(err);
    // eslint-disable-next-line no-console -- structured server log
    console.error(`[admin/safe] ${label} failed: ${reason}`);
    return { data: fallback, error: reason, label };
  }
}

/**
 * Convert any thrown value into a single-line human-readable string.
 * We deliberately strip stack traces — the dashboard surfaces these
 * reasons in the UI, and shipping full stacks to the browser would
 * leak server internals.
 */
export function explain(err: unknown): string {
  if (err instanceof Error) {
    // Prisma's common errors have very wordy messages that span many lines.
    // Take the first non-empty line so the toast/banner stays readable.
    const firstLine = err.message.split("\n").find((l) => l.trim().length > 0);
    return (firstLine ?? err.name).slice(0, 280);
  }
  if (typeof err === "string") return err.slice(0, 280);
  try {
    return JSON.stringify(err).slice(0, 280);
  } catch {
    return "unknown_error";
  }
}

/**
 * Collect the `error` strings from a bag of `SafeResult`s. Returns
 * `undefined` (not `[]`) when everything succeeded so the JSON payload
 * stays minimal in the happy path.
 */
export function collectErrors(
  results: ReadonlyArray<SafeResult<unknown>>
): Array<{ label: string; error: string }> | undefined {
  const errors = results
    .filter((r): r is SafeResult<unknown> & { error: string } => r.error !== null)
    .map((r) => ({ label: r.label, error: r.error }));
  return errors.length ? errors : undefined;
}
