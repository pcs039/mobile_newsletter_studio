import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { HomeButton } from "@/components/home-button";
import { ProjectCreateForm } from "@/components/project-create-form";
import { requireAppUser } from "@/lib/app-auth";
import { packageOptions, productionModeOptions } from "@/lib/newsletter-data";

const requiredFields = [
  "소식지명",
  "기관명",
  "작업자명",
  "발행일",
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
    description: "운영 초기에는 AI나 외부 제작 도구를 직접 실행하지 않고, 완성된 이미지·원고·음성·e-book 링크를 등록합니다.",
  },
];

export default async function NewProjectPage() {
  await requireAppUser("/projects/new");

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

          <AdminMainNavigation active="new" />

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
                입력한 기본 정보를 Supabase 프로젝트 데이터로 저장하고 다음 제작 단계로 이동합니다.
              </p>
            </div>
            <HomeButton />
          </header>

          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <ProjectCreateForm />

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
