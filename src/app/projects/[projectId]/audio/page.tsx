import Link from "next/link";
import { FileUploadCard } from "@/components/file-upload-card";
import { ProjectAudioLinkManager, type ProjectAudioLinkArticleOption } from "@/components/project-audio-link-manager";
import { ProjectFileDeleteButton } from "@/components/project-file-delete-button";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { StatusPill } from "@/components/status-pill";
import { getDisplayArticleTitle } from "@/lib/korean-title-breaks";
import { audioReviewChecks, audioWorkflow } from "@/lib/newsletter-data";
import { getProjectAudioFiles, getProjectContent } from "@/lib/newsletter-repository";

function BrowserAudioControl({ src, title }: { src: string; title: string }) {
  if (!src) {
    return <span className="text-xs font-bold text-slate-500">음성 파일 등록 후 재생 가능</span>;
  }

  return (
    <audio
      aria-label={`${title} 음성 파일 재생 검수`}
      className="h-10 w-full min-w-48 rounded-md"
      controls
      preload="metadata"
      src={src}
    />
  );
}

export default async function AudioManagementPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [audioData, contentData] = await Promise.all([
    getProjectAudioFiles(projectId),
    getProjectContent(projectId),
  ]);
  const audioFiles = audioData.files;
  const firstAudioFile = audioFiles[0];
  const articleOptions: ProjectAudioLinkArticleOption[] = contentData.articles.map((article, index) => ({
    body: [article.body, ...article.blocks.filter((block) => block.isVisible).map((block) => block.body)]
      .filter(Boolean)
      .join("\n\n"),
    id: article.id,
    label: getDisplayArticleTitle(article, `제목 없음 기사 ${index + 1}`),
    summary: article.summary,
  }));
  const articleTitleById = new Map(articleOptions.map((article) => [article.id, article.label]));

  return (
    <ProjectAdminShell
      active="audio"
      projectId={projectId}
      title="음성 소식지 검수"
      description="MP3, WAV, M4A와 대본 상태를 확인합니다."
      sidebarTitle={
        <>
          음성 소식지
          <br />
          검수
        </>
      }
      sidebarDescription="음성 파일, 대본, 재생 상태를 검수합니다."
      sidebarNoteTitle="운영 기준"
      sidebarNote="음성은 모바일 읽기를 보완하는 콘텐츠입니다."
      actions={
        <Link
          href={`/projects/${projectId}/assets`}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          사진·이미지 관리로 돌아가기
        </Link>
      }
    >
          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <section className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <span className="rounded-full bg-[#092046] px-3 py-1 text-xs font-black text-white">필수</span>
                    <h3 className="mt-2 text-lg font-bold text-[#092046]">음성 파일 업로드와 재생 확인</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">MP3, WAV 또는 M4A 업로드 후 재생을 확인합니다.</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Supabase Storage 저장
                  </span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
                  <FileUploadCard
                    accept=".mp3,.wav,.m4a,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave,audio/mp4,audio/x-m4a,audio/m4a,audio/aac"
                    buttonLabel="음성 파일 선택"
                    description="MP3, WAV 또는 M4A 파일을 업로드합니다. 최대 50MB까지 등록할 수 있습니다."
                    kind="audio_mp3"
                    projectSlug={projectId}
                    title="MP3, WAV 또는 M4A 파일을 선택하거나 이 영역에 끌어다 놓기"
                  />
                  <details className="rounded-lg border border-slate-200 bg-white p-4">
                    <summary className="cursor-pointer text-sm font-bold text-[#092046]">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">보조</span>
                      <span className="ml-2">대본·기사 연결 확인</span>
                    </summary>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <span className="rounded-md bg-slate-50 px-3 py-2">대본 최종본 확인</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">발음·속도 검수</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">기사 연결 위치 선택</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">브라우저 플레이어 재생 확인</span>
                    </div>
                  </details>
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">기사별 음성 연결</h3>
                    <p className="mt-1 text-sm text-slate-500">{audioData.message}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      전체
                    </button>
                    <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      미등록
                    </button>
                    <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      교체 필요
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                    <thead className="bg-[#092046] text-white">
                      <tr>
                        <th className="px-4 py-3 font-bold">기사</th>
                        <th className="px-4 py-3 font-bold">상태</th>
                        <th className="px-4 py-3 font-bold">파일명</th>
                        <th className="px-4 py-3 font-bold">재생 시간</th>
                        <th className="px-4 py-3 font-bold">재생 검수</th>
                        <th className="px-4 py-3 font-bold">대본</th>
                        <th className="px-4 py-3 font-bold">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audioFiles.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center">
                            <p className="text-base font-black text-[#092046]">등록된 음성 파일이 없습니다.</p>
                            <p className="mt-2 text-sm leading-6 text-slate-500">MP3, WAV 또는 M4A 파일을 업로드하세요.</p>
                          </td>
                        </tr>
                      ) : (
                        audioFiles.map((item) => (
                          <tr key={item.id} className="border-b border-slate-200 last:border-0">
                            <td className="px-4 py-4">
                              <p className="text-xs font-black text-[#184a88]">업로드 파일</p>
                              <p className="mt-1 font-bold text-[#092046]">{item.title}</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="space-y-2">
                                <StatusPill value={item.articleId ? "연결 완료" : "미연결"} />
                                {item.articleId ? (
                                  <p className="max-w-56 text-xs font-bold leading-5 text-slate-600">
                                    {articleTitleById.get(item.articleId) ?? "연결된 기사 확인 필요"}
                                  </p>
                                ) : (
                                  <p className="text-xs font-semibold text-slate-500">모바일 기사 연결 전</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <p className="max-w-60 break-all font-semibold text-slate-600">{item.filePath}</p>
                              <p className="mt-1 whitespace-nowrap text-xs font-semibold text-slate-500">
                                최근 수정 {item.updated}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-slate-600">{item.duration}</td>
                            <td className="px-4 py-4">
                              <BrowserAudioControl title={item.title} src={item.previewHref} />
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <StatusPill value={item.transcriptText ? "대본 있음" : "대본 없음"} />
                                <StatusPill value={item.scriptStatus} />
                              </div>
                              <p className="mt-2 text-xs font-black text-[#184a88]">{item.transcriptTypeLabel}</p>
                              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.note}</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <ProjectAudioLinkManager
                                  articles={articleOptions}
                                  audioId={item.id}
                                  currentArticleId={item.articleId}
                                  projectSlug={projectId}
                                  transcriptReviewNote={item.note === "검수 메모 없음" ? "" : item.note}
                                  transcriptReviewStatus={item.transcriptReviewStatus}
                                  transcriptText={item.transcriptText}
                                  transcriptType={item.transcriptType}
                                />
                                <ProjectFileDeleteButton
                                  fileLabel={item.title}
                                  kind="audio_mp3"
                                  path={item.filePath}
                                  projectSlug={projectId}
                                  recordId={item.id}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <details className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-sm font-black text-[#092046]">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">보조</span>
                  <span className="ml-2">선택 기사 대본 확인</span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-500">최종 대본을 확인합니다.</p>
                <textarea
                  defaultValue={`무안군의 주요 정책과 생활 정보를 안내드립니다. 이번 소식에서는 군정 주요 사업, 생활 지원 정보, 문화 행사 일정을 확인할 수 있습니다.\n\n자세한 내용은 화면의 본문과 연결 버튼을 함께 확인해 주세요.`}
                  className="mt-4 min-h-36 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                />
              </details>
            </section>

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">상태</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">재생 미리보기</h3>
                <div className="mt-4 rounded-lg bg-[#092046] p-5 text-white">
                  <p className="text-sm font-semibold text-sky-200">
                    {firstAudioFile?.title ?? "등록된 음성 파일 없음"}
                  </p>
                  <p className="mt-2 text-2xl font-black">{firstAudioFile?.duration ?? "--:--"}</p>
                  <div className="mt-5 h-2 rounded-full bg-white/20">
                    <div className="h-2 w-2/5 rounded-full bg-sky-300" />
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button className="rounded-full bg-white px-5 py-2 text-sm font-black text-[#092046]">
                      재생
                    </button>
                    <span className="text-xs font-semibold text-slate-300">외부 TTS 제작 파일</span>
                  </div>
                  <div className="mt-4 rounded-lg bg-white/10 p-3">
                    <p className="mb-2 text-xs font-semibold text-sky-100">브라우저 재생 검수</p>
                    <audio
                      aria-label={firstAudioFile ? `${firstAudioFile.title} 브라우저 재생 검수` : "음성 파일 브라우저 재생 검수"}
                      className="h-10 w-full rounded-md"
                      controls
                      preload="metadata"
                      src={firstAudioFile?.previewHref}
                    />
                  </div>
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">음성 제작 흐름</h3>
                <div className="mt-4 space-y-3">
                  {audioWorkflow.map((step, index) => (
                    <div key={step.label} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#092046] text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#092046]">{step.label}</p>
                        <p className="text-xs font-semibold text-slate-500">{step.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">검수 체크</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  {audioReviewChecks.map((check) => (
                    <li key={check} className="rounded-lg bg-[#f4f8ff] px-3 py-2">
                      {check}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">다음 작업</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">검수 후 발행 화면으로 이동합니다.</p>
                <Link
                  href={`/projects/${projectId}/publish`}
                  className="mt-5 block w-full rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                >
                  검수·발행으로 이동
                </Link>
              </article>
            </aside>
          </div>
    </ProjectAdminShell>
  );
}
