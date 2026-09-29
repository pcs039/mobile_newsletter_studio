"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toIsoFromDatetimeLocal } from "@/lib/datetime-local";
import type { ArticlePublicInfoType, ArticleUrgency } from "@/lib/newsletter-repository";

type ProjectQuickPostFormProps = {
  isProjectPublished: boolean;
  projectSlug: string;
};

const articleTypeOptions: Array<{ value: ArticlePublicInfoType; label: string }> = [
  { value: "general", label: "일반형" },
  { value: "welfare_health", label: "복지·건강형" },
  { value: "application_recruitment", label: "신청·모집형" },
  { value: "event_festival", label: "축제·행사형" },
  { value: "tourism_place", label: "관광·장소형" },
  { value: "life_civil", label: "생활·민원형" },
  { value: "government_major", label: "시정·군정 주요소식형" },
  { value: "local_news", label: "읍면동·지역소식형" },
  { value: "emergency", label: "긴급·안전형" },
];

const urgencyOptions: Array<{ value: ArticleUrgency; label: string }> = [
  { value: "normal", label: "일반" },
  { value: "time_sensitive", label: "시한성 정보" },
  { value: "urgent", label: "긴급" },
];

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-sm font-black text-[#092046]">{children}</label>;
}

export function ProjectQuickPostForm({ isProjectPublished, projectSlug }: ProjectQuickPostFormProps) {
  const router = useRouter();
  const [urgency, setUrgency] = useState<ArticleUrgency>("normal");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = submitter?.value === "published" ? "published" : "draft";
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const validUntil = toIsoFromDatetimeLocal(String(formData.get("validUntil") ?? ""));

    if (!title) {
      setError("기사 제목을 입력해 주세요.");
      return;
    }

    if ((urgency === "urgent" || urgency === "time_sensitive") && !validUntil) {
      setError("긴급 또는 시한성 소식은 노출 종료 일시를 입력해야 합니다.");
      return;
    }

    const validFromInput = String(formData.get("validFrom") ?? "");
    const validFrom = toIsoFromDatetimeLocal(validFromInput) || (status === "published" ? new Date().toISOString() : "");

    setIsSaving(true);
    setError("");
    setMessage(status === "published" ? "수시 소식을 게시하는 중입니다." : "임시 저장하는 중입니다.");

    const response = await fetch("/api/project-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectSlug,
        title,
        summary: String(formData.get("summary") ?? "").trim(),
        body: String(formData.get("body") ?? "").trim(),
        articleType: String(formData.get("articleType") ?? "general"),
        publicationKind: "rolling",
        urgency,
        institutionPriority: urgency === "urgent" ? 5 : 4,
        validFrom,
        validUntil,
        contactName: String(formData.get("contactName") ?? "").trim(),
        contactPhone: String(formData.get("contactPhone") ?? "").trim(),
        buttonLabel: String(formData.get("buttonLabel") ?? "").trim(),
        buttonTarget: String(formData.get("buttonTarget") ?? "").trim(),
        status,
      }),
    });
    const result = (await response.json().catch(() => null)) as
      | { ok: true; article: { id: string } }
      | { ok: false; message?: string }
      | null;

    setIsSaving(false);

    if (!response.ok || !result || result.ok !== true) {
      setMessage("");
      setError(result && result.ok === false ? result.message || "수시 소식을 저장하지 못했습니다." : "수시 소식을 저장하지 못했습니다.");
      return;
    }

    router.push(`/projects/${projectSlug}/reading?articleId=${result.article.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!isProjectPublished ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
          현재 프로젝트가 아직 발행 전이므로 기사를 즉시 게시해도 외부 공개는 프로젝트 발행 후 시작됩니다.
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="border-b border-slate-200 pb-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">빠른 작성</p>
          <h2 className="mt-1 text-xl font-black text-[#092046]">수시·긴급 소식</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">정기호 사이에 발생한 수시·긴급 정보를 빠르게 게시합니다.</p>
        </div>

        <div className="mt-5 grid gap-5">
          <div>
            <FieldLabel>기사 제목 <span className="text-rose-600">필수</span></FieldLabel>
            <input name="title" required className="h-12 w-full rounded-lg border border-slate-300 px-4 text-base font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" />
          </div>
          <div>
            <FieldLabel>한 줄 요약</FieldLabel>
            <textarea name="summary" rows={3} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" />
          </div>
          <div>
            <FieldLabel>본문</FieldLabel>
            <textarea name="body" rows={8} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm leading-7 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-[#092046]">노출 설정</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>기사 유형</FieldLabel>
            <select name="articleType" defaultValue="general" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">
              {articleTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>긴급도</FieldLabel>
            <select name="urgency" value={urgency} onChange={(event) => setUrgency(event.currentTarget.value as ArticleUrgency)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">
              {urgencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>노출 시작</FieldLabel>
            <input name="validFrom" type="datetime-local" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold" />
            <p className="mt-1 text-xs text-slate-500">즉시 게시 시 비워두면 현재 시각으로 설정됩니다.</p>
          </div>
          <div>
            <FieldLabel>노출 종료 {(urgency === "urgent" || urgency === "time_sensitive") ? <span className="text-rose-600">필수</span> : null}</FieldLabel>
            <input name="validUntil" type="datetime-local" required={urgency === "urgent" || urgency === "time_sensitive"} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold" />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-[#092046]">문의 및 행동 버튼</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div><FieldLabel>담당 부서·담당자</FieldLabel><input name="contactName" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></div>
          <div><FieldLabel>문의 전화</FieldLabel><input name="contactPhone" inputMode="tel" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></div>
          <div><FieldLabel>버튼 문구</FieldLabel><input name="buttonLabel" placeholder="신청하기" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></div>
          <div><FieldLabel>버튼 연결 주소</FieldLabel><input name="buttonTarget" placeholder="https://... 또는 전화번호" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></div>
        </div>
      </section>

      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-lg bg-[#eef6ff] px-4 py-3 text-sm font-bold text-[#184a88]">{message}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="submit" name="intent" value="draft" disabled={isSaving} className="dd-btn dd-btn-secondary disabled:opacity-50">임시 저장</button>
        <button type="submit" name="intent" value="published" disabled={isSaving} className="dd-btn dd-btn-primary disabled:opacity-50">{isSaving ? "저장 중..." : "즉시 게시"}</button>
      </div>
    </form>
  );
}
