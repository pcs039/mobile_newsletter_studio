import type { AppUser } from "@/lib/app-auth";

export function AuthUserPanel({ user }: { user: AppUser }) {
  return (
    <div className="mt-8 rounded-lg border border-white/15 bg-white/8 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-sky-100">로그인 사용자</p>
      <p className="mt-2 text-sm font-black text-white">{user.name}</p>
      <p className="mt-1 text-xs font-semibold text-slate-300">
        {user.role === "admin" ? "관리자 · 전체 프로젝트 접근" : "사용자 · 담당 프로젝트 접근"}
      </p>
      <form action="/api/auth/logout" method="post" className="mt-4">
        <button
          type="submit"
          className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
