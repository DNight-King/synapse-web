import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  DEFAULT_DURATIONS,
  DEFAULT_PRIORITIES,
  DEDUPE_WINDOW_MS,
  ToastQueue,
} from "./toastQueue";

describe("DEFAULT_DURATIONS", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

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
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

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
