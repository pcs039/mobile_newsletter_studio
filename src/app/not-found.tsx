import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f7fc] px-5 py-12 text-slate-950">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">404</p>
        <h1 className="mt-2 text-2xl font-black text-[#092046]">요청한 페이지를 찾지 못했습니다.</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          주소를 다시 확인하거나 전체 프로젝트에서 작업 대상을 선택하세요.
        </p>
        <Link href="/" className="dd-btn dd-btn-primary dd-btn-lg mt-6 text-sm">
          전체 프로젝트
        </Link>
      </section>
    </main>
  );
}
