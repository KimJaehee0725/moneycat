const wonFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("ko-KR");

const UNIT_LIST = [
  { value: 1_0000_0000_0000, label: "조" },
  { value: 1_0000_0000, label: "억" },
  { value: 1_0000, label: "만" },
  { value: 1_000, label: "천" },
  { value: 100, label: "백" },
  { value: 10, label: "십" },
] as const;

export function formatKoreanAmount(value: number) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);

  if (absolute === 0) {
    return "0원";
  }

  let remain = absolute;
  const chunks: string[] = [];

  for (const unit of UNIT_LIST) {
    if (remain < unit.value) {
      continue;
    }
    const quotient = Math.floor(remain / unit.value);
    chunks.push(`${numberFormatter.format(quotient)}${unit.label}`);
    remain %= unit.value;
  }

  if (remain > 0) {
    chunks.push(numberFormatter.format(remain));
  }

  return `${sign}${chunks.join(" ")}원`;
}

export function formatKrw(value: number) {
  const rounded = Number.isFinite(value) ? Math.round(value) : 0;
  return {
    won: wonFormatter.format(rounded),
    korean: formatKoreanAmount(rounded),
  };
}

export function formatKrwWithKorean(value: number) {
  const formatted = formatKrw(value);
  return `${formatted.won} (${formatted.korean})`;
}
