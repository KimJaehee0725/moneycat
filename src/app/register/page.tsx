"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { apiFetch } from "@/lib/fetcher";
import {
  PASSWORD_POLICY_SUMMARY,
  getPasswordRuleResults,
  isPasswordPolicyValid,
} from "@/lib/password-policy";

type RegisterData = {
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
  householdId: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [householdName, setHouseholdName] = useState("우리 가계부");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPasswordRules, setShowPasswordRules] = useState(false);

  const passwordRuleResults = useMemo(
    () => getPasswordRuleResults(password),
    [password],
  );
  const isPasswordValid = useMemo(
    () => isPasswordPolicyValid(password),
    [password],
  );
  const isPasswordConfirmMatched = useMemo(
    () => passwordConfirm.length > 0 && passwordConfirm === password,
    [password, passwordConfirm],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError(PASSWORD_POLICY_SUMMARY);
      setShowPasswordRules(true);
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    try {
      await apiFetch<RegisterData>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          householdName: mode === "create" ? householdName : undefined,
          inviteCode: mode === "join" ? inviteCode : undefined,
        }),
      });
      router.push("/dashboard");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <main className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">회원가입</h1>
        <p className="mt-1 text-sm text-slate-500">
          새 가계부를 만들거나, 파트너의 초대 코드로 참여하세요.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              mode === "create" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            새로 만들기
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              mode === "join" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            초대로 참여
          </button>
        </div>

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
            autoComplete="new-password"
            placeholder="비밀번호 (8자 이상)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호 확인"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              passwordConfirm.length === 0
                ? "border-slate-300"
                : isPasswordConfirmMatched
                  ? "border-emerald-400"
                  : "border-rose-400"
            }`}
          />
          {passwordConfirm.length > 0 ? (
            <p
              className={`text-xs ${
                isPasswordConfirmMatched ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {isPasswordConfirmMatched
                ? "비밀번호가 일치합니다."
                : "비밀번호가 일치하지 않습니다."}
            </p>
          ) : null}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <button
              type="button"
              onClick={() => setShowPasswordRules((prev) => !prev)}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-700"
            >
              <span>비밀번호 조건 보기</span>
              <span>{showPasswordRules ? "접기" : "펼치기"}</span>
            </button>
            {showPasswordRules ? (
              <ul className="mt-2 space-y-1 text-xs">
                {passwordRuleResults.map((rule) => (
                  <li
                    key={rule.id}
                    className={rule.passed ? "text-emerald-700" : "text-slate-500"}
                  >
                    {rule.passed ? "✓" : "•"} {rule.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {mode === "create" ? (
            <input
              required
              type="text"
              placeholder="가계부 이름"
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          ) : (
            <input
              required
              type="text"
              placeholder="초대 코드"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          )}

          {error ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !isPasswordValid || !isPasswordConfirmMatched}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "처리 중..." : "가입하기"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          이미 계정이 있다면{" "}
          <Link href="/login" className="font-medium text-blue-700">
            로그인
          </Link>
        </p>
      </main>
    </div>
  );
}
