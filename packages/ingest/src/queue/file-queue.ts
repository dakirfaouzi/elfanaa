import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  DequeueOptions,
  EnqueueResult,
  Queue,
  QueuedJob,
} from "./types";

/**
 * File-backed FIFO queue using a directory of per-job JSON files.
 *
 * # Layout
 *
 *   <root>/
 *     pending/   ← jobs waiting to be picked up
 *       <ts>_<n>.json
 *     inflight/  ← jobs checked out by dequeue (not yet acked)
 *       <ts>_<n>.json
 *
 * Each file is the serialised `QueuedJob<T>` (including `id`,
 * `enqueuedAt`, `attempts`). The file name embeds a creation timestamp
 * so a directory listing is FIFO-ordered by name.
 *
 * # Why not SQLite?
 *
 *   • Two extra dependencies (driver + native bindings) for what is
 *     fundamentally a queue of small JSON blobs.
 *   • Plain files are inspectable with `cat`; SQLite needs a tool.
 *   • The eventual production driver is Inngest, NOT this. File queue
 *     exists for local dev only.
 *
 * # Concurrency
 *
 * Single-writer assumption. The orchestrator runs jobs strictly serial
 * inside a single process; multi-process safety is out of scope for
 * M6 — it lands with the Inngest/BullMQ adapter. The `rename` step
 * in `dequeue` is the rough cross-process safety net (atomic on POSIX),
 * but no formal locking is provided.
 */
export class FileQueue<T> implements Queue<T> {
  private readonly root: string;
  private readonly pendingDir: string;
  private readonly inflightDir: string;
  private idCounter = 0;
  private initPromise: Promise<void> | null = null;

  constructor(rootDir: string) {
    this.root = rootDir;
    this.pendingDir = join(rootDir, "pending");
    this.inflightDir = join(rootDir, "inflight");
  }

  private async ensureDirs(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (!existsSync(this.pendingDir)) {
        await mkdir(this.pendingDir, { recursive: true });
      }
      if (!existsSync(this.inflightDir)) {
        await mkdir(this.inflightDir, { recursive: true });
      }
    })();
    return this.initPromise;
  }

  async enqueue(job: T): Promise<EnqueueResult> {
    await this.ensureDirs();
    this.idCounter += 1;
    const ts = Date.now().toString().padStart(14, "0");
    const seq = this.idCounter.toString().padStart(6, "0");
    const id = `fq_${ts}_${seq}`;
    const fileName = `${ts}_${seq}.json`;
    const path = join(this.pendingDir, fileName);

    const record: QueuedJob<T> = {
      id,
      job,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };
    await writeFile(path, JSON.stringify(record, null, 2), "utf8");
    return { id };
  }

  async dequeue(opts?: DequeueOptions): Promise<QueuedJob<T> | null> {
    await this.ensureDirs();
    const deadlineMs = (opts?.timeoutMs ?? 0) + Date.now();
    let entry = await this.pickNext();
    while (!entry && Date.now() < deadlineMs) {
      await sleep(50);
      entry = await this.pickNext();
    }
    if (!entry) return null;
    return entry;
  }

  /**
   * Pops the alphabetically-first file from `pending/` and moves it
   * into `inflight/`. Returns null when the pending dir is empty.
   */
  private async pickNext(): Promise<QueuedJob<T> | null> {
    const names = (await readdir(this.pendingDir)).sort();
    const fileName = names.find((n) => n.endsWith(".json"));
    if (!fileName) return null;

    const fromPath = join(this.pendingDir, fileName);
    const toPath = join(this.inflightDir, fileName);

    try {
      await rename(fromPath, toPath);
    } catch (err) {
      // Another concurrent reader claimed it. Treat as empty.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return null;
      throw err;
    }

    const raw = await readFile(toPath, "utf8");
    const record = JSON.parse(raw) as QueuedJob<T>;
    record.attempts = (record.attempts ?? 0) + 1;
    // Persist the bumped attempts counter so a worker crash mid-flight
    // doesn't reset the count on the next process.
    await writeFile(toPath, JSON.stringify(record, null, 2), "utf8");
    return record;
  }

  async markComplete(id: string): Promise<void> {
    await this.ensureDirs();
    const fileName = await this.findInflightFile(id);
    if (fileName) await unlink(join(this.inflightDir, fileName));
  }

  async markFailed(id: string, _errorMessage: string): Promise<void> {
    await this.ensureDirs();
    // Same disposition as the in-memory impl: remove from inflight.
    // The orchestrator decides re-enqueue via the retry policy.
    const fileName = await this.findInflightFile(id);
    if (fileName) await unlink(join(this.inflightDir, fileName));
  }

  async size(): Promise<number> {
    await this.ensureDirs();
    const names = await readdir(this.pendingDir);
    return names.filter((n) => n.endsWith(".json")).length;
  }

  private async findInflightFile(id: string): Promise<string | null> {
    const names = await readdir(this.inflightDir);
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const raw = await readFile(join(this.inflightDir, name), "utf8");
      const record = JSON.parse(raw) as QueuedJob<T>;
      if (record.id === id) return name;
    }
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
