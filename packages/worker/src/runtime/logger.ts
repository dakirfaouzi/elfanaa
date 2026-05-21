/**
 * Structured JSON logger (PLATFORM.md §14 worker observability).
 *
 * The worker writes one JSON line per event to `console.log`. The
 * Inngest middleware (M6.5) will switch the sink to its own structured
 * log channel; until then, JSON-on-stdout is the canonical format
 * because EasyPanel + Datadog + grep all consume it for free.
 *
 * # Why a thin layer instead of pino/winston
 *
 *   • One file = no dependency budget burned on logging.
 *   • The shape we need (runId/stage/event/timestamp) is fixed.
 *   • Future swap to pino is a 30-line change.
 *
 * # Context propagation
 *
 * `withContext()` returns a child logger that includes the parent's
 * context in every emit. The orchestrator uses this to thread runId
 * and stage through nested calls without manually passing log refs.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  runId?: string;
  storeId?: string;
  stage?: string;
  /** Free-form additional context that gets merged into every emit. */
  [key: string]: unknown;
}

export interface LogEvent {
  /** ISO-8601 timestamp. */
  timestamp: string;
  level: LogLevel;
  /** Short event name (`stage_start`, `stage_complete`, `provider_call`, …). */
  event: string;
  /** Human-readable summary (optional). */
  message?: string;
  /** Merged log context. */
  context: LogContext;
  /** Free-form structured data. */
  data?: Record<string, unknown>;
}

export interface Logger {
  readonly context: LogContext;
  debug(event: string, data?: Record<string, unknown>, message?: string): void;
  info(event: string, data?: Record<string, unknown>, message?: string): void;
  warn(event: string, data?: Record<string, unknown>, message?: string): void;
  error(event: string, data?: Record<string, unknown>, message?: string): void;
  /** Returns a child logger merging the supplied context on top of `this.context`. */
  withContext(extra: LogContext): Logger;
}

export type LogSink = (line: string) => void;

/** Console-backed sink — emits one JSON-line per event to stdout. */
export const consoleSink: LogSink = (line) => {
  // eslint-disable-next-line no-console
  console.log(line);
};

/** Buffering sink — captures lines into an array. Useful in tests. */
export class BufferSink {
  readonly lines: string[] = [];
  readonly write: LogSink = (line) => {
    this.lines.push(line);
  };
}

/** Drop-everything sink — silences logs (e.g. in dispatch-mock --quiet). */
export const noopSink: LogSink = () => {
  /* drop */
};

export function createLogger(
  opts?: {
    context?: LogContext;
    sink?: LogSink;
    minLevel?: LogLevel;
  },
): Logger {
  const sink = opts?.sink ?? consoleSink;
  const context = opts?.context ?? {};
  const minLevel = opts?.minLevel ?? "info";
  const threshold = LEVEL_ORDER[minLevel];

  function emit(
    level: LogLevel,
    event: string,
    data?: Record<string, unknown>,
    message?: string,
  ): void {
    if (LEVEL_ORDER[level] < threshold) return;
    const ev: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      context,
      data,
    };
    sink(JSON.stringify(ev));
  }

  return {
    context,
    debug: (event, data, message) => emit("debug", event, data, message),
    info: (event, data, message) => emit("info", event, data, message),
    warn: (event, data, message) => emit("warn", event, data, message),
    error: (event, data, message) => emit("error", event, data, message),
    withContext(extra) {
      return createLogger({
        context: { ...context, ...extra },
        sink,
        minLevel,
      });
    },
  };
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
