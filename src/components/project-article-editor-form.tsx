"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import type { ProjectContentArticle, ProjectPageImage } from "@/lib/newsletter-repository";

type ProjectArticleEditorFormProps = {
  projectSlug: string;
  pages: ProjectPageImage[];
  article: ProjectContentArticle | null;
};

type EditorSection = {
  id: string;
  title: string;
  body: string;
};

const articleStatuses = [
  { value: "draft", label: "작성 중" },
  { value: "review", label: "검수 요청" },
  { value: "needs_revision", label: "수정 필요" },
  { value: "approved", label: "검수 완료" },
  { value: "published", label: "발행 반영" },
];

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-black text-[#092046]">
      {children}
      {required ? <span className="text-[#c2410c]"> *</span> : null}
    </label>
  );
}

function getValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function makeInitialSections(article: ProjectContentArticle | null): EditorSection[] {
  const paragraphBlocks =
    article?.blocks
      .filter((block) => block.type === "paragraph")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((block, index) => ({
        id: block.id || `section-${index + 1}`,
        title: block.title === "본문" ? "" : block.title,
        body: block.body,
      })) ?? [];

  if (paragraphBlocks.length > 0) {
    return paragraphBlocks;
  }

  if (article?.body) {
    return [{ id: "section-1", title: "", body: article.body }];
  }

  return [{ id: "section-1", title: "", body: "" }];
}

