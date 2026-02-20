import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard-client";
import { requireUserFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentMonth, monthRangeUtc } from "@/lib/month";
import { decimalToNumber } from "@/lib/serialize";
import { calculateMonthlyStats } from "@/lib/stats";

export default async function DashboardPage() {
  let user;
  try {
    user = await requireUserFromCookies();
  } catch {
    redirect("/login");
  }

  const membership = await db.householdMember.findFirst({
    where: { userId: user.id },
    include: {
      household: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (!membership) {
    redirect("/register");
  }

  const month = currentMonth();
  const { start, endExclusive } = monthRangeUtc(month);

  const [categories, transactions, budgets] = await Promise.all([
    db.category.findMany({
      where: { householdId: membership.householdId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        isDefault: true,
      },
    }),
    db.transaction.findMany({
      where: {
        householdId: membership.householdId,
        spentAt: {
          gte: start,
          lt: endExclusive,
        },
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
    }),
    db.monthlyBudget.findMany({
      where: {
        householdId: membership.householdId,
        month,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ category: { type: "asc" } }, { category: { name: "asc" } }],
    }),
  ]);

  const stats = calculateMonthlyStats(
    transactions.map((tx) => ({
      amount: decimalToNumber(tx.amount),
      type: tx.type,
      categoryId: tx.categoryId,
      categoryName: tx.category.name,
    })),
    budgets.map((budget) => ({
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      limitAmount: decimalToNumber(budget.limitAmount),
    })),
  );

  return (
    <DashboardClient
      userEmail={user.email}
      householdId={membership.householdId}
      householdName={membership.household.name}
      role={membership.role}
      month={month}
      categories={categories}
      initialTransactions={transactions.map((tx) => ({
        id: tx.id,
        householdId: tx.householdId,
        amount: decimalToNumber(tx.amount),
        type: tx.type,
        categoryId: tx.categoryId,
        categoryName: tx.category.name,
        memo: tx.memo,
        spentAt: tx.spentAt.toISOString(),
        createdBy: tx.createdBy,
        createdAt: tx.createdAt.toISOString(),
        updatedAt: tx.updatedAt.toISOString(),
      }))}
      initialBudgets={budgets.map((budget) => ({
        id: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        categoryType: categories.find((item) => item.id === budget.categoryId)?.type ?? "expense",
        limitAmount: decimalToNumber(budget.limitAmount),
        createdAt: budget.createdAt.toISOString(),
        updatedAt: budget.updatedAt.toISOString(),
      }))}
      initialStats={{
        month,
        householdId: membership.householdId,
        ...stats,
      }}
    />
  );
}
