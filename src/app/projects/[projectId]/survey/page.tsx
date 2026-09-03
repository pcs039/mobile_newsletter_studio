import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectSurveyForm } from "@/components/project-survey-form";
import { StatusPill } from "@/components/status-pill";
import { getProjectSurveyResponses, getProjectSurveys } from "@/lib/newsletter-repository";

function splitDateTime(value: string) {
  const [date, time] = value.split(" ");

  return {
    date: date || "-",
    time: time || "",
  };
}

export default async function ProjectSurveyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [surveyData, responseData] = await Promise.all([getProjectSurveys(projectId), getProjectSurveyResponses(projectId)]);
  const openSurveys = surveyData.surveys.filter((survey) => survey.status === "진행 중");
  const totalQuestions = surveyData.surveys.reduce((total, survey) => total + survey.questionCount, 0);
  const totalResponses = surveyData.surveys.reduce((total, survey) => total + survey.responseCount, 0);
  const answeredSummaries = responseData.summaries.filter((summary) => summary.responseCount > 0);

  return (
    <ProjectAdminShell
      active="survey"
      projectId={projectId}
      title="설문·이벤트"
      description="모바일 소식지 공개 후 독자 반응, 만족도, 신청 접수, 이벤트 참여를 받을 수 있도록 설문 구조를 관리합니다."
      sidebarTitle={
        <>
          설문
          <br />
          이벤트
        </>
      }
      sidebarDescription="프로젝트별 참여 설문과 이벤트 문항을 구성하고 응답 현황을 확인합니다."
      sidebarNoteTitle="참여 기준"
      sidebarNote="설문과 이벤트는 공개 화면에 연결할 후속 참여 기능입니다. 먼저 제목과 기간, 문항을 정리합니다."
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/projects/survey"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:border-[#184a88] hover:bg-[#f4f8ff]"
          >
            설문/이벤트 목록
          </Link>
          <Link
            href={`/projects/${projectId}/distribution`}
            className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            배포 운영 보기
          </Link>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <section className="grid gap-4 md:grid-cols-3">
            {[
              { label: "설문·이벤트", value: surveyData.surveys.length, detail: "등록 항목" },
              { label: "진행 중", value: openSurveys.length, detail: "공개 가능" },
              { label: "누적 응답", value: totalResponses.toLocaleString("ko-KR"), detail: "응답 테이블 기준" },
            ].map((card) => (
              <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <strong className="text-3xl font-black text-[#092046]">{card.value}</strong>
                  <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
                    {card.detail}
                  </span>
                </div>
              </article>
            ))}
          </section>

          {surveyData.source === "error" && (
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-900">
              {surveyData.message}
            </article>
          )}

          {responseData.source === "error" && (
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-900">
              {responseData.message}
            </article>
          )}

          <ProjectSurveyForm projectSlug={projectId} surveys={surveyData.surveys} />

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">운영 목록</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">설문·이벤트 구성</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500 [word-break:keep-all]">{surveyData.message}</p>
              </div>
              <StatusPill value={`${totalQuestions}개 문항`} />
            </div>

            <div className="divide-y divide-slate-200">
              {surveyData.surveys.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-base font-bold text-[#092046]">등록된 설문·이벤트가 없습니다.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 [word-break:keep-all]">
                    먼저 설문 또는 이벤트를 저장한 뒤, 해당 항목에 문항을 추가하세요.
                  </p>
                </div>
              ) : (
                surveyData.surveys.map((survey) => {
                  const updated = splitDateTime(survey.updated);
                  const startAt = splitDateTime(survey.startAt);
                  const endAt = splitDateTime(survey.endAt);

                  return (
                    <article key={survey.id} className="px-5 py-5">
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_180px]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-black text-[#092046] [word-break:keep-all]">{survey.title}</h4>
                            <StatusPill value={survey.kind} />
                            <StatusPill value={survey.status} />
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
                            {survey.description}
                          </p>
                          <p className="mt-2 text-xs font-black text-[#184a88] [word-break:keep-all]">
                            참여 대상: {survey.respondentTarget}
                          </p>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg bg-[#f8fbff] px-3 py-3">
                              <p className="text-xs font-bold text-slate-500">운영 기간</p>
                              <p className="mt-1 text-sm font-black text-[#092046]">
                                {startAt.date} {startAt.time}
                              </p>
                              <p className="text-sm font-black text-[#184a88]">
                                {endAt.date} {endAt.time}
                              </p>
                            </div>
                            <div className="rounded-lg bg-[#f8fbff] px-3 py-3">
                              <p className="text-xs font-bold text-slate-500">이벤트 메모</p>
                              <p className="mt-1 text-sm font-black text-[#092046] [word-break:keep-all]">
                                {survey.eventPrize}
                              </p>
                              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 [word-break:keep-all]">
                                {survey.drawNote}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3">
                            {survey.questions.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
                                <p className="text-sm font-bold text-slate-600">아직 문항이 없습니다.</p>
                              </div>
                            ) : (
                              survey.questions.map((question) => (
                                <div key={question.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-black text-[#092046] [word-break:keep-all]">
                                      {question.order}. {question.title}
                                    </p>
                                    <StatusPill value={question.type} />
                                    {question.isRequired ? <StatusPill value="필수" /> : null}
                                  </div>
                                  {question.options.length > 0 ? (
                                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500 [word-break:keep-all]">
                                      선택지: {question.options.join(" · ")}
                                    </p>
                                  ) : null}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="grid content-start gap-3">
                          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3">
                            <p className="text-xs font-bold text-slate-500">응답</p>
                            <p className="mt-1 text-2xl font-black text-[#092046]">{survey.responseCount}</p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3">
                            <p className="text-xs font-bold text-slate-500">최근 수정</p>
                            <p className="mt-1 whitespace-nowrap text-sm font-black text-[#092046]">{updated.date}</p>
                            <p className="whitespace-nowrap text-xs font-black text-[#184a88]">{updated.time}</p>
                          </div>
                          {survey.statusCode === "open" && survey.questions.length > 0 ? (
                            <Link
                              href={`/newsletters/${projectId}/survey/${survey.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-[#092046] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#123a78]"
                            >
                              공개 참여 화면
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">응답 분석</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">문항별 응답 요약</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500 [word-break:keep-all]">
                  선택형 문항은 항목별 비율을, 주관식 문항은 최근 답변을 요약해 표시합니다.
                </p>
              </div>
              <StatusPill value={`${answeredSummaries.length}개 문항`} />
            </div>

            <div className="divide-y divide-slate-200">
              {answeredSummaries.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-base font-bold text-[#092046]">아직 요약할 응답이 없습니다.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 [word-break:keep-all]">
                    응답이 제출되면 문항별 선택 비율과 주관식 답변이 이곳에 표시됩니다.
                  </p>
                </div>
              ) : (
                answeredSummaries.map((summary) => (
                  <article key={summary.questionId} className="px-5 py-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#184a88] [word-break:keep-all]">{summary.surveyTitle}</p>
                        <h4 className="mt-1 font-black text-[#092046] [word-break:keep-all]">{summary.questionTitle}</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill value={summary.questionType} />
                        <StatusPill value={`${summary.responseCount}건`} />
                      </div>
                    </div>

                    {summary.options.length > 0 ? (
                      <div className="mt-4 grid gap-3">
                        {summary.options.map((option) => (
                          <div key={`${summary.questionId}-${option.label}`}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
                              <span className="[word-break:keep-all]">{option.label}</span>
                              <span className="whitespace-nowrap">
                                {option.count}건 · {option.percent}%
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-[#184a88]" style={{ width: `${option.percent}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {summary.textAnswers.length > 0 ? (
                      <div className="mt-4 grid gap-2">
                        {summary.textAnswers.map((answer, index) => (
                          <p key={`${summary.questionId}-${index}`} className="rounded-lg bg-[#f8fbff] px-4 py-3 text-sm font-bold leading-6 text-slate-700 [word-break:keep-all]">
                            {answer}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">응답 관리</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">최근 응답</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500 [word-break:keep-all]">{responseData.message}</p>
              </div>
              <Link
                href={`/api/project-surveys?projectSlug=${encodeURIComponent(projectId)}&format=csv`}
                className="rounded-lg border border-[#2f73b7] bg-white px-4 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
              >
                응답 CSV 다운로드
              </Link>
            </div>

            <div className="divide-y divide-slate-200">
              {responseData.responses.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-base font-bold text-[#092046]">아직 제출된 응답이 없습니다.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 [word-break:keep-all]">
                    공개 참여 화면에서 응답이 제출되면 이 영역에 최근 응답이 표시됩니다.
                  </p>
                </div>
              ) : (
                responseData.responses.slice(0, 10).map((response) => (
                  <article key={response.id} className="px-5 py-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="font-black text-[#092046] [word-break:keep-all]">{response.surveyTitle}</h4>
                        <p className="mt-1 text-xs font-bold text-slate-500">제출: {response.submittedAt}</p>
                      </div>
                      <StatusPill value={`${response.answers.length}개 답변`} />
                    </div>
                    <div className="mt-4 grid gap-2">
                      {response.answers.map((answer) => (
                        <div key={`${response.id}-${answer.questionId}`} className="rounded-lg bg-[#f8fbff] px-4 py-3">
                          <p className="text-xs font-black text-[#184a88] [word-break:keep-all]">{answer.questionTitle}</p>
                          <p className="mt-1 whitespace-pre-line text-sm font-bold leading-6 text-slate-700 [word-break:keep-all]">
                            {answer.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">설문 운영 기준</h3>
            <div className="mt-4 grid gap-3">
              {[
                "모바일 공개 화면에 연결할 목적을 먼저 정리",
                "필수 개인정보 수집 여부와 고지 문구 확인",
                "선택지는 짧고 중복 없이 구성",
                "이벤트는 경품, 기간, 발표 방식을 별도 확인",
                "응답 공개 범위와 내부 활용 목적 기록",
              ].map((check) => (
                <label key={check} className="flex gap-3 rounded-lg bg-[#f8fbff] px-3 py-3 text-sm leading-6 text-slate-600">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#092046]" />
                  <span className="[word-break:keep-all]">{check}</span>
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">필요 SQL</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
              저장이 실패하면 Supabase SQL Editor에서 설문 관리 테이블을 먼저 생성해야 합니다.
            </p>
          </article>
        </aside>
      </div>
    </ProjectAdminShell>
  );
}
