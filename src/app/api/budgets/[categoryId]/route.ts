import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveHouseholdForUser } from "@/lib/household";
import { ApiError, handleRouteError, jsonOk } from "@/lib/http";
import { parseMonthOrCurrent } from "@/lib/month";
import { decimalToNumber } from "@/lib/serialize";
import { budgetUpsertSchema, parseJsonBody } from "@/lib/validators";

type Params = {
  params: Promise<{ categoryId: string }>;
};

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUserFromRequest(request);
    const { categoryId } = await params;
    const month = parseMonthOrCurrent(request.nextUrl.searchParams.get("month"));
    const input = await parseJsonBody(request, budgetUpsertSchema);
    const membership = await resolveHouseholdForUser(user.id, input.householdId);

    const category = await db.category.findUnique({
      where: { id: categoryId },
      select: { id: true, householdId: true, name: true, type: true },
    });
    if (!category || category.householdId !== membership.householdId) {
      throw new ApiError(400, "INVALID_CATEGORY", "Category does not belong to this household");
    }

    const budget = await db.monthlyBudget.upsert({
      where: {
        householdId_month_categoryId: {
          householdId: membership.householdId,
          month,
          categoryId,
        },
      },
      update: {
        limitAmount: new Prisma.Decimal(input.limitAmount.toFixed(2)),
      },
      create: {
        householdId: membership.householdId,
        month,
        categoryId,
        limitAmount: new Prisma.Decimal(input.limitAmount.toFixed(2)),
      },
    });

    return jsonOk({
      budget: {
        id: budget.id,
        householdId: budget.householdId,
        month: budget.month,
        categoryId: budget.categoryId,
        categoryName: category.name,
        categoryType: category.type,
        limitAmount: decimalToNumber(budget.limitAmount),
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUserFromRequest(request);
    const { categoryId } = await params;
    const month = parseMonthOrCurrent(request.nextUrl.searchParams.get("month"));
    const requestedHouseholdId = request.nextUrl.searchParams.get("householdId") ?? undefined;
    const membership = await resolveHouseholdForUser(user.id, requestedHouseholdId);

    const category = await db.category.findUnique({
      where: { id: categoryId },
      select: { id: true, householdId: true },
    });
    if (!category || category.householdId !== membership.householdId) {
      throw new ApiError(400, "INVALID_CATEGORY", "Category does not belong to this household");
    }

    const deleted = await db.monthlyBudget.deleteMany({
      where: {
        householdId: membership.householdId,
        month,
        categoryId,
      },
    });

    return jsonOk({
      deleted: deleted.count > 0,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
