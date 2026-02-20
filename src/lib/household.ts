import { MemberRole, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";

type DbClient = Prisma.TransactionClient | typeof db;

const DEFAULT_CATEGORIES = [
  { name: "월급", type: "income" as const },
  { name: "보너스", type: "income" as const },
  { name: "기타수입", type: "income" as const },
  { name: "식비", type: "expense" as const },
  { name: "교통", type: "expense" as const },
  { name: "주거", type: "expense" as const },
  { name: "생활", type: "expense" as const },
  { name: "데이트", type: "expense" as const },
  { name: "기타", type: "expense" as const },
];

export async function createDefaultCategories(client: DbClient, householdId: string) {
  await client.category.createMany({
    data: DEFAULT_CATEGORIES.map((category) => ({
      householdId,
      name: category.name,
      type: category.type,
      isDefault: true,
    })),
    skipDuplicates: true,
  });
}

export async function resolveHouseholdForUser(userId: string, householdId?: string) {
  const membership = await db.householdMember.findFirst({
    where: {
      userId,
      ...(householdId ? { householdId } : {}),
    },
    orderBy: { joinedAt: "asc" },
    select: { householdId: true, role: true },
  });

  if (!membership) {
    throw new ApiError(403, "HOUSEHOLD_FORBIDDEN", "Household access denied");
  }
  return membership;
}

export async function assertHouseholdOwner(userId: string, householdId: string) {
  const membership = await db.householdMember.findUnique({
    where: {
      householdId_userId: { householdId, userId },
    },
    select: { role: true },
  });

  if (!membership || membership.role !== MemberRole.owner) {
    throw new ApiError(403, "OWNER_REQUIRED", "Only owner can perform this action");
  }
}

export async function assertMemberLimitNotReached(householdId: string) {
  const count = await db.householdMember.count({ where: { householdId } });
  if (count >= 2) {
    throw new ApiError(409, "MEMBER_LIMIT_REACHED", "This household already has two members");
  }
}

export function generateInviteCode() {
  return randomUUID();
}

export function hashInviteCode(inviteCode: string) {
  return createHash("sha256").update(inviteCode).digest("hex");
}
