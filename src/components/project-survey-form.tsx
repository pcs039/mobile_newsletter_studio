"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ProjectSurveyItem, ProjectSurveyQuestion } from "@/lib/newsletter-repository";

type ProjectSurveyFormProps = {
  projectSlug: string;
  surveys: ProjectSurveyItem[];
};

type SubmitState = {
  target: string | null;
  message: string;
  isError: boolean;
};

type QuestionType = "single_choice" | "multiple_choice" | "short_text" | "long_text" | "scale";

function getText(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function needsChoiceOptions(type: QuestionType) {
  return type === "single_choice" || type === "multiple_choice";
}

function getDateTimeInputValue(value: string) {
  return value ? value.slice(0, 16) : "";
}

function getQuestionOptionsText(question: ProjectSurveyQuestion) {
  return question.options.join("\n");
}

export function ProjectSurveyForm({ projectSlug, surveys }: ProjectSurveyFormProps) {
  const router = useRouter();
  const [submitState, setSubmitState] = useState<SubmitState>({ target: null, message: "", isError: false });
  const [questionType, setQuestionType] = useState<QuestionType>("single_choice");

  async function submitPayload(target: string, payload: Record<string, string | boolean | number>) {
    setSubmitState({ target, message: "", isError: false });

    const response = await fetch("/api/project-surveys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setSubmitState({
        target: null,
        message: result?.message ?? "저장에 실패했습니다.",
        isError: true,
      });
      return false;
    }

    setSubmitState({
      target: null,
      message: result.message ?? "저장했습니다.",
      isError: false,
    });
    router.refresh();
    return true;
  }

  async function handleSurveySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const saved = await submitPayload("survey", {
      action: "createSurvey",
      projectSlug,
      title: getText(formData, "title"),
      description: getText(formData, "description"),
      kind: getText(formData, "kind"),
      status: getText(formData, "status"),
      respondentTarget: getText(formData, "respondentTarget"),
      startAt: getText(formData, "startAt"),
      endAt: getText(formData, "endAt"),
      eventPrize: getText(formData, "eventPrize"),
      drawNote: getText(formData, "drawNote"),
    });

    if (saved) {
      form.reset();
      setQuestionType("single_choice");
    }
  }

  async function handleSurveyUpdate(event: FormEvent<HTMLFormElement>, surveyId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await submitPayload(`survey-${surveyId}`, {
      action: "updateSurvey",
      projectSlug,
      surveyId,
      title: getText(formData, "title"),
      description: getText(formData, "description"),
      kind: getText(formData, "kind"),
      status: getText(formData, "status"),
      respondentTarget: getText(formData, "respondentTarget"),
      startAt: getText(formData, "startAt"),
      endAt: getText(formData, "endAt"),
      eventPrize: getText(formData, "eventPrize"),
      drawNote: getText(formData, "drawNote"),
    });
  }

  async function handleSurveyDelete(survey: ProjectSurveyItem) {
    const confirmed = window.confirm(
      `이 참여 콘텐츠를 삭제하시겠습니까?\n\n${survey.title}\n\n연결된 기사에서는 참여 콘텐츠 연결이 해제됩니다.`,
    );

    if (!confirmed) {
      return;
    }

    await submitPayload(`delete-survey-${survey.id}`, {
      action: "deleteSurvey",
      projectSlug,
      surveyId: survey.id,
    });
  }

  async function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const saved = await submitPayload("question", {
      action: "createQuestion",
      projectSlug,
      surveyId: getText(formData, "surveyId"),
      order: Number(getText(formData, "order")) || 1,
      title: getText(formData, "title"),
      type: getText(formData, "type"),
      options: getText(formData, "options"),
      isRequired: getText(formData, "isRequired") === "on",
    });

    if (saved) {
      form.reset();
    }
  }

  async function handleQuestionUpdate(event: FormEvent<HTMLFormElement>, surveyId: string, questionId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await submitPayload(`question-${questionId}`, {
      action: "updateQuestion",
      projectSlug,
      surveyId,
      questionId,
      order: Number(getText(formData, "order")) || 1,
      title: getText(formData, "title"),
      type: getText(formData, "type"),
      options: getText(formData, "options"),
      isRequired: getText(formData, "isRequired") === "on",
    });
  }

  async function handleQuestionDelete(surveyId: string, question: ProjectSurveyQuestion) {
    const confirmed = window.confirm(`이 문항을 삭제하시겠습니까?\n\n${question.title}`);

    if (!confirmed) {
      return;
    }

    await submitPayload(`delete-question-${question.id}`, {
      action: "deleteQuestion",
      projectSlug,
      surveyId,
      questionId: question.id,
    });
  }

  async function handleQuestionMove(surveyId: string, question: ProjectSurveyQuestion, direction: "up" | "down") {
    await submitPayload(`move-question-${question.id}-${direction}`, {
      action: "moveQuestion",
      projectSlug,
      surveyId,
      questionId: question.id,
      direction,
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <form onSubmit={handleSurveySubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">운영 항목</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">참여 콘텐츠 만들기</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
            공개 소식지와 연결할 만족도 조사, 참여 이벤트, 신청 접수용 설문을 프로젝트별로 관리합니다.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#092046]">
              종류
              <select
                name="kind"
                defaultValue="survey"
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
              >
                <option value="survey">설문</option>
                <option value="event">이벤트</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#092046]">
              상태
              <select
                name="status"
                defaultValue="draft"
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
              >
                <option value="draft">준비 중</option>
                <option value="open">진행 중</option>
                <option value="closed">마감</option>
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            제목 *
            <input
              name="title"
              required
              placeholder="예: 모바일 소식지 만족도 조사"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            설명
            <textarea
              name="description"
              rows={3}
              placeholder="예: 이번 호 모바일 소식지 이용 편의성과 개선 의견을 확인합니다."
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            참여 대상
            <input
              name="respondentTarget"
              placeholder="예: 모바일 소식지 접속자 전체"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#092046]">
              시작 일시
              <input
                name="startAt"
                type="datetime-local"
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#092046]">
              종료 일시
              <input
                name="endAt"
                type="datetime-local"
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            이벤트 혜택
            <input
              name="eventPrize"
              placeholder="예: 모바일 상품권 1만원권 20명"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            추첨·발표 메모
            <input
              name="drawNote"
              placeholder="예: 10월 10일 홈페이지 공지"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitState.target !== null}
          className="mt-5 w-full rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitState.target === "survey" ? "저장 중" : "참여 콘텐츠 저장"}
        </button>
      </form>

      <form onSubmit={handleQuestionSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">문항 구성</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">문항 추가</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
            선택형, 단답형, 서술형, 척도형 문항을 설문에 추가합니다. 선택지는 한 줄에 하나씩 입력합니다.
          </p>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            연결 설문 *
            <select
              name="surveyId"
              required
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            >
              <option value="">설문을 선택하세요</option>
              {surveys.map((survey) => (
                <option key={survey.id} value={survey.id}>
                  {survey.title}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#092046]">
              순서
              <input
                name="order"
                type="number"
                min="1"
                placeholder="예: 1"
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#092046]">
              문항 형식
              <select
                name="type"
                value={questionType}
                onChange={(event) => setQuestionType(event.target.value as QuestionType)}
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
              >
                <option value="single_choice">단일 선택</option>
                <option value="multiple_choice">복수 선택</option>
                <option value="short_text">단답형</option>
                <option value="long_text">서술형</option>
                <option value="scale">척도형</option>
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            문항 *
            <input
              name="title"
              required
              placeholder="예: 이번 모바일 소식지는 읽기 편했나요?"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            선택지 {needsChoiceOptions(questionType) ? "*" : ""}
            <textarea
              name="options"
              required={needsChoiceOptions(questionType)}
              rows={5}
              placeholder={
                needsChoiceOptions(questionType)
                  ? "매우 그렇다\n그렇다\n보통이다\n그렇지 않다"
                  : "단답형, 서술형, 척도형은 선택지를 비워두어도 됩니다."
              }
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="flex items-center gap-3 rounded-lg bg-[#f8fbff] px-4 py-3 text-sm font-bold text-[#092046]">
            <input name="isRequired" type="checkbox" className="h-4 w-4 accent-[#092046]" defaultChecked />
            필수 응답 문항
          </label>
        </div>

        <button
          type="submit"
          disabled={submitState.target !== null || surveys.length === 0}
          className="mt-5 w-full rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitState.target === "question" ? "저장 중" : "문항 저장"}
        </button>
      </form>

      {submitState.message ? (
        <p
          className={`xl:col-span-2 rounded-lg px-4 py-3 text-sm font-bold leading-6 ${
            submitState.isError ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {submitState.message}
        </p>
      ) : null}

      <section className="xl:col-span-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">운영 수정</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">참여 콘텐츠와 문항 관리</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
            진행 중 전환은 문항 1개 이상과 올바른 운영 기간이 필요합니다. 응답이 있는 항목은 삭제할 수 없습니다.
          </p>
        </div>

        {surveys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-bold text-slate-600">수정할 참여 콘텐츠가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {surveys.map((survey) => (
              <details key={survey.id} className="rounded-xl border border-slate-200 bg-[#f8fbff] p-4">
                <summary className="cursor-pointer text-sm font-black text-[#092046]">
                  {survey.title} · {survey.status} · {survey.questionCount}문항 · 응답 {survey.responseCount}건
                </summary>

                <form onSubmit={(event) => handleSurveyUpdate(event, survey.id)} className="mt-4 grid gap-3 rounded-lg bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="grid gap-2 text-xs font-bold text-[#092046]">
                      종류
                      <select name="kind" defaultValue={survey.kindCode} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                        <option value="survey">설문</option>
                        <option value="event">이벤트</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-xs font-bold text-[#092046]">
                      상태
                      <select name="status" defaultValue={survey.statusCode} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                        <option value="draft">준비 중</option>
                        <option value="open">진행 중</option>
                        <option value="closed">마감</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-xs font-bold text-[#092046]">
                      참여 대상
                      <input name="respondentTarget" defaultValue={survey.respondentTarget === "대상 미지정" ? "" : survey.respondentTarget} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
                    </label>
                  </div>
                  <label className="grid gap-2 text-xs font-bold text-[#092046]">
                    제목
                    <input name="title" required defaultValue={survey.title} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
                  </label>
                  <label className="grid gap-2 text-xs font-bold text-[#092046]">
                    설명
                    <textarea name="description" rows={3} defaultValue={survey.description === "설명 미입력" ? "" : survey.description} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold leading-6" />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-xs font-bold text-[#092046]">
                      시작 일시
                      <input name="startAt" type="datetime-local" defaultValue={getDateTimeInputValue(survey.startAtRaw)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
                    </label>
                    <label className="grid gap-2 text-xs font-bold text-[#092046]">
                      종료 일시
                      <input name="endAt" type="datetime-local" defaultValue={getDateTimeInputValue(survey.endAtRaw)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-xs font-bold text-[#092046]">
                      이벤트 혜택
                      <input name="eventPrize" defaultValue={survey.eventPrize === "해당 없음" ? "" : survey.eventPrize} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
                    </label>
                    <label className="grid gap-2 text-xs font-bold text-[#092046]">
                      추첨·발표 메모
                      <input name="drawNote" defaultValue={survey.drawNote === "추첨·발표 메모 없음" ? "" : survey.drawNote} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={submitState.target !== null} className="dd-btn dd-btn-primary dd-btn-sm">
                      수정 / 상태 변경
                    </button>
                    <button
                      type="button"
                      disabled={submitState.target !== null}
                      onClick={() => handleSurveyDelete(survey)}
                      className="dd-btn dd-btn-danger dd-btn-sm"
                    >
                      삭제
                    </button>
                  </div>
                </form>

                <div className="mt-4 space-y-3">
                  {survey.questions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm font-bold text-slate-600">
                      아직 문항이 없습니다.
                    </div>
                  ) : (
                    survey.questions.map((question, index) => (
                      <form
                        key={question.id}
                        onSubmit={(event) => handleQuestionUpdate(event, survey.id, question.id)}
                        className="rounded-lg border border-slate-200 bg-white p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]">
                            문항 {index + 1}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            {question.type}
                          </span>
                          {question.isRequired ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">필수</span> : null}
                        </div>
                        <div className="grid gap-3 md:grid-cols-[96px_minmax(0,1fr)_160px]">
                          <label className="grid gap-2 text-xs font-bold text-[#092046]">
                            순서
                            <input name="order" type="number" min="1" defaultValue={question.order} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
                          </label>
                          <label className="grid gap-2 text-xs font-bold text-[#092046]">
                            문항
                            <input name="title" required defaultValue={question.title} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
                          </label>
                          <label className="grid gap-2 text-xs font-bold text-[#092046]">
                            형식
                            <select name="type" defaultValue={question.typeCode} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                              <option value="single_choice">단일 선택</option>
                              <option value="multiple_choice">복수 선택</option>
                              <option value="short_text">단답형</option>
                              <option value="long_text">서술형</option>
                              <option value="scale">척도형</option>
                            </select>
                          </label>
                        </div>
                        <label className="mt-3 grid gap-2 text-xs font-bold text-[#092046]">
                          선택지
                          <textarea name="options" rows={4} defaultValue={getQuestionOptionsText(question)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold leading-6" />
                        </label>
                        <label className="mt-3 flex items-center gap-3 rounded-lg bg-[#f8fbff] px-3 py-2 text-xs font-bold text-[#092046]">
                          <input name="isRequired" type="checkbox" defaultChecked={question.isRequired} className="h-4 w-4 accent-[#092046]" />
                          필수 응답 문항
                        </label>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="submit" disabled={submitState.target !== null} className="dd-btn dd-btn-primary dd-btn-sm">
                            문항 수정
                          </button>
                          <button type="button" disabled={submitState.target !== null || index === 0} onClick={() => handleQuestionMove(survey.id, question, "up")} className="dd-btn dd-btn-secondary dd-btn-sm">
                            위로
                          </button>
                          <button type="button" disabled={submitState.target !== null || index === survey.questions.length - 1} onClick={() => handleQuestionMove(survey.id, question, "down")} className="dd-btn dd-btn-secondary dd-btn-sm">
                            아래로
                          </button>
                          <button type="button" disabled={submitState.target !== null} onClick={() => handleQuestionDelete(survey.id, question)} className="dd-btn dd-btn-danger dd-btn-sm">
                            삭제
                          </button>
                        </div>
                      </form>
                    ))
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
