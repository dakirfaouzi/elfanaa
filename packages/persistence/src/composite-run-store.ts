import type { UniversalProduct } from "@platform/catalog-schema";
import type {
  CostRow,
  ListRunsFilter,
  NewRunRecord,
  RunRecord,
  RunStore,
  StepRecord,
} from "@platform/ingest/store";

/**
 * Composite RunStore — dual-writes to a primary + a secondary
 * `RunStore`. Reads come exclusively from the primary.
 *
 * # Why dual-write
 *
 * M9 ships file-backed persistence. M10 adds Postgres. The Studio
 * SSE watcher tails the file directly. If we flipped authority to
 * Postgres in a single step we'd have to rewrite the watcher AND
 * coordinate with every operator's running session. Instead, M10
 * runs both stores in parallel:
 *
 *   • Primary    = `FileStore` (file system).
 *   • Secondary  = `PrismaRunStore` (Postgres).
 *
 * Reads stay file-backed → no behavioural change to M9 callers.
 * Writes go to both → DB accumulates the same history. M11+ flips
 * the read path to Postgres once DB authority is proven.
 *
 * # Failure handling
 *
 * Secondary failures NEVER fail the operation. They're surfaced via
 * the optional `onSecondaryError` callback so the studio can log
 * them via its structured logger. The primary's outcome is the
 * operation's outcome.
 *
 * # Read pass-through
 *
 * `getRun` and `listRuns` only read the primary — the secondary is
 * a write-only mirror. This guarantees consistent reads with the
 * M9 file format and no surprise "row exists in DB but not on disk"
 * behaviour. The asset browser / replay loader use the repositories
 * (NOT the RunStore) when they need DB-only data.
 */
export interface CompositeRunStoreOptions {
  primary: RunStore;
  secondary: RunStore;
  /** Invoked once per secondary failure. Suppress when truthy. */
  onSecondaryError?: (op: string, error: unknown) => void;
}

export class CompositeRunStore implements RunStore {
  private readonly primary: RunStore;
  private readonly secondary: RunStore;
  private readonly onSecondaryError: (op: string, error: unknown) => void;

  constructor(opts: CompositeRunStoreOptions) {
    this.primary = opts.primary;
    this.secondary = opts.secondary;
    this.onSecondaryError = opts.onSecondaryError ?? noopErrorReporter;
  }

  async createRun(record: NewRunRecord): Promise<RunRecord> {
    const primaryResult = await this.primary.createRun(record);
    await this.runSecondary("createRun", () => this.secondary.createRun(record));
    return primaryResult;
  }

  async markRunStarted(runId: string): Promise<void> {
    await this.primary.markRunStarted(runId);
    await this.runSecondary("markRunStarted", () =>
      this.secondary.markRunStarted(runId),
    );
  }

  async appendStep(runId: string, step: StepRecord): Promise<void> {
    await this.primary.appendStep(runId, step);
    await this.runSecondary("appendStep", () =>
      this.secondary.appendStep(runId, step),
    );
  }

  async appendCosts(runId: string, costs: CostRow[]): Promise<void> {
    await this.primary.appendCosts(runId, costs);
    await this.runSecondary("appendCosts", () =>
      this.secondary.appendCosts(runId, costs),
    );
  }

  async markRunComplete(
    runId: string,
    finalProduct: UniversalProduct,
  ): Promise<void> {
    await this.primary.markRunComplete(runId, finalProduct);
    await this.runSecondary("markRunComplete", () =>
      this.secondary.markRunComplete(runId, finalProduct),
    );
  }

  async markRunFailed(runId: string, errorMessage: string): Promise<void> {
    await this.primary.markRunFailed(runId, errorMessage);
    await this.runSecondary("markRunFailed", () =>
      this.secondary.markRunFailed(runId, errorMessage),
    );
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    return this.primary.getRun(runId);
  }

  async listRuns(filter?: ListRunsFilter): Promise<RunRecord[]> {
    return this.primary.listRuns(filter);
  }

  private async runSecondary(
    op: string,
    fn: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.onSecondaryError(op, err);
    }
  }
}

function noopErrorReporter(_op: string, _err: unknown): void {
  // intentional no-op; callers that care provide their own reporter
}
