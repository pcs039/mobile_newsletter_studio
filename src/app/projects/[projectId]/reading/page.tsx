import Link from "next/link";

const articleItems = [
  {
    page: "2쪽",
    title: "군정 주요 소식",
    status: "편집 중",
    summary: "군정 핵심 소식과 주요 정책 안내",
  },
  {
    page: "4쪽",
    title: "생활 지원 안내",
    status: "검수 필요",
    summary: "신청 기간, 문의처, 대상자 정보 정리",
  },
  {
    page: "7쪽",
    title: "문화 행사 일정",
    status: "초안",
    summary: "행사 일정과 장소, 지도 링크 준비",
  },
  {
    page: "11쪽",
    title: "보건·복지 소식",
    status: "대기",
    summary: "전화 연결과 음성 대본 정리 필요",
  },
];

const editSections = [
  "제목·요약",
  "본문 문단",
  "대표 이미지",
  "문의처·버튼",
  "음성 대본",
];

const previewButtons = ["신청 안내", "전화 연결", "지도 보기"];

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "편집 중"
      ? "bg-sky-100 text-sky-800"
      : status === "검수 필요"
        ? "bg-amber-100 text-amber-800"
        : status === "초안"
          ? "bg-indigo-100 text-indigo-800"
          : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{status}</span>;
}

function FieldLabel({ children }: { children: string }) {
  return <label className="mb-2 block text-sm font-bold text-[#092046]">{children}</label>;
}

function TextInput({ placeholder, defaultValue }: { placeholder: string; defaultValue?: string }) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
    />
  );
}

