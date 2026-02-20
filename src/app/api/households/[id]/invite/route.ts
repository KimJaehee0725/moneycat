import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assertHouseholdOwner,
  assertMemberLimitNotReached,
  generateInviteCode,
  hashInviteCode,
} from "@/lib/household";
import { handleRouteError, jsonOk } from "@/lib/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUserFromRequest(request);
    const { id: householdId } = await params;

    await assertHouseholdOwner(user.id, householdId);
    await assertMemberLimitNotReached(householdId);

    const inviteCode = generateInviteCode();
    const tokenHash = hashInviteCode(inviteCode);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await db.inviteToken.create({
      data: {
        householdId,
        tokenHash,
        expiresAt,
      },
    });

    return jsonOk({
      inviteCode,
      expiresAt,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
