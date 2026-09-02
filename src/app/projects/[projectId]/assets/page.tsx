import Link from "next/link";

const assets = [
  {
    name: "무안군청 전경 대표 이미지",
    source: "기관 제공",
    rights: "사용 가능",
    quality: "원본 고화질",
    usage: "표지·대표 이미지",
    review: "검수 완료",
    tone: "from-sky-100 to-blue-50",
  },
  {
    name: "군정 주요 소식 카드 배너",
    source: "디자이너 제작",
    rights: "사용 가능",
    quality: "웹용 적합",
    usage: "기사 카드",
    review: "검수 완료",
    tone: "from-blue-100 to-indigo-50",
  },
  {
    name: "생활 지원 안내 배경",
    source: "AI 생성",
    rights: "확인 필요",
    quality: "웹용 적합",
    usage: "섹션 배경",
    review: "검수 필요",
    tone: "from-cyan-100 to-slate-50",
  },
  {
    name: "PDF 4쪽 행사 이미지 발췌",
    source: "PDF 발췌",
    rights: "확인 필요",
    quality: "저화질 주의",
    usage: "보조 이미지",
    review: "교체 권장",
    tone: "from-slate-100 to-amber-50",
  },
];

const sourceTypes = [
  { label: "기관 제공 원본", value: "최우선" },
  { label: "디자이너 제작", value: "권장" },
  { label: "AI 생성", value: "조건부" },
  { label: "PDF 발췌", value: "보조" },
];

const reviewItems = [
  "출처와 권리 확인 상태 입력",
  "모바일 화면에서 흐림·잘림 여부 확인",
  "실제 행사·인물처럼 보이는 AI 이미지는 사용 금지",
  "모든 대표 이미지에 대체텍스트 작성",
];

function StatusPill({ value }: { value: string }) {
  const tone =
    value === "사용 가능" || value === "검수 완료" || value === "원본 고화질"
      ? "bg-emerald-100 text-emerald-800"
      : value === "확인 필요" || value === "검수 필요"
        ? "bg-amber-100 text-amber-800"
        : value === "교체 권장" || value === "저화질 주의"
          ? "bg-rose-100 text-rose-800"
          : "bg-sky-100 text-sky-800";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{value}</span>;
}

export default function ImageAssetsPage() {
  return (
    <main className="min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <p className="text-sm font-semibold text-sky-200">Newsletter Studio</p>
            <h1 className="mt-3 text-2xl font-bold leading-tight">
              이미지 자산
              <br />
              관리
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              기사 대표 이미지, 배경, 배너, PDF 발췌 이미지를 출처와 권리 기준으로 관리합니다.
            </p>
          </div>

          <nav className="space-y-2">
            <Link
              href="/"
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              프로젝트 대시보드
            </Link>
            <Link
              href="/projects/muan-2025-94/pages"
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              PDF 업로드
            </Link>
            <Link
              href="/projects/muan-2025-94/reading"
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              읽기 보기 편집
            </Link>
            <span className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left text-sm font-semibold text-[#071f46] shadow-lg shadow-blue-950/20">
              이미지 자산
            </span>
            <span className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400">
              음성 MP3
            </span>
            <span className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400">
              미리보기·발행
            </span>
          </nav>

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">v0.2 반영</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              PDF 발췌 이미지는 보조 수단으로만 두고, 기관 제공 원본 또는 별도 제작 이미지를 우선 사용합니다.
            </p>
          </div>
        </aside>

        <section className="px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">황토골 무안소식지 2025년 제94호</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">
                이미지 자산 관리
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                모바일 읽기 화면에 입힐 대표 이미지, 배경 이미지, 배너의 품질과 권리 상태를 관리합니다.
              </p>
            </div>
            <Link
              href="/projects/muan-2025-94/reading"
              className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              읽기 보기로 돌아가기
            </Link>
          </header>

          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <section className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">이미지 업로드</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      기관 제공 원본 사진, 디자이너 제작 배너, AI 생성 이미지, PDF 발췌 이미지를 자산으로 등록합니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800">
                    저장소 연동 전 UI
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_280px]">
                  <div className="rounded-lg border-2 border-dashed border-sky-200 bg-[#f4f8ff] px-5 py-8 text-center">
                    <p className="text-base font-bold text-[#092046]">이미지 파일을 선택하거나 이 영역에 끌어다 놓기</p>
                    <p className="mt-2 text-sm text-slate-600">
                      권장: 원본 사진, 웹용 배너, 카드 이미지. PDF 발췌 이미지는 품질 확인 후 사용합니다.
                    </p>
                    <button className="mt-5 rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]">
                      이미지 선택
                    </button>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-bold text-[#092046]">등록 시 필수 정보</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <span className="rounded-md bg-slate-50 px-3 py-2">출처</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">권리 확인 상태</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">품질 상태</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">대체텍스트</span>
                    </div>
                  </div>
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">등록 이미지 자산</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      출처, 권리, 화질, 사용 위치, 검수 상태를 함께 봅니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      전체
                    </button>
                    <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      권리 확인
                    </button>
                    <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      교체 권장
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                  {assets.map((asset) => (
                    <article key={asset.name} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <div className={`h-40 rounded-lg bg-gradient-to-br ${asset.tone} p-4`}>
                        <div className="h-full rounded-md border border-white/70 bg-white/50 p-3">
                          <div className="h-3 w-2/3 rounded bg-[#092046]" />
                          <div className="mt-4 h-16 rounded bg-white/70" />
                          <div className="mt-4 h-2 w-full rounded bg-white/80" />
                          <div className="mt-2 h-2 w-3/4 rounded bg-white/80" />
                        </div>
                      </div>
                      <h4 className="mt-4 text-sm font-black leading-6 text-[#092046]">{asset.name}</h4>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill value={asset.source} />
                        <StatusPill value={asset.rights} />
                        <StatusPill value={asset.quality} />
                        <StatusPill value={asset.review} />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-600">사용 위치: {asset.usage}</p>
                    </article>
                  ))}
                </div>
              </article>
            </section>

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">이미지 소스 기준</h3>
                <div className="mt-4 space-y-3">
                  {sourceTypes.map((source) => (
                    <div key={source.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
                      <span className="text-sm font-bold text-slate-700">{source.label}</span>
                      <span className="text-xs font-black text-[#184a88]">{source.value}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">AI 이미지 사용 기준</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  AI 이미지는 상징적 배경, 설명용 일러스트, 분위기 보조 이미지에 한정합니다.
                  실제 행사, 인물, 장소를 촬영한 것처럼 오해될 수 있는 방식은 사용하지 않습니다.
                </p>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">검수 체크</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  {reviewItems.map((item) => (
                    <li key={item} className="rounded-lg bg-[#f4f8ff] px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">다음 작업</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  이미지 자산을 정리한 뒤 음성 MP3 관리 화면으로 이동합니다. 외부 TTS로 제작한 음성 파일을 기사별로 연결합니다.
                </p>
                <button className="mt-5 w-full rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]">
                  음성 MP3 관리로 이동
                </button>
              </article>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
