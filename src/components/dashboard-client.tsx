"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { formatKrw, formatKrwWithKorean } from "@/lib/amount-format";
import { apiFetch } from "@/lib/fetcher";
import {
  buildIdempotencyKey,
  enqueuePendingTransaction,
  flushPendingTransactions,
  readPendingTransactions,
} from "@/lib/offline-queue";
import type {
  BudgetDto,
  CategoryDto,
  MonthlyStatsDto,
  TransactionDto,
} from "@/lib/types";

type DashboardClientProps = {
  userEmail: string;
  householdId: string;
  householdName: string;
  role: "owner" | "member";
  month: string;
  categories: CategoryDto[];
  initialTransactions: TransactionDto[];
  initialBudgets: BudgetDto[];
  initialStats: MonthlyStatsDto;
};

type TransactionApiData = {
  month: string;
  householdId: string;
  totals: {
    income: number;
    expense: number;
    balance: number;
  };
  transactions: TransactionDto[];
};

type BudgetApiData = {
  month: string;
  householdId: string;
  budgets: BudgetDto[];
};

type BudgetUpsertApiData = {
  budget: BudgetDto;
};

type BudgetDeleteApiData = {
  deleted: boolean;
};

type CategoryListApiData = {
  householdId: string;
  categories: CategoryDto[];
};

type CategoryCreateApiData = {
  householdId: string;
  category: CategoryDto;
};

function toDateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function sortCategories(items: CategoryDto[]) {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }
    return a.name.localeCompare(b.name, "ko-KR");
  });
}

function parsePositiveNumber(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return numeric;
}

