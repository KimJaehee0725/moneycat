import Link from "next/link";

import { requireUserFromCookies } from "@/lib/auth";

export default async function Home() {
  let loggedInEmail: string | null = null;
  try {
    const user = await requireUserFromCookies();
    loggedInEmail = user.email;
  } catch {
    loggedInEmail = null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <main className="w-full max-w-4xl rounded-3xl bg-white p-8 shadow-lg ring-1 ring-slate-200 sm:p-12">
        <p className="text-sm font-semibold text-blue-700">Moneycat</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          커플 2인을 위한<br />
          공유 가계부
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">하비비!</p>
        {loggedInEmail ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            이미 로그인되어 있습니다 ({loggedInEmail}).
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
          >
            시작하기
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700"
          >
            로그인
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-blue-300 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-800"
          >
            대시보드
          </Link>
        </div>
      </main>
    </div>
  );
}
