"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  nextPath: string;
};

type LoginState = {
  message: string;
  isError: boolean;
  isSaving: boolean;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [state, setState] = useState<LoginState>({ message: "", isError: false, isSaving: false });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setState({ message: "", isError: false, isSaving: true });

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: String(formData.get("id") ?? ""),
        password: String(formData.get("password") ?? ""),
        nextPath,
      }),
    }).catch(() => null);

    if (!response) {
      setState({ message: "로그인 요청을 보내지 못했습니다.", isError: true, isSaving: false });
      return;
    }

    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; nextPath?: string } | null;

    if (!response.ok || !result?.ok) {
      setState({ message: result?.message ?? "아이디 또는 비밀번호를 확인해 주세요.", isError: true, isSaving: false });
      return;
    }

    setState({ message: "로그인되었습니다.", isError: false, isSaving: false });
    router.push(result.nextPath ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="grid gap-2 text-sm font-black text-[#092046]">
        ID
        <input
          name="id"
          autoComplete="username"
          required
          className="rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
          placeholder="관리자 또는 사용자 ID"
        />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#092046]">
        PASSWORD
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
          placeholder="비밀번호"
        />
      </label>
      <button
        type="submit"
        disabled={state.isSaving}
        className="w-full rounded-xl bg-[#092046] px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {state.isSaving ? "로그인 중" : "로그인"}
      </button>
      {state.message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-bold leading-6 ${
            state.isError ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
