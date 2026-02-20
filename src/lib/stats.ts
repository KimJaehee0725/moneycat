type TxType = "income" | "expense";

export type StatsTransactionInput = {
  amount: number;
  type: TxType;
  categoryId: string;
  categoryName: string;
};

export type StatsBudgetInput = {
  categoryId: string;
  categoryName: string;
  limitAmount: number;
};

type CategoryBucket = {
  categoryId: string;
  categoryName: string;
  amount: number;
};

export function calculateMonthlyStats(
  transactions: StatsTransactionInput[],
  budgets: StatsBudgetInput[],
) {
  let totalIncome = 0;
  let totalExpense = 0;
  const bucket = new Map<string, CategoryBucket>();

  for (const tx of transactions) {
    if (tx.type === "income") {
      totalIncome += tx.amount;
      continue;
    }

    totalExpense += tx.amount;
    const key = tx.categoryId;
    const current = bucket.get(key) ?? {
      categoryId: tx.categoryId,
      categoryName: tx.categoryName,
      amount: 0,
    };
    current.amount += tx.amount;
    bucket.set(key, current);
  }

  const byCategoryExpense = [...bucket.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      ...item,
      ratio: totalExpense > 0 ? Number((item.amount / totalExpense).toFixed(4)) : 0,
    }));

  const budgetsWithUsage = budgets.map((budget) => {
    const spent = bucket.get(budget.categoryId)?.amount ?? 0;
    const remaining = budget.limitAmount - spent;
    const usageRate = budget.limitAmount > 0 ? spent / budget.limitAmount : 0;
    return {
      ...budget,
      spent,
      remaining,
      usageRate: Number(usageRate.toFixed(4)),
      exceeded: spent > budget.limitAmount,
    };
  });

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategoryExpense,
    budgets: budgetsWithUsage,
  };
}
