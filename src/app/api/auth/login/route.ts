import { NextRequest } from "next/server";

import { setSessionCookie, signSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, handleRouteError, jsonOk } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { parseJsonBody, loginSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const input = await parseJsonBody(request, loginSchema);
    const email = input.email.toLowerCase();

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, createdAt: true },
    });

    if (!user) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

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

    const token = await signSessionToken({ sub: user.id, email: user.email });
    const response = jsonOk({
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
      households: memberships.map((membership) => ({
        householdId: membership.householdId,
        role: membership.role,
        name: membership.household.name,
      })),
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
