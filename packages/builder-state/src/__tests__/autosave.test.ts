import { describe, expect, it, vi } from "vitest";
import type { DraftDocument } from "@platform/builder-schema";
import { makeBlankDraft } from "@platform/builder-schema";
import { createAutosaveScheduler } from "../autosave";
import type { TimerLike } from "../autosave";

function makeFakeTimer() {
  let cursor = 0;
  let nextId = 1;
  type Pending = { id: number; due: number; cb: () => void };
  const pending: Pending[] = [];

  const timer: TimerLike = {
    setTimeout: (cb, ms) => {
      const id = nextId++;
      pending.push({ id, due: cursor + ms, cb });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (handle) => {
      const idx = pending.findIndex((p) => p.id === (handle as unknown as number));
      if (idx >= 0) pending.splice(idx, 1);
    },
    now: () => cursor,
  };

  return {
    timer,
    advance(ms: number) {
      cursor += ms;
      const due = pending.filter((p) => p.due <= cursor);
      for (const p of due) {
        const idx = pending.indexOf(p);
        if (idx >= 0) pending.splice(idx, 1);
      }
      for (const p of due) p.cb();
    },
    pendingCount: () => pending.length,
  };
}

let n = 0;
const id = () => `sec_${++n}`;
function makeDoc(): DraftDocument {
  return makeBlankDraft({ slug: "x", title: { en: "X" }, newId: id });
}

describe("autosave scheduler", () => {
  it("debounces multiple notifies into a single save call", async () => {
    const fakeTimer = makeFakeTimer();
    const save = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi.fn();
    const scheduler = createAutosaveScheduler({
      debounceMs: 800,
      save,
      onSaved,
      timer: fakeTimer.timer,
    });
    const doc = makeDoc();
    scheduler.notify(1, doc);
    fakeTimer.advance(200);
    scheduler.notify(2, doc);
    fakeTimer.advance(200);
    scheduler.notify(3, doc);
    expect(save).not.toHaveBeenCalled();
    fakeTimer.advance(900);
    await new Promise((r) => setImmediate(r));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toBe(3);
    expect(onSaved).toHaveBeenCalledWith(3, expect.any(Number));
  });

  it("emits saving → saved on success", async () => {
    const fakeTimer = makeFakeTimer();
    const events: string[] = [];
    const scheduler = createAutosaveScheduler({
      debounceMs: 50,
      save: async () => {
        events.push("save");
      },
      onSaving: () => events.push("saving"),
      onSaved: () => events.push("saved"),
      timer: fakeTimer.timer,
    });
    scheduler.notify(1, makeDoc());
    fakeTimer.advance(60);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(events).toEqual(["saving", "save", "saved"]);
  });

  it("reports save errors via onError", async () => {
    const fakeTimer = makeFakeTimer();
    const onError = vi.fn();
    const scheduler = createAutosaveScheduler({
      debounceMs: 50,
      save: async () => {
        throw new Error("boom");
      },
      onError,
      timer: fakeTimer.timer,
    });
    scheduler.notify(1, makeDoc());
    fakeTimer.advance(60);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe("boom");
  });

  it("queues a second save while one is in flight", async () => {
    const fakeTimer = makeFakeTimer();
    const releaseSlot: { fn: (() => void) | null } = { fn: null };
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseSlot.fn = resolve;
        }),
    );
    const scheduler = createAutosaveScheduler({
      debounceMs: 10,
      save,
      timer: fakeTimer.timer,
    });
    scheduler.notify(1, makeDoc());
    fakeTimer.advance(20);
    await new Promise((r) => setImmediate(r));
    expect(save).toHaveBeenCalledTimes(1);

    scheduler.notify(2, makeDoc());
    fakeTimer.advance(20);
    await new Promise((r) => setImmediate(r));
    expect(save).toHaveBeenCalledTimes(1);

    releaseSlot.fn?.();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][1]).toBe(2);
  });

  it("flush() bypasses the debounce", async () => {
    const fakeTimer = makeFakeTimer();
    const save = vi.fn().mockResolvedValue(undefined);
    const scheduler = createAutosaveScheduler({
      debounceMs: 1_000_000,
      save,
      timer: fakeTimer.timer,
    });
    scheduler.notify(1, makeDoc());
    await scheduler.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("dispose() prevents further callbacks", async () => {
    const fakeTimer = makeFakeTimer();
    const save = vi.fn().mockResolvedValue(undefined);
    const scheduler = createAutosaveScheduler({
      debounceMs: 50,
      save,
      timer: fakeTimer.timer,
    });
    scheduler.notify(1, makeDoc());
    scheduler.dispose();
    fakeTimer.advance(100);
    await new Promise((r) => setImmediate(r));
    expect(save).not.toHaveBeenCalled();
  });
});
