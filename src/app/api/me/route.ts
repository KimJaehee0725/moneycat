import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const memberships = await db.householdMember.findMany({
      where: { userId: user.id },
      select: {
        householdId: true,
        role: true,
        household: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return jsonOk({
      user,
      households: memberships.map((membership) => ({
        householdId: membership.householdId,
        role: membership.role,
        name: membership.household.name,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
