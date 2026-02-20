import { describe, expect, it } from "vitest";

import { assertMonth, listMonths, monthRangeUtc } from "@/lib/month";

describe("month helpers", () => {
  it("validates YYYY-MM format", () => {
    expect(assertMonth("2026-02")).toBe("2026-02");
  });

  it("throws on invalid month format", () => {
    expect(() => assertMonth("2026-2")).toThrowError();
  });

  it("returns UTC range for month", () => {
    const range = monthRangeUtc("2026-02");
    expect(range.start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("lists month sequence", () => {
    expect(listMonths("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});
