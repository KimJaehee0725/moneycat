import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <main className="w-full max-w-4xl rounded-3xl bg-white p-8 shadow-lg ring-1 ring-slate-200 sm:p-12">
        <p className="text-sm font-semibold text-blue-700">Moneycat</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          커플 2인을 위한<br />
          공유 가계부
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          아이폰에서 빠르게 입력하고, PC에서 월별 합계/예산/통계를 확인하는 자체 운영형 PWA입니다.
        </p>
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
