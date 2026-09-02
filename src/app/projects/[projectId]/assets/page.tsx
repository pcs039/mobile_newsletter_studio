import Link from "next/link";
import { FileUploadCard } from "@/components/file-upload-card";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { StatusPill } from "@/components/status-pill";
import { imageReviewItems, imageSourceTypes } from "@/lib/newsletter-data";
import { getProjectAssetFiles } from "@/lib/newsletter-repository";

export default async function ImageAssetsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const assetData = await getProjectAssetFiles(projectId);
  const assets = assetData.assets;

  return (
    <ProjectAdminShell
      active="assets"
      projectId={projectId}
      title="이미지 자산 관리"
      description="모바일 읽기 화면에 입힐 대표 이미지, 배경 이미지, 배너의 품질과 권리 상태를 관리합니다."
      sidebarTitle={
        <>
          이미지 자산
          <br />
          관리
        </>
      }
      sidebarDescription="기사 대표 이미지, 배경, 배너, PDF 발췌 이미지를 출처와 권리 기준으로 관리합니다."
      sidebarNoteTitle="v0.5 반영"
      sidebarNote="PDF 발췌 이미지는 보조 수단으로만 두고, 기관 제공 원본 또는 별도 제작 이미지를 우선 사용합니다."
      actions={
        <Link
          href={`/projects/${projectId}/reading`}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          읽기 보기로 돌아가기
        </Link>
      }
    >
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
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Supabase Storage 저장
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_280px]">
                  <FileUploadCard
                    accept="image/png,image/jpeg,image/webp"
                    buttonLabel="이미지 선택"
                    description="권장: 원본 사진, 웹용 배너, 카드 이미지. PDF 발췌 이미지는 품질 확인 후 사용합니다."
                    kind="asset_image"
                    projectSlug={projectId}
                    title="이미지 파일을 선택하거나 이 영역에 끌어다 놓기"
                  />
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
                    <p className="mt-1 text-sm text-slate-500">{assetData.message}</p>
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

                {assets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
                    <p className="text-base font-black text-[#092046]">등록된 이미지 자산이 없습니다.</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      위 업로드 영역에서 이미지를 저장하면 실제 파일 목록과 썸네일이 여기에 표시됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    {assets.map((asset) => (
                      <article key={asset.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="h-40 overflow-hidden rounded-lg border border-slate-200 bg-[#eef4fb]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset.previewHref}
                            alt={asset.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <h4 className="mt-4 text-sm font-black leading-6 text-[#092046]">{asset.title}</h4>
                        <p className="mt-1 break-all text-xs font-semibold leading-5 text-slate-500">
                          {asset.filePath}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusPill value={asset.source} />
                          <StatusPill value={asset.rights} />
                          <StatusPill value={asset.quality} />
                          <StatusPill value={asset.review} />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-600">사용 위치: {asset.usage}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">최근 수정 {asset.updated}</p>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </section>

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">이미지 소스 기준</h3>
                <div className="mt-4 space-y-3">
                  {imageSourceTypes.map((source) => (
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
                  {imageReviewItems.map((item) => (
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
                <Link
                  href={`/projects/${projectId}/audio`}
                  className="mt-5 block w-full rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                >
                  음성 MP3 관리로 이동
                </Link>
              </article>
            </aside>
          </div>
    </ProjectAdminShell>
  );
}
