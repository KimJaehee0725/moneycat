import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveHouseholdForUser } from "@/lib/household";
import { ApiError, handleRouteError, jsonOk } from "@/lib/http";
import { categoryCreateSchema, parseJsonBody } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const requestedHouseholdId = request.nextUrl.searchParams.get("householdId") ?? undefined;
    const membership = await resolveHouseholdForUser(user.id, requestedHouseholdId);

    const categories = await db.category.findMany({
      where: { householdId: membership.householdId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        isDefault: true,
      },
    });

    return jsonOk({
      householdId: membership.householdId,
      categories,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const input = await parseJsonBody(request, categoryCreateSchema);
    const membership = await resolveHouseholdForUser(user.id, input.householdId);

    const category = await db.category.create({
      data: {
        householdId: membership.householdId,
        name: input.name,
        type: input.type,
        isDefault: false,
      },
      select: {
        id: true,
        name: true,
        type: true,
        isDefault: true,
      },
    });

    return jsonOk({ householdId: membership.householdId, category }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return handleRouteError(
        new ApiError(
          409,
          "CATEGORY_ALREADY_EXISTS",
          "같은 분류(수입/지출)에 동일한 카테고리 이름이 이미 있습니다.",
        ),
      );
    }
    return handleRouteError(error);
  }
}
