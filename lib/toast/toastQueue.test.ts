import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_DURATIONS,
  DEFAULT_MAX_VISIBLE,
  DEFAULT_PRIORITIES,
  DEDUPE_WINDOW_MS,
  ToastQueue,
  toast,
  toastQueue,
} from "./toastQueue";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  toastQueue.clear();
  toastQueue.setMaxVisible(DEFAULT_MAX_VISIBLE);
  vi.useRealTimers();
});

describe("DEFAULT_MAX_VISIBLE", () => {
  it("is 3", () => {
    expect(DEFAULT_MAX_VISIBLE).toBe(3);
  });

  it("is used by new ToastQueue instances", () => {
    expect(new ToastQueue().getMaxVisible()).toBe(DEFAULT_MAX_VISIBLE);
  });

  it("caps the visible stack", () => {
    const q = new ToastQueue();
    for (let i = 0; i < DEFAULT_MAX_VISIBLE + 2; i++) q.info(`m${i}`);
    expect(q.getVisible()).toHaveLength(DEFAULT_MAX_VISIBLE);
  });
});

describe("DEFAULT_DURATIONS", () => {
  it("defines a positive duration for every toast type", () => {
    expect(Object.keys(DEFAULT_DURATIONS).sort()).toEqual(["error", "info", "success"]);
    for (const value of Object.values(DEFAULT_DURATIONS)) {
      expect(value).toBeGreaterThan(0);
    }
  });

  it("keeps errors on screen longer than success and info", () => {
    expect(DEFAULT_DURATIONS.error).toBeGreaterThan(DEFAULT_DURATIONS.success);
    expect(DEFAULT_DURATIONS.error).toBeGreaterThan(DEFAULT_DURATIONS.info);
  });

  it("is applied to new toasts and auto-dismisses after that duration", () => {
    const queue = new ToastQueue();
    queue.error("e");
    queue.info("i");
    const durations = Object.fromEntries(queue.getVisible().map((t) => [t.type, t.duration]));
    expect(durations).toEqual({
      error: DEFAULT_DURATIONS.error,
      info: DEFAULT_DURATIONS.info,
    });

    vi.advanceTimersByTime(DEFAULT_DURATIONS.info);
    expect(queue.getVisible().map((t) => t.type)).toEqual(["error"]);
    vi.advanceTimersByTime(DEFAULT_DURATIONS.error - DEFAULT_DURATIONS.info);
    expect(queue.getVisible()).toHaveLength(0);
  });

  it("is overridden by an explicit duration option", () => {
    const queue = new ToastQueue();
    queue.success("s", { duration: 123 });
    expect(queue.getVisible()[0].duration).toBe(123);
  });
});

describe("DEFAULT_PRIORITIES", () => {
  it("defines a priority for every toast type", () => {
    expect(DEFAULT_PRIORITIES).toEqual({ info: 0, success: 1, error: 2 });
  });

  it("ranks error above success above info", () => {
    expect(DEFAULT_PRIORITIES.error).toBeGreaterThan(DEFAULT_PRIORITIES.success);
    expect(DEFAULT_PRIORITIES.success).toBeGreaterThan(DEFAULT_PRIORITIES.info);
  });

  it("is applied to new toasts and orders the visible stack", () => {
    const queue = new ToastQueue();
    queue.info("i");
    queue.success("s");
    queue.error("e");
    expect(queue.getVisible().map((t) => [t.type, t.priority])).toEqual([
      ["error", DEFAULT_PRIORITIES.error],
      ["success", DEFAULT_PRIORITIES.success],
      ["info", DEFAULT_PRIORITIES.info],
    ]);
  });

  it("drops the lowest-priority toast first on overflow, never an error", () => {
    const queue = new ToastQueue(2);
    queue.error("e");
    queue.info("i");
    queue.success("s");
    expect(queue.getVisible().map((t) => t.type)).toEqual(["error", "success"]);
  });

  it("is overridden by an explicit priority option", () => {
    const queue = new ToastQueue();
    queue.info("i", { priority: 9 });
    expect(queue.getVisible()[0].priority).toBe(9);
  });
});

describe("DEDUPE_WINDOW_MS", () => {
  it("is a positive number of milliseconds", () => {
    expect(DEDUPE_WINDOW_MS).toBe(1500);
  });

  it("collapses identical toasts fired inside the window", () => {
    const queue = new ToastQueue();
    const a = queue.info("same");
    vi.advanceTimersByTime(DEDUPE_WINDOW_MS - 1);
    const b = queue.info("same");
    expect(b).toBe(a);
    expect(queue.getVisible()).toHaveLength(1);
  });

  it("stacks identical toasts fired at or after the window elapses", () => {
    const queue = new ToastQueue();
    const a = queue.info("same", { duration: 0 });
    vi.advanceTimersByTime(DEDUPE_WINDOW_MS);
    const b = queue.info("same", { duration: 0 });
    expect(b).not.toBe(a);
    expect(queue.getVisible()).toHaveLength(2);
  });

  it("does not dedupe different messages or types", () => {
    const queue = new ToastQueue();
    queue.info("a");
    queue.info("b");
    queue.error("a");
    expect(queue.getVisible()).toHaveLength(3);
  });

  it("is overridden by the dedupeWindow option", () => {
    const queue = new ToastQueue();
    const a = queue.info("same", { dedupeWindow: 10, duration: 0 });
    vi.advanceTimersByTime(10);
    const b = queue.info("same", { dedupeWindow: 10, duration: 0 });
    expect(b).not.toBe(a);
  });
});

