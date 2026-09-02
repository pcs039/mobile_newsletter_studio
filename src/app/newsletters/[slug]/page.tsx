import Link from "next/link";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { sampleNewsletter } from "@/lib/newsletter-data";

function AudioBar({ status, duration }: { status: string; duration: string }) {
  const isReady = status === "음성 제공";

  return (
    <div className="rounded-xl bg-[#f4f8ff] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-[#184a88]">본문 듣기</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{status}</p>
        </div>
        <button className="rounded-full bg-[#092046] px-4 py-2 text-xs font-black text-white disabled:bg-slate-300" disabled={!isReady}>
          재생
        </button>
      </div>
      <div className="mt-3 h-2 rounded-full bg-sky-100">
        <div className={`h-2 rounded-full ${isReady ? "w-2/5 bg-[#092046]" : "w-1/5 bg-slate-300"}`} />
      </div>
      <p className="mt-2 text-right text-xs font-semibold text-slate-500">{duration}</p>
    </div>
  );
}

export default function PublicNewsletterPage() {
  return (
    <main className="min-h-screen bg-[#edf4fb] text-slate-950">
      <section className="mx-auto min-h-screen max-w-[520px] bg-white shadow-xl shadow-blue-950/10">
        <header className="bg-[#071f46] px-5 pb-7 pt-6 text-white">
          <div className="mb-6">
            <DatadictionBrand compact theme="light" />
          </div>
          <p className="text-sm font-semibold text-sky-200">{sampleNewsletter.organization}</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">{sampleNewsletter.title}</h1>
          <p className="mt-2 text-lg font-bold text-white/95">{sampleNewsletter.issue}</p>
          <p className="mt-4 text-sm leading-6 text-slate-300">{sampleNewsletter.description}</p>
          <div className="mt-5 flex gap-2">
            <Link
              href={sampleNewsletter.ebookUrl}
              className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#092046]"
            >
              PC e-book 보기
            </Link>
            <span className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-slate-200">
              모바일 읽기 보기
            </span>
          </div>
        </header>

        <section className="px-5 py-5">
          <div className="rounded-2xl bg-gradient-to-br from-sky-100 to-blue-50 p-5">
            <div className="min-h-44 rounded-xl border border-white/70 bg-white/50 p-4">
              <p className="text-sm font-black text-[#092046]">대표 이미지 영역</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                기관 제공 원본 이미지나 디자이너 제작 배너를 연결해 공개 화면 첫 인상을 구성합니다.
              </p>
            </div>
          </div>

          <nav className="mt-5 grid grid-cols-3 gap-2">
            {sampleNewsletter.articles.map((article) => (
              <a
                key={article.id}
                href={`#${article.id}`}
                className="rounded-lg border border-slate-200 px-3 py-3 text-center text-xs font-black text-[#092046]"
              >
                {article.title}
              </a>
            ))}
          </nav>
        </section>

        <section className="space-y-5 px-5 pb-8">
          {sampleNewsletter.articles.map((article) => (
            <article key={article.id} id={article.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black text-[#184a88]">{article.page}</p>
              <h2 className="mt-2 text-xl font-black text-[#092046]">{article.title}</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{article.summary}</p>
              <div className={`mt-4 h-36 rounded-xl bg-gradient-to-br ${article.imageTone}`} />
              <p className="mt-4 text-sm leading-7 text-slate-600">{article.body}</p>
              <div className="mt-4">
                <AudioBar status={article.audioStatus} duration={article.audioDuration} />
              </div>
              <div className="mt-4 grid gap-2">
                {article.buttons.map((button) => (
                  <button key={button} className="rounded-lg bg-[#092046] px-4 py-3 text-sm font-black text-white">
                    {button}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>

        <footer className="border-t border-slate-200 px-5 py-5 text-center">
          <p className="text-xs font-semibold text-slate-500">
            제작·운영 DataDiction Newsletter Studio
          </p>
        </footer>
      </section>
    </main>
  );
}
