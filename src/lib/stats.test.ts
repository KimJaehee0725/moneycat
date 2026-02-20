import { describe, expect, it } from "vitest";

import { calculateMonthlyStats } from "@/lib/stats";

describe("calculateMonthlyStats", () => {
  it("calculates totals, category ratios, and budget usage", () => {
    const result = calculateMonthlyStats(
      [
        {
          amount: 3000000,
          type: "income",
          categoryId: "salary",
          categoryName: "월급",
        },
        {
          amount: 50000,
          type: "expense",
          categoryId: "food",
          categoryName: "식비",
        },
        {
          amount: 30000,
          type: "expense",
          categoryId: "transport",
          categoryName: "교통",
        },
      ],
      [
        {
          categoryId: "food",
          categoryName: "식비",
          limitAmount: 100000,
        },
        {
          categoryId: "transport",
          categoryName: "교통",
          limitAmount: 20000,
        },
      ],
    );

    expect(result.totalIncome).toBe(3000000);
    expect(result.totalExpense).toBe(80000);
    expect(result.balance).toBe(2920000);
    expect(result.byCategoryExpense[0]).toMatchObject({
      categoryId: "food",
      amount: 50000,
    });
    expect(result.budgets.find((item) => item.categoryId === "transport")).toMatchObject({
      spent: 30000,
      exceeded: true,
    });
  });
});
