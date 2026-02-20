import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveHouseholdForUser } from "@/lib/household";
import { ApiError, handleRouteError, jsonOk } from "@/lib/http";
import { decimalToNumber } from "@/lib/serialize";
import { parseJsonBody, transactionPatchSchema } from "@/lib/validators";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await params;
    const input = await parseJsonBody(request, transactionPatchSchema);

    const existing = await db.transaction.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, type: true, householdId: true } },
      },
    });
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Transaction not found");
    }

    const membership = await resolveHouseholdForUser(user.id, existing.householdId);

    let nextCategoryId = input.categoryId ?? existing.categoryId;
    const nextType = input.type ?? existing.type;
    if (input.categoryId) {
      const nextCategory = await db.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true, type: true, householdId: true },
      });
      if (!nextCategory || nextCategory.householdId !== membership.householdId) {
        throw new ApiError(400, "INVALID_CATEGORY", "Category does not belong to this household");
      }
      if (nextCategory.type !== nextType) {
        throw new ApiError(400, "INVALID_TYPE", "Category type and transaction type must match");
      }
      nextCategoryId = nextCategory.id;
    } else if (input.type && input.type !== existing.type && existing.category.type !== input.type) {
      throw new ApiError(400, "INVALID_TYPE", "Current category does not match updated type");
    }

    const updated = await db.transaction.update({
      where: { id },
      data: {
        amount:
          input.amount !== undefined
            ? new Prisma.Decimal(input.amount.toFixed(2))
            : undefined,
        type: nextType,
        categoryId: nextCategoryId,
        memo: input.memo,
        spentAt: input.spentAt,
      },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    return jsonOk({
      transaction: {
        id: updated.id,
        householdId: updated.householdId,
        amount: decimalToNumber(updated.amount),
        type: updated.type,
        categoryId: updated.categoryId,
        categoryName: updated.category.name,
        memo: updated.memo,
        spentAt: updated.spentAt,
        createdBy: updated.createdBy,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await params;

    const existing = await db.transaction.findUnique({
      where: { id },
      select: { id: true, householdId: true },
    });
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Transaction not found");
    }

    await resolveHouseholdForUser(user.id, existing.householdId);
    await db.transaction.delete({ where: { id } });

    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