export default function ReadingEditorPage() {
  return (
    <main className="min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <p className="text-sm font-semibold text-sky-200">Newsletter Studio</p>
            <h1 className="mt-3 text-2xl font-bold leading-tight">
              읽기 보기
              <br />
              편집
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              PDF에서 추출한 텍스트를 모바일 기사형 콘텐츠로 다시 정리합니다.
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
              href="/projects/new"
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              새 소식지 생성
            </Link>
            <Link
              href="/projects/muan-2025-94/pages"
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              PDF 업로드
            </Link>
            <span className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left text-sm font-semibold text-[#071f46] shadow-lg shadow-blue-950/20">
              읽기 보기 편집
            </span>
            <Link
              href="/projects/muan-2025-94/assets"
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              이미지 자산
            </Link>
            <span className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400">
              미리보기·발행
            </span>
          </nav>

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">편집 기준</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              자동 추출 텍스트를 그대로 노출하지 않고, 제목·본문·문의처·버튼·대본을 사람이 정리합니다.
            </p>
          </div>
        </aside>

        <section className="px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">황토골 무안소식지 2025년 제94호</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">
                모바일 읽기 보기 편집
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                기사 단위로 텍스트, 이미지, 문의처, 버튼, 음성 대본을 정리합니다.
              </p>
            </div>
            <Link
              href="/projects/muan-2025-94/pages"
              className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              페이지 관리로 돌아가기
            </Link>
          </header>

          <div className="grid gap-5 2xl:grid-cols-[300px_1fr_360px]">
            <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#092046]">기사 목록</h3>
                  <p className="mt-1 text-sm text-slate-500">페이지별 추출 텍스트를 기사 단위로 정리</p>
                </div>
                <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
                  4건
                </span>
              </div>

              <div className="space-y-3">
                {articleItems.map((article, index) => (
                  <button
                    key={article.title}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      index === 0
                        ? "border-[#184a88] bg-[#f4f8ff] shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black text-[#184a88]">{article.page}</span>
                      <StatusBadge status={article.status} />
                    </div>
                    <p className="mt-3 text-sm font-black text-[#092046]">{article.title}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{article.summary}</p>
                  </button>
                ))}
              </div>
            </aside>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#092046]">기사 편집</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    PDF 추출 텍스트를 모바일 독자에게 맞게 다시 씁니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editSections.map((section) => (
                    <span key={section} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {section}
                    </span>
                  ))}
                </div>
              </div>

              <form className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>기사 제목</FieldLabel>
                    <TextInput defaultValue="군정 주요 소식" placeholder="기사 제목 입력" />
                  </div>
                  <div>
                    <FieldLabel>상태</FieldLabel>
                    <select className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                      <option>편집 중</option>
                      <option>검수 필요</option>
                      <option>완료</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel>요약 문장</FieldLabel>
                  <TextInput defaultValue="무안군의 주요 정책과 생활 정보를 한눈에 확인할 수 있는 소식입니다." placeholder="목차와 카드에 표시될 요약" />
                </div>

                <div>
                  <FieldLabel>본문</FieldLabel>
                  <textarea
                    defaultValue={`무안군은 군민 생활과 밀접한 주요 정책을 안내하고, 각 부서별 신청 정보와 행사 일정을 모바일에서 쉽게 확인할 수 있도록 정리합니다.\n\nPDF 원본에 흩어져 있는 문장을 읽기 쉬운 문단으로 나누고, 필요한 경우 신청 버튼과 전화 연결 버튼을 함께 제공합니다.`}
                    className="min-h-56 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>대표 이미지 자산</FieldLabel>
                    <div className="rounded-lg border border-dashed border-sky-200 bg-[#f4f8ff] p-5">
                      <p className="text-sm font-bold text-[#092046]">이미지 자산 선택 전</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        기관 제공 원본 이미지 또는 디자이너 제작 이미지를 연결합니다.
                      </p>
                      <Link
                        href="/projects/muan-2025-94/assets"
                        className="mt-4 inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                      >
                        이미지 선택
                      </Link>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>문의처</FieldLabel>
                    <div className="grid gap-3">
                      <TextInput defaultValue="무안군 홍보팀" placeholder="담당 부서" />
                      <TextInput defaultValue="061-000-0000" placeholder="전화번호" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>버튼명</FieldLabel>
                    <TextInput defaultValue="자세히 보기" placeholder="예: 신청하기" />
                  </div>
                  <div>
                    <FieldLabel>버튼 링크</FieldLabel>
                    <TextInput defaultValue="https://www.muan.go.kr" placeholder="URL 또는 전화번호" />
                  </div>
                </div>

                <div>
                  <FieldLabel>음성 대본</FieldLabel>
                  <textarea
                    defaultValue="무안군의 주요 정책과 생활 정보를 안내드립니다. 자세한 내용은 본문과 연결 버튼을 확인해 주세요."
                    className="min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    초안 저장
                  </button>
                  <button className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]">
                    검수 요청으로 변경
                  </button>
                </div>
              </form>
            </section>

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">모바일 미리보기</h3>
                <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-950 p-3 shadow-sm">
                  <div className="overflow-hidden rounded-[22px] bg-white">
                    <div className="bg-[#092046] px-4 py-4 text-white">
                      <p className="text-xs font-semibold text-sky-200">황토골 무안소식지</p>
                      <h4 className="mt-2 text-lg font-black">군정 주요 소식</h4>
                    </div>
                    <div className="p-4">
                      <div className="h-36 rounded-xl bg-gradient-to-br from-sky-100 to-blue-50" />
                      <p className="mt-4 text-sm font-bold leading-6 text-[#092046]">
                        무안군의 주요 정책과 생활 정보를 한눈에 확인할 수 있는 소식입니다.
                      </p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        PDF 원본의 내용을 모바일 독자가 읽기 쉬운 문단으로 정리합니다. 문의처와 신청 링크도 함께 제공합니다.
                      </p>
                      <div className="mt-4 rounded-xl bg-[#f4f8ff] px-4 py-3">
                        <p className="text-xs font-bold text-[#184a88]">본문 듣기</p>
                        <div className="mt-3 h-2 rounded-full bg-sky-100">
                          <div className="h-2 w-1/3 rounded-full bg-[#092046]" />
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {previewButtons.map((button) => (
                          <button key={button} className="rounded-lg bg-[#092046] px-4 py-2 text-sm font-bold text-white">
                            {button}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">검수 체크</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <li className="rounded-lg bg-[#f4f8ff] px-3 py-2">문단이 모바일에서 너무 길지 않은지 확인</li>
                  <li className="rounded-lg bg-[#f4f8ff] px-3 py-2">대표 이미지 출처와 대체텍스트 확인</li>
                  <li className="rounded-lg bg-[#f4f8ff] px-3 py-2">전화번호, 지도, 신청 링크 동작 확인</li>
                  <li className="rounded-lg bg-[#f4f8ff] px-3 py-2">음성 대본이 본문과 일치하는지 확인</li>
                </ul>
              </article>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
