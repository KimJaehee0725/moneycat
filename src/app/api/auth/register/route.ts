import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { setSessionCookie, signSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { createDefaultCategories, hashInviteCode } from "@/lib/household";
import { ApiError, handleRouteError, jsonOk } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { parseJsonBody, registerSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const input = await parseJsonBody(request, registerSchema);
    const email = input.email.toLowerCase();

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "Email is already registered");
    }

    const passwordHash = await hashPassword(input.password);
    const now = new Date();

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
        },
        select: { id: true, email: true, createdAt: true },
      });

      let householdId: string;

      if (input.inviteCode) {
        const tokenHash = hashInviteCode(input.inviteCode);
        const invite = await tx.inviteToken.findUnique({
          where: { tokenHash },
          select: { id: true, householdId: true, expiresAt: true, usedAt: true },
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

        householdId = invite.householdId;
      } else {
        const household = await tx.household.create({
          data: {
            name: input.householdName ?? "우리 가계부",
            ownerUserId: user.id,
            members: {
              create: {
                userId: user.id,
                role: "owner",
              },
            },
          },
          select: { id: true },
        });
        await createDefaultCategories(tx, household.id);
        householdId = household.id;
      }

      return { user, householdId };
    });

    const token = await signSessionToken({
      sub: result.user.id,
      email: result.user.email,
    });
    const response = jsonOk(
      {
        user: result.user,
        householdId: result.householdId,
      },
      201,
    );
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return handleRouteError(
        new ApiError(409, "CONFLICT", "This request conflicts with existing data"),
      );
    }
    return handleRouteError(error);
  }
}