export function DashboardClient({
  userEmail,
  householdId,
  householdName,
  role,
  month,
  categories,
  initialTransactions,
  initialBudgets,
  initialStats,
}: DashboardClientProps) {
  const router = useRouter();
  const [activeMonth, setActiveMonth] = useState(month);
  const [categoriesState, setCategoriesState] = useState(sortCategories(categories));
  const [transactions, setTransactions] = useState(initialTransactions);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [type, setType] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [spentAt, setSpentAt] = useState(toDateInputValue());
  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({});
  const [newBudgetCategoryId, setNewBudgetCategoryId] = useState("");
  const [newBudgetAmount, setNewBudgetAmount] = useState("");
  const [savingNewBudget, setSavingNewBudget] = useState(false);
  const [deletingBudgetCategoryId, setDeletingBudgetCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const filteredCategories = useMemo(
    () => categoriesState.filter((category) => category.type === type),
    [categoriesState, type],
  );

  const expenseCategories = useMemo(
    () => categoriesState.filter((category) => category.type === "expense"),
    [categoriesState],
  );

  const budgetRows = useMemo(
    () => budgets.filter((budget) => budget.categoryType === "expense"),
    [budgets],
  );

  const budgetCategoryIdSet = useMemo(
    () => new Set(budgetRows.map((budget) => budget.categoryId)),
    [budgetRows],
  );

  const availableBudgetCategories = useMemo(
    () => expenseCategories.filter((category) => !budgetCategoryIdSet.has(category.id)),
    [expenseCategories, budgetCategoryIdSet],
  );

  const amountPreview = useMemo(() => parsePositiveNumber(amount), [amount]);
  const newBudgetAmountPreview = useMemo(
    () => parsePositiveNumber(newBudgetAmount),
    [newBudgetAmount],
  );

  useEffect(() => {
    if (!categoryId && filteredCategories[0]) {
      setCategoryId(filteredCategories[0].id);
      return;
    }
    if (categoryId && !filteredCategories.some((category) => category.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id ?? "");
    }
  }, [categoryId, filteredCategories]);

  useEffect(() => {
    if (!availableBudgetCategories.length) {
      if (newBudgetCategoryId) {
        setNewBudgetCategoryId("");
      }
      return;
    }
    if (
      !newBudgetCategoryId ||
      !availableBudgetCategories.some((category) => category.id === newBudgetCategoryId)
    ) {
      setNewBudgetCategoryId(availableBudgetCategories[0].id);
    }
  }, [availableBudgetCategories, newBudgetCategoryId]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [transactionsData, budgetsData, statsData, categoriesData] = await Promise.all([
        apiFetch<TransactionApiData>(
          `/api/transactions?month=${activeMonth}&householdId=${householdId}`,
        ),
        apiFetch<BudgetApiData>(`/api/budgets?month=${activeMonth}&householdId=${householdId}`),
        apiFetch<MonthlyStatsDto>(
          `/api/stats/monthly?month=${activeMonth}&householdId=${householdId}`,
        ),
        apiFetch<CategoryListApiData>(`/api/categories?householdId=${householdId}`),
      ]);

      setTransactions(transactionsData.transactions);
      setBudgets(budgetsData.budgets);
      setStats(statsData);
      setCategoriesState(sortCategories(categoriesData.categories));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [activeMonth, householdId]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    const sync = async () => {
      const flushed = await flushPendingTransactions();
      setPendingCount(readPendingTransactions().length);
      if (flushed > 0) {
        await refreshData();
      }
    };

    setPendingCount(readPendingTransactions().length);
    void sync();

    const onOnline = () => {
      void sync();
    };
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [refreshData]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    setError(null);
    try {
      const data = await apiFetch<{ inviteCode: string; expiresAt: string }>(
        `/api/households/${householdId}/invite`,
        {
          method: "POST",
        },
      );
      setInviteCode(`${data.inviteCode} (만료: ${new Date(data.expiresAt).toLocaleString("ko-KR")})`);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "초대 코드 생성에 실패했습니다.");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setError("카테고리 이름을 입력해주세요.");
      return;
    }

    setCreatingCategory(true);
    setError(null);
    try {
      const data = await apiFetch<CategoryCreateApiData>("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          householdId,
          name,
          type,
        }),
      });

      setCategoriesState((prev) => sortCategories([...prev, data.category]));
      setCategoryId(data.category.id);
      setNewCategoryName("");
    } catch (categoryError) {
      setError(
        categoryError instanceof Error ? categoryError.message : "카테고리 생성에 실패했습니다.",
      );
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("금액은 0보다 커야 합니다.");
      return;
    }
    if (!categoryId) {
      setError("카테고리를 선택해주세요.");
      return;
    }

    const idempotencyKey = buildIdempotencyKey();
    const payload = {
      householdId,
      amount: numericAmount,
      type,
      categoryId,
      memo: memo.trim() || undefined,
      spentAt: new Date(spentAt).toISOString(),
      idempotencyKey,
    };

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "거래 등록 실패");
      }

      setAmount("");
      setMemo("");
      await refreshData();
    } catch {
      enqueuePendingTransaction({
        payload,
        queuedAt: new Date().toISOString(),
      });
      setPendingCount(readPendingTransactions().length);
      setAmount("");
      setMemo("");
      setError("오프라인 상태로 판단되어 거래를 임시 보관했습니다. 온라인 복귀 시 자동 전송됩니다.");
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    setError(null);
    try {
      await apiFetch<{ deleted: boolean }>(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      });
      await refreshData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "삭제에 실패했습니다.");
    }
  };

  const handleSaveBudget = async (categoryIdToSave: string) => {
    const existingLimitAmount = budgets.find(
      (budget) => budget.categoryId === categoryIdToSave,
    )?.limitAmount;
    const rawValue =
      budgetEdits[categoryIdToSave] ??
      (existingLimitAmount !== undefined ? String(existingLimitAmount) : "");
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setError("예산 금액은 0 이상의 숫자여야 합니다.");
      return;
    }

    setError(null);
    try {
      await apiFetch<BudgetUpsertApiData>(`/api/budgets/${categoryIdToSave}?month=${activeMonth}`, {
        method: "PUT",
        body: JSON.stringify({
          householdId,
          limitAmount: numericValue,
        }),
      });
      await refreshData();
    } catch (budgetError) {
      setError(budgetError instanceof Error ? budgetError.message : "예산 저장에 실패했습니다.");
    }
  };

  const handleAddBudget = async () => {
    if (!newBudgetCategoryId) {
      setError("추가할 카테고리를 먼저 선택해주세요.");
      return;
    }
    if (newBudgetAmount.trim() === "") {
      setError("예산 금액을 입력해주세요.");
      return;
    }

    const numericValue = Number(newBudgetAmount);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setError("예산 금액은 0 이상의 숫자여야 합니다.");
      return;
    }

    setSavingNewBudget(true);
    setError(null);
    try {
      await apiFetch<BudgetUpsertApiData>(`/api/budgets/${newBudgetCategoryId}?month=${activeMonth}`, {
        method: "PUT",
        body: JSON.stringify({
          householdId,
          limitAmount: numericValue,
        }),
      });
      setNewBudgetAmount("");
      await refreshData();
    } catch (budgetError) {
      setError(budgetError instanceof Error ? budgetError.message : "예산 추가에 실패했습니다.");
    } finally {
      setSavingNewBudget(false);
    }
  };

  const handleDeleteBudget = async (categoryIdToDelete: string) => {
    setDeletingBudgetCategoryId(categoryIdToDelete);
    setError(null);
    try {
      await apiFetch<BudgetDeleteApiData>(
        `/api/budgets/${categoryIdToDelete}?month=${activeMonth}&householdId=${householdId}`,
        {
          method: "DELETE",
        },
      );
      setBudgetEdits((prev) => {
        const next = { ...prev };
        delete next[categoryIdToDelete];
        return next;
      });
      await refreshData();
    } catch (budgetError) {
      setError(budgetError instanceof Error ? budgetError.message : "예산 삭제에 실패했습니다.");
    } finally {
      setDeletingBudgetCategoryId(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">{userEmail}</p>
            <h1 className="text-2xl font-semibold text-slate-900">{householdName}</h1>
            <p className="text-sm text-slate-500">
              역할: {role === "owner" ? "소유자" : "멤버"} / 월: {activeMonth}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={activeMonth}
              onChange={(event) => setActiveMonth(event.target.value)}
            />
            <button
              type="button"
              onClick={() => void refreshData()}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              로그아웃
            </button>
          </div>
        </div>
        {role === "owner" ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void handleCreateInvite()}
              disabled={creatingInvite}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {creatingInvite ? "생성 중..." : "초대 코드 만들기"}
            </button>
            {inviteCode ? (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{inviteCode}</p>
            ) : null}
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {pendingCount > 0 ? (
        <div className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          오프라인 대기 거래 {pendingCount}건이 있습니다.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">월 수입</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {formatKrw(stats.totalIncome).won}
          </p>
          <p className="mt-1 text-xs text-emerald-700/80">{formatKrw(stats.totalIncome).korean}</p>
        </article>
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">월 지출</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {formatKrw(stats.totalExpense).won}
          </p>
          <p className="mt-1 text-xs text-rose-700/80">{formatKrw(stats.totalExpense).korean}</p>
        </article>
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">잔액</p>
          <p
            className={`mt-2 text-2xl font-semibold ${
              stats.balance >= 0 ? "text-slate-900" : "text-rose-700"
            }`}
          >
            {formatKrw(stats.balance).won}
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatKrw(stats.balance).korean}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">거래 입력</h2>
          <form className="grid gap-3" onSubmit={handleCreateTransaction}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  type === "expense" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                지출
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  type === "income" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                수입
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="금액"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              입력 미리보기:{" "}
              {amountPreview === null ? "-" : formatKrwWithKorean(amountPreview)}
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">
                {type === "expense" ? "지출" : "수입"} 카테고리 추가
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="예: 반려동물, 선물, 용돈"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateCategory()}
                  disabled={creatingCategory}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {creatingCategory ? "추가 중..." : "추가"}
                </button>
              </div>
            </div>
            <input
              type="date"
              value={spentAt}
              onChange={(event) => setSpentAt(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="메모 (선택)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              거래 추가
            </button>
          </form>
        </article>

        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">카테고리 지출 비중</h2>
          <div className="space-y-2">
            {stats.byCategoryExpense.length === 0 ? (
              <p className="text-sm text-slate-500">이번 달 지출 데이터가 없습니다.</p>
            ) : (
              stats.byCategoryExpense.map((item) => (
                <div key={item.categoryId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-700">{item.categoryName}</span>
                    <span className="text-slate-900">{formatKrwWithKorean(item.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(100, item.ratio * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">거래 목록</h2>
          {loading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-500">거래가 없습니다.</p>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {tx.categoryName} · {new Date(tx.spentAt).toLocaleDateString("ko-KR")}
                    </p>
                    {tx.memo ? <p className="text-xs text-slate-500">{tx.memo}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-semibold ${
                        tx.type === "income" ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatKrwWithKorean(tx.amount)}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleDeleteTransaction(tx.id)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">월 예산 설정 (지출)</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">예산 항목 추가</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <select
                  value={newBudgetCategoryId}
                  onChange={(event) => setNewBudgetCategoryId(event.target.value)}
                  disabled={!availableBudgetCategories.length}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  {availableBudgetCategories.length ? null : (
                    <option value="">추가 가능한 카테고리가 없습니다.</option>
                  )}
                  {availableBudgetCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newBudgetAmount}
                  onChange={(event) => setNewBudgetAmount(event.target.value)}
                  placeholder="예산 금액"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAddBudget()}
                  disabled={savingNewBudget || !availableBudgetCategories.length}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {savingNewBudget ? "추가 중..." : "추가"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                입력 미리보기:{" "}
                {newBudgetAmountPreview === null ? "-" : formatKrwWithKorean(newBudgetAmountPreview)}
              </p>
            </div>

            {budgetRows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                등록된 예산 항목이 없습니다. 위에서 카테고리를 선택해 예산을 추가하세요.
              </p>
            ) : (
              budgetRows.map((budget) => {
                const statBudget = stats.budgets.find(
                  (budgetStat) => budgetStat.categoryId === budget.categoryId,
                );
                return (
                  <div key={budget.categoryId} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex justify-between">
                      <p className="text-sm font-medium text-slate-900">{budget.categoryName}</p>
                      <p
                        className={`text-xs ${
                          statBudget?.exceeded ? "text-rose-700" : "text-slate-500"
                        }`}
                      >
                        {statBudget
                          ? `${formatKrwWithKorean(statBudget.spent)} / ${formatKrwWithKorean(
                              statBudget.limitAmount,
                            )}`
                          : "예산 없음"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={budgetEdits[budget.categoryId] ?? String(budget.limitAmount)}
                        onChange={(event) =>
                          setBudgetEdits((prev) => ({
                            ...prev,
                            [budget.categoryId]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveBudget(budget.categoryId)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBudget(budget.categoryId)}
                        disabled={deletingBudgetCategoryId === budget.categoryId}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                      >
                        {deletingBudgetCategoryId === budget.categoryId ? "삭제 중..." : "삭제"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
