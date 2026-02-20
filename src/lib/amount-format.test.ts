import { describe, expect, it } from "vitest";

import { formatKoreanAmount, formatKrw, formatKrwWithKorean } from "@/lib/amount-format";

describe("amount format", () => {
  it("formats korean unit text", () => {
    expect(formatKoreanAmount(12345678)).toBe("1,234만 5천 6백 7십 8원");
    expect(formatKoreanAmount(150000)).toBe("15만원");
  });

  it("formats won + korean structure", () => {
    const formatted = formatKrw(10000);
    expect(formatted.won).toBe("₩10,000");
    expect(formatted.korean).toBe("1만원");
    expect(formatKrwWithKorean(10000)).toBe("₩10,000 (1만원)");
  });
});
