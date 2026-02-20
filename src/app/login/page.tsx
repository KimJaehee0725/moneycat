"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/fetcher";

type LoginData = {
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
  households: Array<{
    householdId: string;
    role: "owner" | "member";
    name: string;
  }>;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch<LoginData>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <main className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">로그인</h1>
        <p className="mt-1 text-sm text-slate-500">같은 가계부를 두 사람이 함께 사용합니다.</p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <input
            required
            type="email"
            autoComplete="email"
            placeholder="이메일"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호 (8자 이상)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {error ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          계정이 없다면{" "}
          <Link href="/register" className="font-medium text-blue-700">
            회원가입
          </Link>
        </p>
      </main>
    </div>
  );
}
