type PendingTransaction = {
  payload: {
    householdId?: string;
    amount: number;
    type: "income" | "expense";
    categoryId: string;
    memo?: string;
    spentAt: string;
    idempotencyKey: string;
  };
  queuedAt: string;
};

const STORAGE_KEY = "moneycat.pending.transactions.v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function randomKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildIdempotencyKey() {
  return randomKey();
}

export function readPendingTransactions() {
  if (!canUseStorage()) {
    return [] as PendingTransaction[];
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [] as PendingTransaction[];
  }
  try {
    const parsed = JSON.parse(raw) as PendingTransaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingTransactions(items: PendingTransaction[]) {
  if (!canUseStorage()) {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function enqueuePendingTransaction(item: PendingTransaction) {
  const current = readPendingTransactions();
  current.push(item);
  writePendingTransactions(current);
}

export async function flushPendingTransactions() {
  const current = readPendingTransactions();
  if (!current.length) {
    return 0;
  }

  const remain: PendingTransaction[] = [];
  let flushedCount = 0;

  for (const item of current) {
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": item.payload.idempotencyKey,
        },
        body: JSON.stringify(item.payload),
      });
      if (!response.ok) {
        remain.push(item);
        continue;
      }
      flushedCount += 1;
    } catch {
      remain.push(item);
    }
  }

  writePendingTransactions(remain);
  return flushedCount;
}
