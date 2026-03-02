import { afterEach, describe, expect, it, vi } from "vitest";

import { getIstDayStart, isBeforeCurrentIstDay } from "@/lib/credits";

afterEach(() => {
  vi.useRealTimers();
});

describe("credit date helpers", () => {
  it("returns UTC time for IST midnight", () => {
    const input = new Date("2026-03-02T10:15:00.000Z");
    const dayStart = getIstDayStart(input);
    expect(dayStart.toISOString()).toBe("2026-03-01T18:30:00.000Z");
  });

  it("detects timestamps before the current IST day start", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T12:00:00.000Z"));

    expect(isBeforeCurrentIstDay("2026-03-01T18:29:59.000Z")).toBe(true);
    expect(isBeforeCurrentIstDay("2026-03-01T18:30:01.000Z")).toBe(false);
    expect(isBeforeCurrentIstDay(null)).toBe(true);
  });
});
