"use client";

import Link from "next/link";

export default function ProjectError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f7fc] px-5 py-12 text-slate-950">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">프로젝트 안내</p>
        <h1 className="mt-2 text-2xl font-black text-[#092046]">프로젝트 화면을 불러오지 못했습니다.</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          다시 시도해도 문제가 계속되면 전체 프로젝트에서 작업 대상을 다시 선택하세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={retry} className="dd-btn dd-btn-primary dd-btn-lg text-sm">
            다시 시도
          </button>
          <Link href="/" className="dd-btn dd-btn-secondary dd-btn-lg text-sm">
            전체 프로젝트
          </Link>
        </div>
      </section>
    </main>
  );
}
