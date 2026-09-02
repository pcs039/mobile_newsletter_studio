import Link from "next/link";
import { sampleNewsletter } from "@/lib/newsletter-data";

const readinessItems = [
  { label: "기본 정보", status: "완료", detail: "소식지명·기관명·발행월 입력" },
  { label: "PDF 페이지", status: "완료", detail: "16쪽 변환 샘플 확인" },
  { label: "읽기 보기", status: "검수 중", detail: "4개 기사 편집 진행" },
  { label: "이미지 자산", status: "검수 중", detail: "권리·화질 확인 필요" },
  { label: "음성 MP3", status: "보완 필요", detail: "2개 기사 미등록" },
];

const distributionItems = [
  { label: "공개 URL", value: sampleNewsletter.publicUrl },
  { label: "QR 코드", value: "발행 후 PNG 다운로드" },
  { label: "공개 상태", value: "검수 중" },
  { label: "최종 수정", value: "2026.09.02 16:05" },
];

const publishChecks = [
  "모바일 읽기 보기에서 제목, 본문, 버튼이 잘리지 않는지 확인",
  "PC e-book에서 원본 지면 확대 보기 품질 확인",
  "전화, URL, 지도, 내부 페이지 이동 링크 확인",
  "이미지 출처, 권리, 대체텍스트 입력 상태 확인",
  "음성 파일 재생과 대본 일치 여부 확인",
];

const mobileArticles = ["군정 주요 소식", "생활 지원 안내", "문화 행사 일정"];

function StatusPill({ value }: { value: string }) {
  const tone =
    value === "완료"
      ? "bg-emerald-100 text-emerald-800"
      : value === "검수 중"
        ? "bg-sky-100 text-sky-800"
        : value === "보완 필요"
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{value}</span>;
}

function QrMock() {
  const filled = new Set([0, 1, 2, 4, 6, 8, 10, 11, 14, 16, 18, 20, 21, 22, 24, 27, 30, 31, 32, 34, 36, 38, 40, 41, 42, 44, 46, 48]);

  return (
    <div className="grid h-32 w-32 grid-cols-7 gap-1 rounded-lg bg-white p-3 shadow-inner">
      {Array.from({ length: 49 }, (_, index) => (
        <span
          key={index}
          className={`rounded-sm ${filled.has(index) ? "bg-[#092046]" : "bg-slate-100"}`}
        />
      ))}
    </div>
  );
}

