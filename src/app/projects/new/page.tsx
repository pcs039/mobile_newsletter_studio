import Link from "next/link";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { packageOptions, productionModeOptions } from "@/lib/newsletter-data";

const requiredFields = [
  "소식지명",
  "기관명",
  "발행월",
  "공개 주소",
  "대표 색상",
  "상품 옵션",
  "제작 방식",
];

const publishOptions = [
  {
    title: "모바일 읽기 보기",
    description: "시민이 휴대전화에서 읽기 쉬운 기사형 화면을 기본 공개 화면으로 사용합니다.",
  },
  {
    title: "PC e-book 보기",
    description: "원본 PDF 지면을 큰 화면에서 확인할 수 있는 PC 중심 보기를 함께 준비합니다.",
  },
  {
    title: "음성 듣기 준비",
    description: "외부 TTS로 만든 MP3를 나중에 기사별 또는 페이지별로 연결할 수 있게 둡니다.",
  },
  {
    title: "외부 AI·프로그램 결과물 등록",
    description: "1차 MVP에서는 AI나 외부 제작 도구를 직접 실행하지 않고, 완성된 이미지·원고·음성·e-book 링크를 등록합니다.",
  },
];

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-bold text-[#092046]">
      {children}
      {required && <span className="ml-1 text-sky-700">*</span>}
    </label>
  );
}

function TextInput({ placeholder, type = "text" }: { placeholder: string; type?: "text" | "month" }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
    />
  );
}

export default function NewProjectPage() {
  return (
    <main className="admin-workspace min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">
              새 소식지
              <br />
              만들기
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              상품 옵션과 제작 방식을 먼저 정한 뒤 PDF 원본 보관과 페이지 이미지 등록으로 넘어갑니다.
            </p>
          </div>

          <nav className="space-y-2">
            <Link
              href="/"
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              프로젝트 대시보드
            </Link>
            <span className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left text-sm font-semibold text-[#071f46] shadow-lg shadow-blue-950/20">
              새 소식지 생성
            </span>
            <span className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400">
              PDF·이미지
            </span>
            <span className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400">
              읽기 보기 편집
            </span>
            <span className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-400">
              미리보기·발행
            </span>
          </nav>

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">필수 입력</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {requiredFields.map((field) => (
                <span key={field} className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-sky-100">
                  {field}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <section className="px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">프로젝트 생성</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">
                새 모바일 소식지 기본 정보
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                1차 MVP에서는 입력 화면과 이동 흐름을 먼저 만들고, 실제 저장은 이후 Supabase 단계에서 연결합니다.
              </p>
            </div>
            <Link
              href="/"
              className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              대시보드로 돌아가기
            </Link>
          </header>

          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">작업 입력 영역</p>
                  <h3 className="mt-1 text-lg font-bold text-[#092046]">프로젝트 기본값 입력</h3>
                </div>
                <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
                  저장 전 샘플 UI
                </span>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <FieldLabel required>소식지명</FieldLabel>
                  <TextInput placeholder="예: 황토골 무안소식지 2025년 제94호" />
                </div>

                <div>
                  <FieldLabel required>기관명</FieldLabel>
                  <TextInput placeholder="예: 무안군" />
                </div>

                <div>
                  <FieldLabel required>발행월</FieldLabel>
                  <TextInput type="month" placeholder="2026-09" />
                </div>

                <div>
                  <FieldLabel required>공개 주소 slug</FieldLabel>
                  <TextInput placeholder="예: muan-2025-94" />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>설명</FieldLabel>
                  <textarea
                    placeholder="소식지의 성격, 발행 목적, 주요 콘텐츠를 간단히 적습니다."
                    className="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <FieldLabel required>대표 색상</FieldLabel>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="h-11 w-16 rounded-lg border border-slate-200 bg-[#092046]" />
                    <input
                      defaultValue="#092046"
                      className="h-12 min-w-36 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                    />
                    <span className="text-sm font-semibold text-slate-600">기본값: 딥블루</span>
                  </div>
                </div>

                <div>
                  <FieldLabel>상태</FieldLabel>
                  <select className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                    <option>제작 중</option>
                    <option>검수 중</option>
                    <option>비공개</option>
                  </select>
                </div>

                <div>
                  <FieldLabel required>상품 옵션</FieldLabel>
                  <select className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                    <option>표준형</option>
                    <option>기본형</option>
                    <option>고급형</option>
                    <option>프리미엄</option>
                    <option>월간 운영형</option>
                  </select>
                </div>

                <div>
                  <FieldLabel required>제작 방식</FieldLabel>
                  <select className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                    <option>템플릿+이미지 혼합</option>
                    <option>템플릿 중심</option>
                    <option>전체 이미지형</option>
                    <option>외부 e-book 연동형</option>
                  </select>
                </div>

                <div>
                  <FieldLabel>예상 작업시간</FieldLabel>
                  <TextInput placeholder="예: 18~24시간" />
                </div>

                <div>
                  <FieldLabel>디자이너 투입 상한</FieldLabel>
                  <TextInput placeholder="예: 6시간 또는 별도 견적" />
                </div>
              </div>

              <div className="mt-7 rounded-lg border border-dashed border-sky-300 bg-[#eaf2ff] p-5">
                <h3 className="text-base font-bold text-[#092046]">다음 단계: PDF 원본·페이지 이미지 등록</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  프로젝트 정보를 만든 뒤 PDF 파일은 원본 보관용으로 업로드합니다. PC e-book용 페이지 이미지는
                  수동 등록하거나 외부 e-book 링크를 연결하고, 이후 모바일 읽기 보기용 기사와 이미지 자산을 연결합니다.
                </p>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Link
                  href="/"
                  className="rounded-lg border border-slate-200 px-5 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  취소
                </Link>
                <Link
                  href="/projects/muan-2025-94/pages"
                  className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]"
                >
                  프로젝트 정보 임시 저장
                </Link>
              </div>
            </form>

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">참고 설명 영역</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">상품 옵션 기준</h3>
                <div className="mt-4 space-y-3">
                  {packageOptions.map((option) => (
                    <div key={option.label} className="rounded-lg bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#092046]">{option.label}</p>
                        <span className="text-xs font-black text-[#184a88]">{option.status}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{option.detail}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">참고 설명 영역</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">제작 방식 기준</h3>
                <div className="mt-4 space-y-3">
                  {productionModeOptions.map((option) => (
                    <div key={option.label} className="rounded-lg bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#092046]">{option.label}</p>
                        <span className="text-xs font-black text-[#184a88]">{option.status}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{option.detail}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">공개 화면 구성</h3>
                <div className="mt-4 space-y-3">
                  {publishOptions.map((option) => (
                    <div key={option.title} className="rounded-lg bg-slate-50 p-4">
                      <p className="text-sm font-bold text-[#092046]">{option.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">운영 메모</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <li>PDF 원본은 PC e-book 기준 자산으로 보존합니다.</li>
                  <li>모바일 공개 화면은 읽기 보기와 음성 듣기를 중심으로 구성합니다.</li>
                  <li>이미지 자산은 출처, 권리 확인, 대체텍스트를 함께 관리합니다.</li>
                </ul>
              </article>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