export function ProjectArticleEditorForm({ projectSlug, pages, article }: ProjectArticleEditorFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [sections, setSections] = useState<EditorSection[]>(() => makeInitialSections(article));
  const buttonLink = useMemo(
    () => article?.links.find((link) => link.displayStyle === "button") ?? null,
    [article],
  );
  const videoLink = useMemo(() => article?.links.find((link) => link.actionType === "video") ?? null, [article]);
  const mapLink = useMemo(() => article?.links.find((link) => link.actionType === "map") ?? null, [article]);
  const audioScript = useMemo(
    () => article?.blocks.find((block) => block.type === "audio")?.body ?? "",
    [article],
  );

  function updateSection(sectionId: string, field: "title" | "body", value: string) {
    setSections((currentSections) =>
      currentSections.map((section) => (section.id === sectionId ? { ...section, [field]: value } : section)),
    );
  }

  function addSection() {
    setSections((currentSections) => [
      ...currentSections,
      { id: `section-${Date.now()}`, title: "", body: "" },
    ]);
  }

  function removeSection(sectionId: string) {
    setSections((currentSections) =>
      currentSections.length === 1 ? currentSections : currentSections.filter((section) => section.id !== sectionId),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const contentSections = sections
      .map((section, index) => ({
        title: section.title.trim(),
        body: section.body.trim(),
        sortOrder: (index + 1) * 10,
      }))
      .filter((section) => section.title || section.body);
    const body = contentSections
      .map((section) => [section.title, section.body].filter(Boolean).join("\n"))
      .join("\n\n");
    const payload = {
      projectSlug,
      articleId: article?.id ?? "",
      pageId: getValue(formData, "pageId"),
      sortOrder: Number(getValue(formData, "sortOrder")) || 0,
      title: getValue(formData, "title"),
      summary: getValue(formData, "summary"),
      body,
      contentSections,
      contactName: getValue(formData, "contactName"),
      contactPhone: getValue(formData, "contactPhone"),
      status: getValue(formData, "status"),
      buttonLabel: getValue(formData, "buttonLabel"),
      buttonTarget: getValue(formData, "buttonTarget"),
      videoLabel: getValue(formData, "videoLabel"),
      videoUrl: getValue(formData, "videoUrl"),
      mapLabel: getValue(formData, "mapLabel"),
      mapUrl: getValue(formData, "mapUrl"),
      audioScript: getValue(formData, "audioScript"),
    };

    if (!payload.title) {
      setIsSaving(false);
      setError("기사 제목은 반드시 입력해야 합니다.");
      return;
    }

    const response = await fetch("/api/project-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as
      | { ok: true; article: { id: string; title: string } }
      | { ok: false; message?: string }
      | null;

    setIsSaving(false);

    if (!response.ok || !result || result.ok !== true) {
      setError(result && result.ok === false ? result.message || "기사 저장에 실패했습니다." : "기사 저장에 실패했습니다.");
      return;
    }

    setMessage("기사와 연결 블록을 Supabase에 저장했습니다.");
    router.push(`/projects/${projectSlug}/reading?articleId=${result.article.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">작업 입력 영역</p>
            <h3 className="mt-1 text-lg font-black text-[#092046]">
              {article ? "선택 기사 수정" : "새 기사 작성"}
            </h3>
          </div>
          <StatusPill value={article ? "DB 저장됨" : "신규 작성"} />
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
          <div>
            <FieldLabel>순서</FieldLabel>
            <input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue={article?.sortOrder ?? 0}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            />
          </div>
          <div>
            <FieldLabel>연결 원본 페이지</FieldLabel>
            <select
              name="pageId"
              defaultValue={article?.pageId ?? ""}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            >
              <option value="">페이지 미지정</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.pageNumber}쪽 · {page.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_180px]">
          <div>
            <FieldLabel required>기사 제목</FieldLabel>
            <input
              name="title"
              defaultValue={article?.title ?? ""}
              placeholder="예: 군정 주요 소식"
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            />
          </div>
          <div>
            <FieldLabel>상태</FieldLabel>
            <select
              name="status"
              defaultValue={article?.status ?? "draft"}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            >
              {articleStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5">
          <FieldLabel>요약 문장</FieldLabel>
          <textarea
            name="summary"
            defaultValue={article?.summary ?? ""}
            placeholder="목록 카드와 모바일 첫 화면에 표시할 핵심 요약을 입력합니다."
            className="min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
          />
        </div>

        <div className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <FieldLabel>본문 섹션</FieldLabel>
              <p className="text-xs font-semibold leading-5 text-slate-500">
                모바일 화면에서 나눠 보일 소제목과 본문 단락을 입력합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={addSection}
              className="rounded-lg border border-[#2f73b7] bg-white px-4 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
            >
              + 섹션 추가
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {sections.map((section, index) => (
              <div key={section.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-[#184a88]">본문 섹션 {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeSection(section.id)}
                    disabled={sections.length === 1}
                    className="rounded-md border border-rose-200 px-3 py-1 text-xs font-black text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                  >
                    삭제
                  </button>
                </div>
                <input
                  value={section.title}
                  onChange={(event) => updateSection(section.id, "title", event.target.value)}
                  placeholder="소제목 예: 주요 일정, 신청 방법, 문의 안내"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                />
                <textarea
                  value={section.body}
                  onChange={(event) => updateSection(section.id, "body", event.target.value)}
                  placeholder="모바일 독자가 읽기 쉽게 짧은 문단 중심으로 입력합니다."
                  className="mt-3 min-h-40 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">연결 블록</p>
        <h3 className="mt-1 text-lg font-black text-[#092046]">버튼·영상·지도·음성 대본</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          비워 둔 항목은 저장하지 않습니다. 입력한 항목만 모바일 화면의 콘텐츠 블록으로 생성됩니다.
        </p>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
            <FieldLabel>행동 버튼</FieldLabel>
            <div className="grid gap-3">
              <input
                name="buttonLabel"
                defaultValue={buttonLink?.label ?? ""}
                placeholder="버튼명 예: 신청하기, 전화 연결"
                className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
              <input
                name="buttonTarget"
                defaultValue={buttonLink?.targetValue ?? ""}
                placeholder="URL 또는 전화번호"
                className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
            <FieldLabel>동영상 카드</FieldLabel>
            <div className="grid gap-3">
              <input
                name="videoLabel"
                defaultValue={videoLink?.label ?? ""}
                placeholder="영상 카드 제목"
                className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
              <input
                name="videoUrl"
                defaultValue={videoLink?.targetValue ?? ""}
                placeholder="YouTube, Vimeo 등 영상 URL"
                className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
            <FieldLabel>지도 카드</FieldLabel>
            <div className="grid gap-3">
              <input
                name="mapLabel"
                defaultValue={mapLink?.label ?? ""}
                placeholder="지도 카드 제목"
                className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
              <input
                name="mapUrl"
                defaultValue={mapLink?.targetValue ?? ""}
                placeholder="카카오·네이버·구글 지도 URL"
                className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
            <FieldLabel>연락처</FieldLabel>
            <div className="grid gap-3">
              <input
                name="contactName"
                defaultValue={article?.contactName ?? ""}
                placeholder="담당 부서 또는 담당자"
                className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
              <input
                name="contactPhone"
                defaultValue={article?.contactPhone ?? ""}
                placeholder="전화번호"
                className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <FieldLabel>음성 대본</FieldLabel>
          <textarea
            name="audioScript"
            defaultValue={audioScript}
            placeholder="MP3 제작 또는 검수에 사용할 대본을 입력합니다."
            className="min-h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectSlug}/reading`)}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          새 기사 입력
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-[#092046] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "저장 중..." : article ? "기사 수정 저장" : "기사 신규 저장"}
        </button>
      </div>
    </form>
  );
}
