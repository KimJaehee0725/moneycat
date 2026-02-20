import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashInviteCode } from "@/lib/household";
import { ApiError, handleRouteError, jsonOk } from "@/lib/http";
import { householdJoinSchema, parseJsonBody } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const input = await parseJsonBody(request, householdJoinSchema);
    const tokenHash = hashInviteCode(input.inviteCode);
    const now = new Date();

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

    const joined = await db.$transaction(async (tx) => {
      const invite = await tx.inviteToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          householdId: true,
          expiresAt: true,
          usedAt: true,
          household: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!invite || invite.usedAt || invite.expiresAt < now) {
        throw new ApiError(400, "INVALID_INVITE", "Invite code is invalid or expired");
      }

      const memberCount = await tx.householdMember.count({
        where: { householdId: invite.householdId },
      });
      if (memberCount >= 2) {
        throw new ApiError(409, "MEMBER_LIMIT_REACHED", "This household already has two members");
      }

      await tx.householdMember.create({
        data: {
          householdId: invite.householdId,
          userId: user.id,
          role: "member",
        },
      });

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: now },
      });

      return {
        householdId: invite.householdId,
        name: invite.household.name,
      };
    });

    return jsonOk({ household: joined });
  } catch (error) {
    return handleRouteError(error);
  }
}
