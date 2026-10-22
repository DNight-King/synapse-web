import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_MAX_VISIBLE,
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
