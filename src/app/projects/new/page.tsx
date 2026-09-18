import Link from "next/link";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { HomeButton } from "@/components/home-button";
import { ProjectCreateForm } from "@/components/project-create-form";
import { requireAppUser } from "@/lib/app-auth";
import { packageOptions, productionModeOptions } from "@/lib/newsletter-data";
import { getFontAssets } from "@/lib/newsletter-repository";

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
    description: "기사형 공개 화면",
  },
  {
    title: "PC e-book 보기",
    description: "원본 지면 확인",
  },
  {
    title: "음성 듣기 준비",
    description: "음성 파일 연결",
  },
  {
    title: "외부 AI·프로그램 결과물 등록",
    description: "완성 파일 등록",
  },
];

export default async function NewProjectPage() {
  await requireAppUser("/projects/new");
  const fontData = await getFontAssets({ activeOnly: true });

  return (
    <main className="admin-workspace min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">
              작성/수정
              <br />
              기본 정보
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">기본 정보를 먼저 저장합니다.</p>
          </div>

          <AdminMainNavigation active="edit" />

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
              <p className="text-sm font-semibold text-[#184a88]">작성/수정 · 기본 정보</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">
                새 프로젝트 기본 정보 입력
              </h2>
              <p className="mt-2 text-sm text-slate-500">필수 정보를 저장한 뒤 제작 화면으로 이동합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <HomeButton />
              <Link
                href="/projects/edit"
                className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
              >
                작성/수정 목록
              </Link>
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <ProjectCreateForm fonts={fontData.fonts} />

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기준</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">상품 옵션 기준</h3>
                <div className="mt-4 space-y-3">
                  {packageOptions.map((option) => (
                    <div key={option.label} className="rounded-lg bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#092046]">{option.label}</p>
                        <span className="text-xs font-black text-[#184a88]">{option.status}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{option.detail}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기준</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">제작 방식 기준</h3>
                <div className="mt-4 space-y-3">
                  {productionModeOptions.map((option) => (
                    <div key={option.label} className="rounded-lg bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#092046]">{option.label}</p>
                        <span className="text-xs font-black text-[#184a88]">{option.status}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{option.detail}</p>
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
                      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{option.description}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">운영 메모</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-500">
                  <li>PDF 원본 보관</li>
                  <li>모바일 읽기·음성 구성</li>
                  <li>이미지 권리 상태 확인</li>
                </ul>
              </article>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
