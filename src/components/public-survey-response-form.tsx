"use client";

import { FormEvent, useState } from "react";
import type { ProjectSurveyItem, ProjectSurveyQuestion } from "@/lib/newsletter-repository";

type PublicSurveyResponseFormProps = {
  projectSlug: string;
  survey: ProjectSurveyItem;
};

type SubmitState = {
  message: string;
  isError: boolean;
  isSaving: boolean;
  isDone: boolean;
};

function getAnswer(formData: FormData, question: ProjectSurveyQuestion) {
  if (question.typeCode === "multiple_choice") {
    return formData.getAll(question.id).map((value) => String(value).trim()).filter(Boolean);
  }

  return String(formData.get(question.id) ?? "").trim();
}

function QuestionInput({ question }: { question: ProjectSurveyQuestion }) {
  if (question.typeCode === "single_choice") {
    return (
      <div className="grid gap-2">
        {question.options.map((option) => (
          <label key={option} className="flex gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold leading-6 text-slate-700">
            <input name={question.id} type="radio" value={option} required={question.isRequired} className="mt-1 h-4 w-4 accent-[#092046]" />
            <span className="[word-break:keep-all]">{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.typeCode === "multiple_choice") {
    return (
      <div className="grid gap-2">
        {question.options.map((option) => (
          <label key={option} className="flex gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold leading-6 text-slate-700">
            <input name={question.id} type="checkbox" value={option} className="mt-1 h-4 w-4 accent-[#092046]" />
            <span className="[word-break:keep-all]">{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.typeCode === "scale") {
    return (
      <div className="grid grid-cols-5 gap-2">
        {["1", "2", "3", "4", "5"].map((value) => (
          <label key={value} className="grid place-items-center rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm font-black text-slate-700">
            <input name={question.id} type="radio" value={value} required={question.isRequired} className="h-4 w-4 accent-[#092046]" />
            <span className="mt-2">{value}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.typeCode === "long_text") {
    return (
      <textarea
        name={question.id}
        required={question.isRequired}
        rows={5}
        placeholder="의견을 입력해 주세요."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base leading-7 text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
      />
    );
  }

  return (
    <input
      name={question.id}
      required={question.isRequired}
      placeholder="답변을 입력해 주세요."
      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
    />
  );
}

export function PublicSurveyResponseForm({ projectSlug, survey }: PublicSurveyResponseFormProps) {
  const [state, setState] = useState<SubmitState>({ message: "", isError: false, isSaving: false, isDone: false });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const answers = Object.fromEntries(survey.questions.map((question) => [question.id, getAnswer(formData, question)]));

    setState({ message: "", isError: false, isSaving: true, isDone: false });

    const response = await fetch("/api/newsletter-survey-responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectSlug,
        surveyId: survey.id,
        answers,
      }),
    }).catch(() => null);

    if (!response) {
      setState({ message: "응답을 보내지 못했습니다. 네트워크 상태를 확인해 주세요.", isError: true, isSaving: false, isDone: false });
      return;
    }

    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setState({ message: result?.message ?? "응답 저장에 실패했습니다.", isError: true, isSaving: false, isDone: false });
      return;
    }

    form.reset();
    setState({ message: result.message ?? "응답을 저장했습니다.", isError: false, isSaving: false, isDone: true });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {survey.questions.map((question) => (
        <section key={question.id} className="rounded-2xl border border-slate-200 bg-[#f8fbff] px-4 py-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#184a88]">문항 {question.order}</p>
              <h2 className="mt-1 text-base font-black leading-7 text-[#092046] [word-break:keep-all]">{question.title}</h2>
            </div>
            {question.isRequired ? (
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-[#184a88]">필수</span>
            ) : null}
          </div>
          <QuestionInput question={question} />
        </section>
      ))}

      <button
        type="submit"
        disabled={state.isSaving || state.isDone}
        className="w-full rounded-xl bg-[#092046] px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {state.isSaving ? "제출 중" : state.isDone ? "제출 완료" : "응답 제출"}
      </button>

      {state.message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-bold leading-6 ${
            state.isError ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