export default function PublishPage() {
  return (
    <main className="min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <p className="text-sm font-semibold text-sky-200">Newsletter Studio</p>
            <h1 className="mt-3 text-2xl font-bold leading-tight">
              미리보기
              <br />
              발행
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              공개 전 모바일 읽기 보기, PC e-book, URL·QR 발행 상태를 최종 확인합니다.
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
            <Link
              href="/projects/muan-2025-94/assets"
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              이미지 자산
            </Link>
            <Link
              href="/projects/muan-2025-94/audio"
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              음성 MP3
            </Link>
            <span className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left text-sm font-semibold text-[#071f46] shadow-lg shadow-blue-950/20">
              미리보기·발행
            </span>
          </nav>

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">공개 기준</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              모바일은 읽기 보기와 음성 듣기 중심, PC는 원본 e-book 확인 중심으로 발행합니다.
            </p>
          </div>
        </aside>

        <section className="px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">황토골 무안소식지 2025년 제94호</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">
                미리보기·발행
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                공개 화면 품질과 배포 정보를 확인한 뒤 URL과 QR코드를 발행합니다.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/projects/muan-2025-94/audio"
                className="rounded-lg border border-slate-200 px-5 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                음성 관리로 돌아가기
              </Link>
              <button className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]">
                검수 요청
              </button>
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <section className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">발행 준비 상태</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      공개 전 필요한 제작 항목의 완료 여부를 확인합니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                    일부 보완 필요
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {readinessItems.map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-[#f9fbfe] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-[#092046]">{item.label}</p>
                        <StatusPill value={item.status} />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </article>

              <section className="grid gap-5 2xl:grid-cols-2">
                <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">모바일 읽기 보기</h3>
                    <p className="mt-1 text-sm text-slate-500">시민이 휴대전화에서 보는 기본 공개 화면</p>
                  </div>
                  <StatusPill value="검수 중" />
                </div>
                <Link
                  href={sampleNewsletter.publicUrl}
                  className="mb-4 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  공개 화면 열기
                </Link>
                <div className="mx-auto max-w-[300px] rounded-[30px] border border-slate-200 bg-slate-950 p-3 shadow-sm">
                    <div className="overflow-hidden rounded-[24px] bg-white">
                      <div className="bg-[#092046] px-4 py-4 text-white">
                        <p className="text-xs font-semibold text-sky-200">황토골 무안소식지</p>
                        <h4 className="mt-2 text-lg font-black">2025년 제94호</h4>
                      </div>
                      <div className="p-4">
                        <div className="h-28 rounded-xl bg-gradient-to-br from-sky-100 to-blue-50" />
                        <div className="mt-4 space-y-2">
                          {mobileArticles.map((article) => (
                            <div key={article} className="rounded-lg border border-slate-200 px-3 py-2">
                              <p className="text-sm font-bold text-[#092046]">{article}</p>
                              <div className="mt-2 h-2 w-4/5 rounded bg-slate-200" />
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl bg-[#f4f8ff] px-4 py-3">
                          <p className="text-xs font-bold text-[#184a88]">본문 듣기</p>
                          <div className="mt-3 h-2 rounded-full bg-sky-100">
                            <div className="h-2 w-2/5 rounded-full bg-[#092046]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">PC e-book 보기</h3>
                    <p className="mt-1 text-sm text-slate-500">원본 PDF 지면을 PC 화면에서 확인</p>
                  </div>
                  <StatusPill value="완료" />
                </div>
                <Link
                  href={sampleNewsletter.ebookUrl}
                  className="mb-4 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  PC e-book 열기
                </Link>
                <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
                    <div className="rounded-t-lg bg-[#092046] px-4 py-3 text-sm font-bold text-white">
                      PC e-book 미리보기
                    </div>
                    <div className="grid gap-4 rounded-b-lg bg-white p-4 md:grid-cols-2">
                      {[1, 2].map((page) => (
                        <div key={page} className="aspect-[3/4] rounded-md border border-slate-200 bg-gradient-to-br from-white to-sky-50 p-3">
                          <div className="h-full rounded border border-slate-200 bg-white p-3">
                            <div className="h-3 w-2/3 rounded bg-[#092046]" />
                            <div className="mt-4 h-16 rounded bg-sky-100" />
                            <div className="mt-4 space-y-2">
                              <div className="h-2 rounded bg-slate-200" />
                              <div className="h-2 rounded bg-slate-200" />
                              <div className="h-2 w-2/3 rounded bg-slate-200" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              </section>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">발행 전 체크리스트</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {publishChecks.map((check) => (
                    <label key={check} className="flex gap-3 rounded-lg bg-[#f4f8ff] px-3 py-3 text-sm leading-6 text-slate-600">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[#092046]" />
                      <span>{check}</span>
                    </label>
                  ))}
                </div>
              </article>
            </section>

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">공개 정보</h3>
                <div className="mt-4 space-y-3">
                  {distributionItems.map((item) => (
                    <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-3">
                      <p className="text-xs font-black text-[#184a88]">{item.label}</p>
                      <p className="mt-1 break-words text-sm font-bold text-slate-700">{item.value}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">QR 코드</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      실제 QR 생성은 발행 기능 연동 단계에서 붙입니다.
                    </p>
                  </div>
                  <QrMock />
                </div>
                <button className="mt-5 w-full rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  QR PNG 다운로드
                </button>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">공개 상태 변경</h3>
                <select className="mt-4 h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                  <option>비공개</option>
                  <option>검수 중</option>
                  <option>공개</option>
                </select>
                <button className="mt-4 w-full rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]">
                  공개 URL 발행
                </button>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">다음 개발</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  여기까지가 관리자 화면 1차 골격입니다. 다음부터는 공통 레이아웃 분리와 실제 데이터 구조 설계로 넘어갑니다.
                </p>
              </article>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
