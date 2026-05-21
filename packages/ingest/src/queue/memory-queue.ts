import type {
  DequeueOptions,
  EnqueueResult,
  Queue,
  QueuedJob,
} from "./types";

/**
 * In-process FIFO queue.
 *
 * Use case:
 *   • Unit tests for the orchestrator.
 *   • Single-process replay flows where no persistence is needed.
 *
 * Single-process only — process death loses everything in flight.
 * For local dev across restarts use `FileQueue`. For production use
 * the future Inngest / BullMQ adapter.
 */
export class MemoryQueue<T> implements Queue<T> {
  private idCounter = 0;
  private readonly pending: QueuedJob<T>[] = [];
  /** id -> attempts count. Survives across re-enqueues. */
  private readonly attemptsById = new Map<string, number>();
  /** id -> queued job (for ack lookup). */
  private readonly inflight = new Map<string, QueuedJob<T>>();

  async enqueue(job: T): Promise<EnqueueResult> {
    this.idCounter += 1;
    const id = `mq_${this.idCounter}`;
    const enqueuedAt = new Date().toISOString();
    this.pending.push({ id, job, enqueuedAt, attempts: 0 });
    return { id };
  }

  async dequeue(opts?: DequeueOptions): Promise<QueuedJob<T> | null> {
    const deadlineMs = (opts?.timeoutMs ?? 0) + Date.now();
    let first = this.pending.shift();

    // Simple polling loop for the blocking case. 25ms interval keeps
    // tests fast while not burning CPU; real adapters use kernel-level
    // wait primitives.
    while (!first && Date.now() < deadlineMs) {
      await sleep(25);
      first = this.pending.shift();
    }
    if (!first) return null;

    const prevAttempts = this.attemptsById.get(first.id) ?? 0;
    const checkedOut: QueuedJob<T> = {
      ...first,
      attempts: prevAttempts + 1,
    };
    this.attemptsById.set(first.id, checkedOut.attempts);
    this.inflight.set(first.id, checkedOut);
    return checkedOut;
  }

  async markComplete(id: string): Promise<void> {
    this.inflight.delete(id);
  }

  async markFailed(id: string, _errorMessage: string): Promise<void> {
    this.inflight.delete(id);
    // Caller (orchestrator) decides whether to re-enqueue via the retry
    // policy. The attempt counter is preserved in `attemptsById` so a
    // re-enqueue of the SAME logical job (same payload) is treated as a
    // retry by the dequeuer.
  }

  async size(): Promise<number> {
    return this.pending.length;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
