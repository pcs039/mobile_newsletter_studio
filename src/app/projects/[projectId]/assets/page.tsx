import Link from "next/link";
import { FileUploadCard } from "@/components/file-upload-card";
import { ProjectFileDeleteButton } from "@/components/project-file-delete-button";
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
      title="사진·이미지 관리"
      description="기사용 이미지 소재를 관리합니다."
      sidebarTitle={
        <>
          사진·이미지
          <br />
          관리
        </>
      }
      sidebarDescription="사진, 이미지, 링크 소재를 정리합니다."
      sidebarNoteTitle="운영 기준"
      sidebarNote="기사와 이미지 페이지에 붙는 소재 보관함입니다."
      actions={
        <Link
          href={`/projects/${projectId}/reading`}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          기사 작성/편집
        </Link>
      }
    >
          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <section className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <span className="rounded-full bg-[#092046] px-3 py-1 text-xs font-black text-white">기본 입력</span>
                    <h3 className="mt-2 text-lg font-bold text-[#092046]">자주 쓰는 이미지 등록</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">이미지를 올리고 목록에서 상태를 확인합니다.</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Supabase Storage 저장
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_280px]">
                  <FileUploadCard
                    accept="image/png,image/jpeg,image/webp"
                    buttonLabel="이미지 선택"
                    description="PNG, JPG, WebP를 업로드합니다."
                    kind="asset_image"
                    projectSlug={projectId}
                    title="이미지 파일을 선택하거나 이 영역에 끌어다 놓기"
                  />
                  <details className="rounded-lg border border-slate-200 bg-white p-4">
                    <summary className="cursor-pointer text-sm font-bold text-[#092046]">
                      <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]">선택</span>
                      <span className="ml-2">선택 정보 확인</span>
                    </summary>
                    <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                      필요한 경우 목록에서 보완합니다.
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <span className="rounded-md bg-slate-50 px-3 py-2">출처</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">권리 확인 상태</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">품질 상태</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">대체텍스트</span>
                    </div>
                  </details>
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">등록 소재 목록</h3>
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
                    <p className="text-base font-black text-[#092046]">등록된 이미지 소재가 없습니다.</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">이미지를 업로드하세요.</p>
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
                        <div className="mt-3 flex items-end justify-between gap-3">
                          <p className="whitespace-nowrap text-xs font-semibold text-slate-500">
                            최근 수정 {asset.updated}
                          </p>
                          <ProjectFileDeleteButton
                            fileLabel={asset.title}
                            kind="asset_image"
                            path={asset.filePath}
                            projectSlug={projectId}
                            recordId={asset.id}
                          />
                        </div>
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
                <p className="mt-3 text-sm leading-6 text-slate-500">AI 이미지는 보조 이미지에만 사용합니다.</p>
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
                <p className="mt-2 text-sm leading-6 text-slate-500">다음은 음성 파일 검수입니다.</p>
                <Link
                  href={`/projects/${projectId}/audio`}
                  className="mt-5 block w-full rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                >
                  음성 소식지 검수로 이동
                </Link>
              </article>
            </aside>
          </div>
    </ProjectAdminShell>
  );
}
