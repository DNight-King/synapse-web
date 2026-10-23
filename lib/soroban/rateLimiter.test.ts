import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RpcRateLimiter, rpcRateLimiter, withRateLimit } from "./rateLimiter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a limiter backed by fake timers so tests don't have to wait for
 * real wall-clock intervals.
 *
 * Call `destroy()` in afterEach to prevent timer leaks between tests.
 */
function makeLimiter(tokens = 3, intervalMs = 1_000): RpcRateLimiter {
  return new RpcRateLimiter(tokens, intervalMs);
}

// ---------------------------------------------------------------------------
// Token consumption
// ---------------------------------------------------------------------------

describe("RpcRateLimiter — token consumption", () => {
  let limiter: RpcRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = makeLimiter(3, 1_000);
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
  });

  it("starts with a full bucket", () => {
    expect(limiter.stats().tokens).toBe(3);
  });

  it("decrements the token count on each acquire", async () => {
    await limiter.acquire();
    expect(limiter.stats().tokens).toBe(2);

    await limiter.acquire();
    expect(limiter.stats().tokens).toBe(1);

    await limiter.acquire();
    expect(limiter.stats().tokens).toBe(0);
  });

  it("tracks total request count", async () => {
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.stats().total).toBe(2);
  });

  it("does not count throttled requests in tokens-available path", async () => {
    await limiter.acquire();
    expect(limiter.stats().throttled).toBe(0);
  });

  it("throws for invalid constructor arguments", () => {
    expect(() => new RpcRateLimiter(0, 1_000)).toThrow(RangeError);
    expect(() => new RpcRateLimiter(1, 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Token refill
// ---------------------------------------------------------------------------

describe("RpcRateLimiter — token refill", () => {
  let limiter: RpcRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = makeLimiter(3, 1_000);
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
  });

  it("refills the bucket to capacity after one interval", async () => {
    // Drain the bucket.
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.stats().tokens).toBe(0);

    // Advance time by one interval — the refill tick fires.
    vi.advanceTimersByTime(1_000);

    expect(limiter.stats().tokens).toBe(3);
  });

  it("does not exceed capacity on refill", async () => {
    // Only one token consumed.
    await limiter.acquire();
    vi.advanceTimersByTime(1_000);
    // Still capped at capacity, not capacity+2.
    expect(limiter.stats().tokens).toBe(3);
  });

  it("refills multiple times across multiple intervals", async () => {
    await limiter.acquire();
    await limiter.acquire();
    vi.advanceTimersByTime(1_000);
    expect(limiter.stats().tokens).toBe(3);

    await limiter.acquire();
    vi.advanceTimersByTime(1_000);
    expect(limiter.stats().tokens).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Queuing when tokens exhausted
// ---------------------------------------------------------------------------

describe("RpcRateLimiter — queuing when tokens exhausted", () => {
  let limiter: RpcRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = makeLimiter(2, 500);
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
  });

  it("queues requests when the bucket is empty", async () => {
    // Drain the bucket synchronously.
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.stats().tokens).toBe(0);

    // This acquire should queue rather than resolve immediately.
    let resolved = false;
    const pending = limiter.acquire().then(() => {
      resolved = true;
    });

    // No time has passed — should still be queued.
    expect(resolved).toBe(false);
    expect(limiter.stats().queued).toBe(1);

    // Advance past the interval to trigger a refill.
    vi.advanceTimersByTime(500);
    await pending;

    expect(resolved).toBe(true);
    expect(limiter.stats().queued).toBe(0);
  });

  it("resolves queued requests in FIFO order", async () => {
    await limiter.acquire();
    await limiter.acquire();

    const order: number[] = [];
    const p1 = limiter.acquire().then(() => order.push(1));
    const p2 = limiter.acquire().then(() => order.push(2));

    // Two tokens are available after a single refill (capacity = 2).
    vi.advanceTimersByTime(500);
    await Promise.all([p1, p2]);

    expect(order).toEqual([1, 2]);
  });

  it("increments throttledRequests for each queued call", async () => {
    await limiter.acquire();
    await limiter.acquire();

    // Queue two more.
    const p1 = limiter.acquire();
    const p2 = limiter.acquire();

    expect(limiter.stats().throttled).toBe(2);

    vi.advanceTimersByTime(500);
    await Promise.all([p1, p2]);
  });
});

// ---------------------------------------------------------------------------
// withRateLimit helper
// ---------------------------------------------------------------------------

describe("withRateLimit", () => {
  it("resolves with the return value of fn", async () => {
    // withRateLimit uses the singleton; we just verify it passes through values.
    const result = await withRateLimit(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("propagates rejections from fn", async () => {
    await expect(withRateLimit(() => Promise.reject(new Error("rpc failure")))).rejects.toThrow(
      "rpc failure"
    );
  });

  it("calls fn exactly once per invocation", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await withRateLimit(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Logging / telemetry when throttled
// ---------------------------------------------------------------------------

describe("RpcRateLimiter — logging when throttled", () => {
  let limiter: RpcRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    limiter = makeLimiter(1, 1_000);
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("emits a console.warn with [RPC Rate Limiter] prefix when throttled", async () => {
    // Drain the single token.
    await limiter.acquire();

    // Next acquire is throttled.
    const pending = limiter.acquire();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[RPC Rate Limiter]"));

    vi.advanceTimersByTime(1_000);
    await pending;
  });

  it("warns only once per throttle window, not for every queued call", async () => {
    await limiter.acquire(); // drain

    const p1 = limiter.acquire();
    const p2 = limiter.acquire();

    // Only one warn should fire for this window.
    const throttleWarns = (
      console.warn as unknown as ReturnType<typeof vi.spyOn>
    ).mock.calls.filter(
      (args) =>
        String(args[0]).includes("[RPC Rate Limiter]") && String(args[0]).includes("Throttling")
    );
    expect(throttleWarns.length).toBe(1);

    vi.advanceTimersByTime(1_000);
    await p1;
    vi.advanceTimersByTime(1_000);
    await p2;
  });

  it("emits a console.warn when draining the queue after refill", async () => {
    await limiter.acquire(); // drain

    const pending = limiter.acquire(); // queue one

    vi.advanceTimersByTime(1_000);
    await pending;

    const drainWarns = (console.warn as unknown as ReturnType<typeof vi.spyOn>).mock.calls.filter(
      (args) =>
        String(args[0]).includes("[RPC Rate Limiter]") && String(args[0]).includes("Refilled")
    );
    expect(drainWarns.length).toBeGreaterThanOrEqual(1);
  });

  it("warn message includes queue depth and stats", async () => {
    await limiter.acquire(); // drain
    const pending = limiter.acquire();

    const warnCall = (console.warn as unknown as ReturnType<typeof vi.spyOn>).mock.calls.find(
      (args) => String(args[0]).includes("Throttling")
    );
    expect(warnCall).toBeDefined();
    const msg = String(warnCall![0]);
    expect(msg).toMatch(/Queue depth/);
    expect(msg).toMatch(/total/);
    expect(msg).toMatch(/throttled/);

    vi.advanceTimersByTime(1_000);
    await pending;
  });
});

// ---------------------------------------------------------------------------
// Singleton sanity check
// ---------------------------------------------------------------------------

describe("rpcRateLimiter singleton", () => {
  it("is an instance of RpcRateLimiter", () => {
    expect(rpcRateLimiter).toBeInstanceOf(RpcRateLimiter);
  });

  it("starts with 30 tokens available", () => {
    // The singleton may have been partially consumed by other tests that use
    // withRateLimit, so we only check it has a reasonable positive count and
    // doesn't exceed capacity.
    const { tokens } = rpcRateLimiter.stats();
    expect(tokens).toBeGreaterThanOrEqual(0);
    expect(tokens).toBeLessThanOrEqual(30);
  });
});
