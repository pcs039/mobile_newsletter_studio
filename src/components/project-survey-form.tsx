"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ProjectSurveyItem } from "@/lib/newsletter-repository";

type ProjectSurveyFormProps = {
  projectSlug: string;
  surveys: ProjectSurveyItem[];
};

type SubmitState = {
  target: "survey" | "question" | null;
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

export function ProjectSurveyForm({ projectSlug, surveys }: ProjectSurveyFormProps) {
  const router = useRouter();
  const [submitState, setSubmitState] = useState<SubmitState>({ target: null, message: "", isError: false });
  const [questionType, setQuestionType] = useState<QuestionType>("single_choice");

  async function submitPayload(target: SubmitState["target"], payload: Record<string, string | boolean | number>) {
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

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <form onSubmit={handleSurveySubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">운영 항목</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">설문·이벤트 만들기</h3>
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
          {submitState.target === "survey" ? "저장 중" : "설문·이벤트 저장"}
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
    </div>
  );
}
