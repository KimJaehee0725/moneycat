import { z } from "zod";

import { ApiError } from "@/lib/http";
import { PASSWORD_POLICY_SUMMARY, isPasswordPolicyValid } from "@/lib/password-policy";

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const registerSchema = z.object({
  email: z.string().email().max(120),
  password: z
    .string()
    .min(8)
    .max(100)
    .refine((value) => isPasswordPolicyValid(value), PASSWORD_POLICY_SUMMARY),
  householdName: z.string().trim().min(1).max(50).optional(),
  inviteCode: z.string().trim().min(8).max(200).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(100),
});

export const householdCreateSchema = z.object({
  name: z.string().trim().min(1).max(50),
});

export const householdJoinSchema = z.object({
  inviteCode: z.string().trim().min(8).max(200),
});

export const categoryCreateSchema = z.object({
  householdId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(30),
  type: z.enum(["income", "expense"]),
});

export const transactionCreateSchema = z.object({
  householdId: z.string().min(1).optional(),
  amount: z.coerce.number().gt(0),
  type: z.enum(["income", "expense"]),
  categoryId: z.string().min(1),
  memo: z.string().trim().max(200).optional(),
  spentAt: z.coerce.date(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export const transactionPatchSchema = z
  .object({
    amount: z.coerce.number().gt(0).optional(),
    type: z.enum(["income", "expense"]).optional(),
    categoryId: z.string().min(1).optional(),
    memo: z.string().trim().max(200).optional(),
    spentAt: z.coerce.date().optional(),
  })
  .refine(
    (value) =>
      value.amount !== undefined ||
      value.type !== undefined ||
      value.categoryId !== undefined ||
      value.memo !== undefined ||
      value.spentAt !== undefined,
    "At least one field is required",
  );

export const budgetUpsertSchema = z.object({
  householdId: z.string().min(1).optional(),
  limitAmount: z.coerce.number().gte(0),
});

export const monthSchema = z.string().regex(monthRegex);

export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid request body", parsed.error.format());
  }

  return parsed.data;
}
