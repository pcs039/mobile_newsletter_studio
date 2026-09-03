import Link from "next/link";
import { FileUploadCard } from "@/components/file-upload-card";
import { ProjectFileDeleteButton } from "@/components/project-file-delete-button";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { StatusPill } from "@/components/status-pill";
import { audioReviewChecks, audioWorkflow } from "@/lib/newsletter-data";
import { getProjectAudioFiles } from "@/lib/newsletter-repository";

function BrowserAudioControl({ src, title }: { src: string; title: string }) {
  if (!src) {
    return <span className="text-xs font-bold text-slate-500">MP3 등록 후 재생 가능</span>;
  }

  return (
    <audio
      aria-label={`${title} MP3 재생 검수`}
      className="h-10 w-full min-w-48 rounded-md"
      controls
      preload="metadata"
      src={src}
    />
  );
}

export default async function AudioManagementPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const audioData = await getProjectAudioFiles(projectId);
  const audioFiles = audioData.files;
  const firstAudioFile = audioFiles[0];

  return (
    <ProjectAdminShell
      active="audio"
      projectId={projectId}
      title="음성·대본 관리"
      description="모바일 페이지별 음성 대본을 확인하고 외부 TTS로 제작한 MP3 파일을 연결합니다."
      sidebarTitle={
        <>
          음성 MP3
          <br />
          대본
        </>
      }
      sidebarDescription="작성된 페이지와 기사에 맞춰 대본, MP3, 재생 상태를 함께 검수합니다."
      sidebarNoteTitle="운영 기준"
      sidebarNote="음성은 별도 산출물이 아니라 모바일 페이지를 보완하는 접근성 콘텐츠로 관리합니다."
      actions={
        <Link
          href={`/projects/${projectId}/assets`}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          이미지 자산으로 돌아가기
        </Link>
      }
    >
          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <section className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">MP3 파일 업로드</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      기사 또는 페이지별로 외부 TTS에서 제작한 MP3 파일을 업로드하고, 브라우저 재생기로 바로 검수합니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Supabase Storage 저장
                  </span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
                  <FileUploadCard
                    accept="audio/mpeg,audio/mp3"
                    buttonLabel="MP3 선택"
                    description="권장: 기사별 1개 파일, 파일명은 기사명이나 페이지 번호를 포함합니다."
                    kind="audio_mp3"
                    projectSlug={projectId}
                    title="MP3 파일을 선택하거나 이 영역에 끌어다 놓기"
                  />
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-bold text-[#092046]">업로드 전 확인</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <span className="rounded-md bg-slate-50 px-3 py-2">대본 최종본 확인</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">발음·속도 검수</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">기사 연결 위치 선택</span>
                      <span className="rounded-md bg-slate-50 px-3 py-2">브라우저 플레이어 재생 확인</span>
                    </div>
                  </div>
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
                            <p className="text-base font-black text-[#092046]">등록된 MP3 파일이 없습니다.</p>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              위 업로드 영역에서 MP3를 저장하면 실제 파일 목록과 재생기가 여기에 표시됩니다.
                            </p>
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
                              <StatusPill value="업로드 완료" />
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
                              <StatusPill value={item.scriptStatus} />
                              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{item.note}</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button className="rounded-lg border border-[#2f73b7] bg-white px-4 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]">
                                  연결 관리
                                </button>
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

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">선택 기사 대본</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  외부 TTS에 넣기 전 최종 대본을 확인합니다. 본문과 다른 표현을 쓰는 경우 검수 상태를 남깁니다.
                </p>
                <textarea
                  defaultValue={`무안군의 주요 정책과 생활 정보를 안내드립니다. 이번 소식에서는 군정 주요 사업, 생활 지원 정보, 문화 행사 일정을 확인할 수 있습니다.\n\n자세한 내용은 화면의 본문과 연결 버튼을 함께 확인해 주세요.`}
                  className="mt-4 min-h-36 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                />
              </article>
            </section>

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">참고 설명 영역</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">재생 미리보기</h3>
                <div className="mt-4 rounded-lg bg-[#092046] p-5 text-white">
                  <p className="text-sm font-semibold text-sky-200">
                    {firstAudioFile?.title ?? "등록된 MP3 파일 없음"}
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
                    <p className="mb-2 text-xs font-semibold text-sky-100">
                      업로드된 MP3는 private Storage에서 불러와 브라우저 플레이어로 검수합니다.
                    </p>
                    <audio
                      aria-label={firstAudioFile ? `${firstAudioFile.title} 브라우저 재생 검수` : "MP3 파일 브라우저 재생 검수"}
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
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  음성 파일 연결을 확인한 뒤 공개 모바일 화면과 PC e-book 미리보기, URL·QR 발행 화면으로 이동합니다.
                </p>
                <Link
                  href={`/projects/${projectId}/publish`}
                  className="mt-5 block w-full rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                >
                  미리보기·발행 준비
                </Link>
              </article>
            </aside>
          </div>
    </ProjectAdminShell>
  );
}
