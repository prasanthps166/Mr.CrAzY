import { afterEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit } from "@/lib/rate-limit";

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("blocks requests after the configured limit", async () => {
    const key = `rate-limit-${Date.now()}-${Math.random()}`;

    const first = await checkRateLimit(key, 2, 10_000);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(first.backend).toBe("memory");

    const second = await checkRateLimit(key, 2, 10_000);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(second.backend).toBe("memory");

    const third = await checkRateLimit(key, 2, 10_000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.resetAt).toBe(first.resetAt);
    expect(third.backend).toBe("memory");
  });

  it("resets counts when the time window expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T00:00:00.000Z"));

    const key = `rate-window-${Date.now()}-${Math.random()}`;
    const first = await checkRateLimit(key, 1, 1_000);
    expect(first.allowed).toBe(true);
    expect(first.backend).toBe("memory");

    const blocked = await checkRateLimit(key, 1, 1_000);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1_001);

    const afterReset = await checkRateLimit(key, 1, 1_000);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(0);
    expect(afterReset.resetAt).toBeGreaterThan(first.resetAt);
    expect(afterReset.backend).toBe("memory");
  });
});
