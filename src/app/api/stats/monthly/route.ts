import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveHouseholdForUser } from "@/lib/household";
import { handleRouteError, jsonOk } from "@/lib/http";
import { monthRangeUtc, parseMonthOrCurrent } from "@/lib/month";
import { decimalToNumber } from "@/lib/serialize";
import { calculateMonthlyStats } from "@/lib/stats";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const month = parseMonthOrCurrent(request.nextUrl.searchParams.get("month"));
    const requestedHouseholdId = request.nextUrl.searchParams.get("householdId") ?? undefined;
    const membership = await resolveHouseholdForUser(user.id, requestedHouseholdId);
    const { start, endExclusive } = monthRangeUtc(month);

    const [transactions, budgets] = await Promise.all([
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
            select: { id: true, name: true },
          },
        },
      }),
      db.monthlyBudget.findMany({
        where: {
          householdId: membership.householdId,
          month,
        },
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
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

    return jsonOk({
      month,
      householdId: membership.householdId,
      ...stats,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
