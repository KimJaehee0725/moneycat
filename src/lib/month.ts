import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function currentMonth() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: env().APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) {
    throw new ApiError(500, "TIMEZONE_ERROR", "Failed to resolve current month");
  }
  return `${year}-${month}`;
}

export function assertMonth(value: string) {
  if (!MONTH_REGEX.test(value)) {
    throw new ApiError(
      400,
      "INVALID_MONTH",
      "month must be in YYYY-MM format",
      { value },
    );
  }
  return value;
}

export function parseMonthOrCurrent(value: string | null) {
  return value ? assertMonth(value) : currentMonth();
}

export function monthRangeUtc(month: string) {
  assertMonth(month);
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0, 0));
  return { start, endExclusive };
}

export function listMonths(from: string, to: string) {
  assertMonth(from);
  assertMonth(to);

  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);

  const start = fromYear * 12 + fromMonth;
  const end = toYear * 12 + toMonth;

  if (start > end) {
    throw new ApiError(400, "INVALID_RANGE", "`from` cannot be greater than `to`");
  }
  if (end - start > 24) {
    throw new ApiError(400, "INVALID_RANGE", "Range cannot exceed 24 months");
  }

  const result: string[] = [];
  for (let cursor = start; cursor <= end; cursor += 1) {
    const year = Math.floor((cursor - 1) / 12);
    const monthValue = ((cursor - 1) % 12) + 1;
    result.push(`${year}-${String(monthValue).padStart(2, "0")}`);
  }
  return result;
}
