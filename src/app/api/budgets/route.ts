import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveHouseholdForUser } from "@/lib/household";
import { handleRouteError, jsonOk } from "@/lib/http";
import { parseMonthOrCurrent } from "@/lib/month";
import { decimalToNumber } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const month = parseMonthOrCurrent(request.nextUrl.searchParams.get("month"));
    const requestedHouseholdId = request.nextUrl.searchParams.get("householdId") ?? undefined;
    const membership = await resolveHouseholdForUser(user.id, requestedHouseholdId);

    const budgets = await db.monthlyBudget.findMany({
      where: {
        householdId: membership.householdId,
        month,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ category: { type: "asc" } }, { category: { name: "asc" } }],
    });

    return jsonOk({
      month,
      householdId: membership.householdId,
      budgets: budgets.map((budget) => ({
        id: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        categoryType: budget.category.type,
        limitAmount: decimalToNumber(budget.limitAmount),
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
