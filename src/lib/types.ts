export type HouseholdSummary = {
  householdId: string;
  name: string;
  role: "owner" | "member";
};

export type CategoryDto = {
  id: string;
  name: string;
  type: "income" | "expense";
  isDefault: boolean;
};

export type TransactionDto = {
  id: string;
  householdId: string;
  amount: number;
  type: "income" | "expense";
  categoryId: string;
  categoryName: string;
  memo: string | null;
  spentAt: string | Date;
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type BudgetDto = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryType: "income" | "expense";
  limitAmount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type MonthlyStatsDto = {
  month: string;
  householdId: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategoryExpense: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    ratio: number;
  }>;
  budgets: Array<{
    categoryId: string;
    categoryName: string;
    limitAmount: number;
    spent: number;
    remaining: number;
    usageRate: number;
    exceeded: boolean;
  }>;
};