describe("ToastQueue", () => {
  it("clamps maxVisible to at least 1", () => {
    expect(new ToastQueue(0).getMaxVisible()).toBe(1);
    expect(new ToastQueue(-5).getMaxVisible()).toBe(1);
  });

  it("pushes toasts with default priority and duration", () => {
    const q = new ToastQueue();
    q.error("boom");
    const [item] = q.getVisible();
    expect(item).toMatchObject({ type: "error", priority: 2, duration: 6000 });
  });

  it("honors duration and priority overrides", () => {
    const q = new ToastQueue();
    q.info("x", { duration: 100, priority: 9 });
    expect(q.getVisible()[0]).toMatchObject({ duration: 100, priority: 9 });
  });

  it("sorts by priority then recency", () => {
    const q = new ToastQueue();
    q.info("a");
    vi.advanceTimersByTime(10);
    q.info("b");
    q.error("c");
    expect(q.getVisible().map((i) => i.message)).toEqual(["c", "b", "a"]);
  });

  it("auto-dismisses after the duration", () => {
    const q = new ToastQueue();
    q.success("ok");
    vi.advanceTimersByTime(3999);
    expect(q.getVisible()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(q.getVisible()).toHaveLength(0);
  });

  it("does not auto-dismiss when duration <= 0", () => {
    const q = new ToastQueue();
    q.info("sticky", { duration: 0 });
    vi.advanceTimersByTime(60000);
    expect(q.getVisible()).toHaveLength(1);
  });

  it("deduplicates identical toasts within the window and restarts timer", () => {
    const q = new ToastQueue();
    const a = q.info("same");
    vi.advanceTimersByTime(1000);
    const b = q.info("same");
    expect(b).toBe(a);
    expect(q.getVisible()).toHaveLength(1);
    vi.advanceTimersByTime(3500);
    expect(q.getVisible()).toHaveLength(1);
  });

  it("does not dedupe outside the window or across types", () => {
    const q = new ToastQueue();
    q.info("same");
    vi.advanceTimersByTime(2000);
    q.info("same");
    q.error("same");
    expect(q.getVisible()).toHaveLength(3);
  });

  it("drops lowest-priority oldest toasts on overflow, keeping errors", () => {
    const q = new ToastQueue(2);
    q.error("e1");
    q.info("i1");
    vi.advanceTimersByTime(10);
    q.success("s1");
    expect(q.getVisible().map((i) => i.message)).toEqual(["e1", "s1"]);
  });

  it("setMaxVisible trims the stack and notifies", () => {
    const q = new ToastQueue(3);
    q.info("a");
    q.success("b");
    q.error("c");
    const listener = vi.fn();
    q.subscribe(listener);
    q.setMaxVisible(1);
    expect(q.getMaxVisible()).toBe(1);
    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ message: "c" }),
    ]);
  });

  it("subscribe emits immediately, on changes, and stops after unsubscribe", () => {
    const q = new ToastQueue();
    const listener = vi.fn();
    const unsub = q.subscribe(listener);
    expect(listener).toHaveBeenCalledWith([]);
    q.info("a");
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
    q.info("b");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("dismiss removes by id and ignores unknown ids", () => {
    const q = new ToastQueue();
    const id = q.info("a");
    const listener = vi.fn();
    q.subscribe(listener);
    listener.mockClear();
    q.dismiss("nope");
    expect(listener).not.toHaveBeenCalled();
    q.dismiss(id);
    expect(q.getVisible()).toHaveLength(0);
  });

  it("clear removes everything and cancels timers", () => {
    const q = new ToastQueue();
    q.info("a");
    q.error("b");
    q.clear();
    expect(q.getVisible()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("toastQueue singleton", () => {
  it("is a ToastQueue with the default max visible", () => {
    expect(toastQueue).toBeInstanceOf(ToastQueue);
    expect(toastQueue.getMaxVisible()).toBe(DEFAULT_MAX_VISIBLE);
  });

  it("is shared state between calls and subscribers", () => {
    const listener = vi.fn();
    const unsub = toastQueue.subscribe(listener);
    toastQueue.info("shared");
    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ message: "shared" }),
    ]);
    unsub();
  });

  it("starts empty after clear", () => {
    toastQueue.error("x");
    toastQueue.clear();
    expect(toastQueue.getVisible()).toEqual([]);
  });
});

describe("toast", () => {
  it("success/error/info enqueue on the shared queue and return ids", () => {
    const s = toast.success("s");
    const e = toast.error("e");
    const i = toast.info("i");
    expect(new Set([s, e, i]).size).toBe(3);
    expect(toastQueue.getVisible().map((t) => t.type)).toEqual([
      "error",
      "success",
      "info",
    ]);
  });

  it("forwards options", () => {
    toast.info("opt", { duration: 50, priority: 7 });
    expect(toastQueue.getVisible()[0]).toMatchObject({ duration: 50, priority: 7 });
    vi.advanceTimersByTime(50);
    expect(toastQueue.getVisible()).toHaveLength(0);
  });

  it("dismiss removes a toast by id; unknown id is a no-op", () => {
    const id = toast.info("a");
    toast.dismiss("missing");
    expect(toastQueue.getVisible()).toHaveLength(1);
    toast.dismiss(id);
    expect(toastQueue.getVisible()).toHaveLength(0);
  });

  it("clear removes all toasts", () => {
    toast.info("a");
    toast.error("b");
    toast.clear();
    expect(toastQueue.getVisible()).toHaveLength(0);
  });
});
