import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { createDefaultCategories } from "@/lib/household";
import { ApiError, handleRouteError, jsonOk } from "@/lib/http";
import { householdCreateSchema, parseJsonBody } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const households = await db.householdMember.findMany({
      where: { userId: user.id },
      select: {
        householdId: true,
        role: true,
        household: {
          select: {
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    return jsonOk({
      households: households.map((item) => ({
        householdId: item.householdId,
        role: item.role,
        name: item.household.name,
        createdAt: item.household.createdAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const input = await parseJsonBody(request, householdCreateSchema);

    const existingMembership = await db.householdMember.findFirst({
      where: { userId: user.id },
      select: { householdId: true },
    });
    if (existingMembership) {
      throw new ApiError(
        409,
        "ALREADY_IN_HOUSEHOLD",
        "User already belongs to a household in the current v1 model",
      );
    }

    const household = await db.$transaction(async (tx) => {
      const created = await tx.household.create({
        data: {
          name: input.name,
          ownerUserId: user.id,
          members: {
            create: {
              userId: user.id,
              role: "owner",
            },
          },
        },
        select: { id: true, name: true, createdAt: true },
      });
      await createDefaultCategories(tx, created.id);
      return created;
    });

    return jsonOk({ household }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
