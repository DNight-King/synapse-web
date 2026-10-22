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
