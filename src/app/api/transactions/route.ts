import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveHouseholdForUser } from "@/lib/household";
import { ApiError, handleRouteError, jsonOk } from "@/lib/http";
import { monthRangeUtc, parseMonthOrCurrent } from "@/lib/month";
import { decimalToNumber } from "@/lib/serialize";
import { parseJsonBody, transactionCreateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const month = parseMonthOrCurrent(request.nextUrl.searchParams.get("month"));
    const requestedHouseholdId = request.nextUrl.searchParams.get("householdId") ?? undefined;
    const membership = await resolveHouseholdForUser(user.id, requestedHouseholdId);
    const { start, endExclusive } = monthRangeUtc(month);

    const transactions = await db.transaction.findMany({
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
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
    });

    const data = transactions.map((tx) => ({
      id: tx.id,
      householdId: tx.householdId,
      amount: decimalToNumber(tx.amount),
      type: tx.type,
      categoryId: tx.categoryId,
      categoryName: tx.category.name,
      memo: tx.memo,
      spentAt: tx.spentAt,
      createdBy: tx.createdBy,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    }));

    const totalIncome = data
      .filter((tx) => tx.type === "income")
      .reduce((acc, tx) => acc + tx.amount, 0);
    const totalExpense = data
      .filter((tx) => tx.type === "expense")
      .reduce((acc, tx) => acc + tx.amount, 0);

    return jsonOk({
      month,
      householdId: membership.householdId,
      totals: {
        income: totalIncome,
        expense: totalExpense,
        balance: totalIncome - totalExpense,
      },
      transactions: data,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const input = await parseJsonBody(request, transactionCreateSchema);
    const membership = await resolveHouseholdForUser(user.id, input.householdId);

    const category = await db.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true, householdId: true, type: true, name: true },
    });
    if (!category || category.householdId !== membership.householdId) {
      throw new ApiError(400, "INVALID_CATEGORY", "Category does not belong to this household");
    }
    if (category.type !== input.type) {
      throw new ApiError(400, "INVALID_TYPE", "Category type and transaction type must match");
    }

    const headerKey = request.headers.get("x-idempotency-key") ?? undefined;
    const idempotencyKey = input.idempotencyKey ?? headerKey ?? randomUUID();

    try {
      const created = await db.transaction.create({
        data: {
          householdId: membership.householdId,
          amount: new Prisma.Decimal(input.amount.toFixed(2)),
          type: input.type,
          categoryId: input.categoryId,
          memo: input.memo,
          spentAt: input.spentAt,
          createdBy: user.id,
          idempotencyKey,
        },
        include: {
          category: {
            select: { name: true },
          },
        },
      });

      return jsonOk(
        {
          transaction: {
            id: created.id,
            householdId: created.householdId,
            amount: decimalToNumber(created.amount),
            type: created.type,
            categoryId: created.categoryId,
            categoryName: created.category.name,
            memo: created.memo,
            spentAt: created.spentAt,
            createdBy: created.createdBy,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          },
          deduplicated: false,
        },
        201,
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await db.transaction.findFirst({
          where: {
            householdId: membership.householdId,
            idempotencyKey,
          },
          include: {
            category: {
              select: { name: true },
            },
          },
        });
        if (existing) {
          return jsonOk({
            transaction: {
              id: existing.id,
              householdId: existing.householdId,
              amount: decimalToNumber(existing.amount),
              type: existing.type,
              categoryId: existing.categoryId,
              categoryName: existing.category.name,
              memo: existing.memo,
              spentAt: existing.spentAt,
              createdBy: existing.createdBy,
              createdAt: existing.createdAt,
              updatedAt: existing.updatedAt,
            },
            deduplicated: true,
          });
        }
      }
      throw error;
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
