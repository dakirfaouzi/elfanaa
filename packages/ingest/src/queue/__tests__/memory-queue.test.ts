import { describe, expect, it } from "vitest";
import { MemoryQueue } from "../memory-queue";

describe("MemoryQueue", () => {
  it("dequeues in FIFO order", async () => {
    const q = new MemoryQueue<{ n: number }>();
    await q.enqueue({ n: 1 });
    await q.enqueue({ n: 2 });
    await q.enqueue({ n: 3 });

    const a = await q.dequeue();
    const b = await q.dequeue();
    const c = await q.dequeue();

    expect(a?.job.n).toBe(1);
    expect(b?.job.n).toBe(2);
    expect(c?.job.n).toBe(3);
  });

  it("returns null when empty and timeoutMs is unset", async () => {
    const q = new MemoryQueue<{ n: number }>();
    const result = await q.dequeue();
    expect(result).toBeNull();
  });

  it("respects timeoutMs and returns null on expiry", async () => {
    const q = new MemoryQueue<{ n: number }>();
    const startedAt = Date.now();
    const result = await q.dequeue({ timeoutMs: 80 });
    const elapsed = Date.now() - startedAt;

    expect(result).toBeNull();
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  it("size() drops to zero after every job is dequeued", async () => {
    const q = new MemoryQueue<{ n: number }>();
    await q.enqueue({ n: 1 });
    await q.enqueue({ n: 2 });
    expect(await q.size()).toBe(2);
    await q.dequeue();
    await q.dequeue();
    expect(await q.size()).toBe(0);
  });

  it("markComplete removes the job from the inflight set (no-op on missing id)", async () => {
    const q = new MemoryQueue<{ n: number }>();
    const { id } = await q.enqueue({ n: 1 });
    const dequeued = await q.dequeue();
    expect(dequeued?.id).toBe(id);
    await q.markComplete(id);
    // Calling again is a no-op (idempotent).
    await q.markComplete(id);
  });
});
