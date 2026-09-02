import Link from "next/link";
import { sampleNewsletter } from "@/lib/newsletter-data";

export default function PublicEbookPage() {
  return (
    <main className="min-h-screen bg-[#eef4fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#184a88]">{sampleNewsletter.organization}</p>
            <h1 className="mt-1 text-2xl font-black text-[#092046]">
              {sampleNewsletter.title} {sampleNewsletter.issue}
            </h1>
            <p className="mt-1 text-sm text-slate-600">PC 화면에서 원본 PDF 지면을 확인하는 e-book 보기입니다.</p>
          </div>
          <Link
            href={sampleNewsletter.publicUrl}
            className="rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]"
          >
            모바일 읽기 보기
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-6 xl:grid-cols-[260px_1fr_300px]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#092046]">목차</h2>
          <div className="mt-4 space-y-2">
            {sampleNewsletter.pages.slice(0, 8).map((page) => (
              <button
                key={page.number}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-semibold ${
                  page.number === 2 ? "bg-[#092046] text-white" : "bg-slate-50 text-slate-700"
                }`}
              >
                <span>{page.title}</span>
                <span>{page.number}쪽</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#092046]">원본 지면 보기</h2>
              <p className="mt-1 text-sm text-slate-500">2쪽과 3쪽 펼침 보기 샘플</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">이전</button>
              <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">다음</button>
              <button className="rounded-md bg-[#092046] px-3 py-2 text-sm font-bold text-white">확대</button>
            </div>
          </div>

          <div className="rounded-lg bg-[#dfeaf5] p-5">
            <div className="grid gap-5 lg:grid-cols-2">
              {[2, 3].map((page) => (
                <article key={page} className="aspect-[3/4] rounded-lg border border-slate-200 bg-gradient-to-br from-white to-sky-50 p-5 shadow-sm">
                  <div className="h-full rounded border border-slate-200 bg-white p-5">
                    <div className="h-4 w-2/3 rounded bg-[#092046]" />
                    <div className="mt-5 h-28 rounded bg-sky-100" />
                    <div className="mt-5 space-y-3">
                      <div className="h-3 rounded bg-slate-200" />
                      <div className="h-3 rounded bg-slate-200" />
                      <div className="h-3 w-4/5 rounded bg-slate-200" />
                      <div className="h-3 w-2/3 rounded bg-slate-200" />
                    </div>
                    <div className="mt-8 grid grid-cols-2 gap-3">
                      <div className="h-24 rounded bg-slate-100" />
                      <div className="h-24 rounded bg-slate-100" />
                    </div>
                  </div>
                  <p className="mt-3 text-center text-sm font-black text-[#092046]">{page}쪽</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#092046]">보기 기준</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              e-book은 PC 중심 원본 확인 화면입니다. 모바일 독자는 읽기 보기에서 본문과 음성을 이용하는 흐름을 우선합니다.
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#092046]">페이지 정보</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xs font-black text-[#184a88]">전체 페이지</p>
                <p className="mt-1 text-sm font-bold text-slate-700">16쪽</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xs font-black text-[#184a88]">현재 보기</p>
                <p className="mt-1 text-sm font-bold text-slate-700">2쪽-3쪽</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xs font-black text-[#184a88]">품질 기준</p>
                <p className="mt-1 text-sm font-bold text-slate-700">원본 PDF 변환 이미지</p>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
