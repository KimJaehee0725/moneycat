import { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveHouseholdForUser } from "@/lib/household";
import { handleRouteError, jsonOk } from "@/lib/http";
import { currentMonth, listMonths, monthRangeUtc } from "@/lib/month";
import { decimalToNumber } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const to = request.nextUrl.searchParams.get("to") ?? currentMonth();
    const from = request.nextUrl.searchParams.get("from") ?? to;
    const requestedHouseholdId = request.nextUrl.searchParams.get("householdId") ?? undefined;
    const membership = await resolveHouseholdForUser(user.id, requestedHouseholdId);
    const months = listMonths(from, to);

    const rangeStart = monthRangeUtc(months[0]).start;
    const rangeEnd = monthRangeUtc(months[months.length - 1]).endExclusive;

    const transactions = await db.transaction.findMany({
      where: {
        householdId: membership.householdId,
        spentAt: {
          gte: rangeStart,
          lt: rangeEnd,
        },
      },
      select: {
        amount: true,
        type: true,
        spentAt: true,
      },
      orderBy: {
        spentAt: "asc",
      },
    });

    const aggregated = new Map<string, { income: number; expense: number }>();
    for (const month of months) {
      aggregated.set(month, { income: 0, expense: 0 });
    }

    for (const tx of transactions) {
      const month = tx.spentAt.toISOString().slice(0, 7);
      if (!aggregated.has(month)) {
        continue;
      }
      const value = aggregated.get(month);
      if (!value) {
        continue;
      }
      if (tx.type === "income") {
        value.income += decimalToNumber(tx.amount);
      } else {
        value.expense += decimalToNumber(tx.amount);
      }
    }

    const trend = months.map((month) => {
      const item = aggregated.get(month) ?? { income: 0, expense: 0 };
      return {
        month,
        income: item.income,
        expense: item.expense,
        balance: item.income - item.expense,
      };
    });

    return jsonOk({
      householdId: membership.householdId,
      from: months[0],
      to: months[months.length - 1],
      trend,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
