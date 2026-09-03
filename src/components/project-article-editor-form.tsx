"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import type { ProjectContentArticle, ProjectContentBlock, ProjectPageImage } from "@/lib/newsletter-repository";

type ProjectArticleEditorFormProps = {
  projectSlug: string;
  pages: ProjectPageImage[];
  projectPageCount?: number;
  article: ProjectContentArticle | null;
};

type EditorBlockType = Extract<
  ProjectContentBlock["type"],
  "paragraph" | "image" | "video_link" | "map_link" | "button_group" | "audio"
>;

type EditorBlock = {
  id: string;
  type: EditorBlockType;
  title: string;
  body: string;
};

type ImportedWordResponse =
  | {
      ok: true;
      imported: {
        title: string;
        summary: string;
        blocks: Array<{
          type: "paragraph" | "video_link" | "button_group";
          title: string;
          body: string;
          sortOrder: number;
        }>;
      };
    }
  | {
      ok: false;
      message?: string;
    };

const articleStatuses = [
  { value: "draft", label: "작성 중" },
  { value: "review", label: "검수 요청" },
  { value: "needs_revision", label: "수정 필요" },
  { value: "approved", label: "검수 완료" },
  { value: "published", label: "발행 반영" },
];

const editableBlockTypes: Array<{ type: EditorBlockType; label: string; help: string }> = [
  { type: "paragraph", label: "문단", help: "기사 본문 텍스트" },
  { type: "image", label: "이미지", help: "사진 URL과 캡션" },
  { type: "video_link", label: "유튜브", help: "영상 주소 삽입" },
  { type: "map_link", label: "지도", help: "위치 링크 삽입" },
  { type: "button_group", label: "URL 버튼", help: "신청·문의 바로가기" },
  { type: "audio", label: "음성 대본", help: "낭독용 원고" },
];

const blockTypeLabels: Record<EditorBlockType, string> = {
  paragraph: "문단",
  image: "이미지",
  video_link: "유튜브",
  map_link: "지도",
  button_group: "URL 버튼",
  audio: "음성 대본",
};

const standardArticleTemplate: EditorBlock[] = [
  {
    id: "template-paragraph-1",
    type: "paragraph",
    title: "핵심 내용",
    body: "모바일 독자가 먼저 알아야 할 핵심 내용을 2~4문장으로 입력합니다.",
  },
  {
    id: "template-image-1",
    type: "image",
    title: "관련 사진 설명",
    body: "https://... 이미지 공개 URL",
  },
  {
    id: "template-paragraph-2",
    type: "paragraph",
    title: "상세 안내",
    body: "사진 아래에 이어질 설명 문단을 입력합니다. 날짜, 장소, 대상, 신청 방법처럼 구체 정보를 넣습니다.",
  },
  {
    id: "template-button-1",
    type: "button_group",
    title: "자세히 보기",
    body: "https://... 연결할 페이지 URL",
  },
];

const blockUseCases: Array<{ title: string; description: string }> = [
  { title: "텍스트 사이 사진", description: "문단 → 이미지 → 문단 순서로 블록을 배치합니다." },
  { title: "신청 링크", description: "URL 버튼 블록에 버튼명과 연결 주소를 입력합니다." },
  { title: "유튜브 영상", description: "유튜브 블록에 영상 제목과 YouTube URL을 입력합니다." },
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

function makeBlockId(type: string) {
  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeTemplateBlock(block: EditorBlock, index: number): EditorBlock {
  return {
    ...block,
    id: makeBlockId(`${block.type}-${index}`),
  };
}

function isEditableBlockType(type: ProjectContentBlock["type"]): type is EditorBlockType {
  return editableBlockTypes.some((item) => item.type === type);
}

function makeInitialBlocks(article: ProjectContentArticle | null): EditorBlock[] {
  const blocks =
    article?.blocks
      .filter((block) => isEditableBlockType(block.type) && block.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((block, index) => {
        const link = block.linkActionId ? article.links.find((item) => item.id === block.linkActionId) : null;

        return {
          id: block.id || `${block.type}-${index + 1}`,
          type: block.type as EditorBlockType,
          title: block.type === "paragraph" && block.title === "본문" ? "" : block.title || link?.label || "",
          body: block.body || link?.targetValue || "",
        };
      }) ?? [];

  if (blocks.length > 0) {
    return blocks;
  }

  const fallbackBlocks: EditorBlock[] = [];

  if (article?.body) {
    fallbackBlocks.push({ id: "paragraph-1", type: "paragraph", title: "", body: article.body });
  }

  const videoLink = article?.links.find((link) => link.actionType === "video");
  const mapLink = article?.links.find((link) => link.actionType === "map");
  const buttonLink = article?.links.find((link) => link.displayStyle === "button");

  if (videoLink) {
    fallbackBlocks.push({ id: "video-1", type: "video_link", title: videoLink.label, body: videoLink.targetValue });
  }

  if (mapLink) {
    fallbackBlocks.push({ id: "map-1", type: "map_link", title: mapLink.label, body: mapLink.targetValue });
  }

  if (buttonLink) {
    fallbackBlocks.push({ id: "button-1", type: "button_group", title: buttonLink.label, body: buttonLink.targetValue });
  }

  const audioScript = article?.blocks.find((block) => block.type === "audio")?.body;

  if (audioScript) {
    fallbackBlocks.push({ id: "audio-1", type: "audio", title: "음성 대본", body: audioScript });
  }

  return fallbackBlocks.length > 0 ? fallbackBlocks : [{ id: "paragraph-1", type: "paragraph", title: "", body: "" }];
}

function getBlockTitleLabel(type: EditorBlockType) {
  switch (type) {
    case "paragraph":
      return "소제목";
    case "image":
      return "이미지 캡션";
    case "video_link":
      return "영상 제목";
    case "map_link":
      return "지도 제목";
    case "button_group":
      return "버튼에 표시할 문구";
    case "audio":
      return "대본 제목";
    default:
      return "제목";
  }
}

function getBlockBodyLabel(type: EditorBlockType) {
  switch (type) {
    case "paragraph":
      return "본문";
    case "image":
      return "이미지 URL";
    case "video_link":
      return "YouTube URL";
    case "map_link":
      return "지도 URL";
    case "button_group":
      return "연결 URL 또는 전화번호";
    case "audio":
      return "음성 대본";
    default:
      return "내용";
  }
}

function getBlockBodyPlaceholder(type: EditorBlockType) {
  switch (type) {
    case "paragraph":
      return "모바일 독자가 읽기 쉽게 2~5문장 단위로 입력합니다.";
    case "image":
      return "https://... 또는 Supabase Storage 이미지 공개 URL";
    case "video_link":
      return "https://www.youtube.com/watch?v=...";
    case "map_link":
      return "카카오·네이버·구글 지도 URL";
    case "button_group":
      return "https://... 또는 061-000-0000";
    case "audio":
      return "MP3 제작 또는 검수에 사용할 대본을 입력합니다.";
    default:
      return "";
  }
}

function getBlockGuide(type: EditorBlockType) {
  switch (type) {
    case "paragraph":
      return "워드의 본문 문단에 해당합니다. 문단을 여러 개로 나누면 모바일에서 훨씬 읽기 쉽습니다.";
    case "image":
      return "이미지는 공개 접근 가능한 URL을 입력해야 합니다. 파일 업로드 이미지는 소재 보관함에서 공개 URL을 확인해 연결합니다.";
    case "video_link":
      return "유튜브 주소를 입력하면 공개 화면에서 영상 영역으로 표시됩니다. 예: https://www.youtube.com/watch?v=...";
    case "map_link":
      return "카카오맵, 네이버지도, 구글지도 공유 주소를 입력하면 위치 확인 카드로 표시됩니다.";
    case "button_group":
      return "신청하기, 자세히 보기, 문의하기처럼 독자가 눌러야 하는 링크를 버튼으로 표시합니다.";
    case "audio":
      return "음성 파일 제작이나 낭독 검수에 사용할 원고입니다. 공개 화면에서는 접어서 볼 수 있는 대본으로 표시됩니다.";
    default:
      return "모바일 화면에 표시할 내용을 입력합니다.";
  }
}

function getBlockPreviewText(block: EditorBlock) {
  if (block.type === "paragraph") {
    return block.body || "본문 문단이 여기에 표시됩니다.";
  }

  if (block.type === "image") {
    return block.body || "이미지 URL 입력 전";
  }

  if (block.type === "video_link") {
    return block.body || "유튜브 URL 입력 전";
  }

  if (block.type === "map_link") {
    return block.body || "지도 URL 입력 전";
  }

  if (block.type === "button_group") {
    return block.body || "연결 URL 입력 전";
  }

  return block.body || "음성 대본 입력 전";
}

function shouldUseTextarea(type: EditorBlockType) {
  return type === "paragraph" || type === "audio";
}

export function ProjectArticleEditorForm({
  projectSlug,
  pages,
  projectPageCount = 0,
  article,
}: ProjectArticleEditorFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingWord, setIsImportingWord] = useState(false);
  const [wordImportMessage, setWordImportMessage] = useState("");
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => makeInitialBlocks(article));
  const blockSummary = useMemo(
    () =>
      blocks
        .map((block, index) => `${index + 1}. ${blockTypeLabels[block.type]}`)
        .join(" / "),
    [blocks],
  );

  function updateBlock(blockId: string, field: "title" | "body", value: string) {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => (block.id === blockId ? { ...block, [field]: value } : block)),
    );
  }

  function addBlock(type: EditorBlockType) {
    setBlocks((currentBlocks) => [
      ...currentBlocks,
      {
        id: makeBlockId(type),
        type,
        title: type === "audio" ? "음성 대본" : "",
        body: "",
      },
    ]);
  }

  function loadStandardTemplate() {
    const hasTypedContent = blocks.some((block) => block.title.trim() || block.body.trim());

    if (hasTypedContent && !window.confirm("현재 입력 중인 블록을 표준 기사 구성으로 바꿀까요?")) {
      return;
    }

    setBlocks(standardArticleTemplate.map(makeTemplateBlock));
  }

  function getFormFieldValue(name: string) {
    const field = formRef.current?.elements.namedItem(name);

    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      return field.value.trim();
    }

    return "";
  }

  function setFormFieldValue(name: string, value: string) {
    const field = formRef.current?.elements.namedItem(name);

    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = value;
    }
  }

  async function handleWordImport(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError(".docx 형식의 Word 파일만 가져올 수 있습니다.");
      return;
    }

    const hasTypedContent =
      getFormFieldValue("title") ||
      getFormFieldValue("summary") ||
      blocks.some((block) => block.title.trim() || block.body.trim());

    if (hasTypedContent && !window.confirm("현재 입력 중인 제목·요약·블록을 Word 원고 내용으로 바꿀까요?")) {
      return;
    }

    setError("");
    setMessage("");
    setWordImportMessage("");
    setIsImportingWord(true);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/project-content/import-word", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as ImportedWordResponse | null;

    setIsImportingWord(false);

    if (!response.ok || !result || result.ok !== true) {
      setError(result && result.ok === false ? result.message || "Word 원고를 가져오지 못했습니다." : "Word 원고를 가져오지 못했습니다.");
      return;
    }

    setFormFieldValue("title", result.imported.title);
    setFormFieldValue("summary", result.imported.summary);
    setBlocks(
      result.imported.blocks.map((block, index) => ({
        id: makeBlockId(`word-${block.type}-${index}`),
        type: block.type,
        title: block.title,
        body: block.body,
      })),
    );
    setWordImportMessage("Word 원고를 모바일 기사 블록으로 가져왔습니다. 이미지와 추가 링크는 필요한 위치에 블록으로 보완하세요.");
  }

  function removeBlock(blockId: string) {
    setBlocks((currentBlocks) =>
      currentBlocks.length === 1 ? currentBlocks : currentBlocks.filter((block) => block.id !== blockId),
    );
  }

  function moveBlock(blockId: string, direction: "up" | "down") {
    setBlocks((currentBlocks) => {
      const index = currentBlocks.findIndex((block) => block.id === blockId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;

      if (index < 0 || nextIndex < 0 || nextIndex >= currentBlocks.length) {
        return currentBlocks;
      }

      const nextBlocks = [...currentBlocks];
      const [target] = nextBlocks.splice(index, 1);
      nextBlocks.splice(nextIndex, 0, target);

      return nextBlocks;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const contentBlocks = blocks
      .map((block, index) => ({
        type: block.type,
        title: block.title.trim(),
        body: block.body.trim(),
        sortOrder: (index + 1) * 10,
      }))
      .filter((block) => block.title || block.body);
    const body = contentBlocks
      .filter((block) => block.type === "paragraph")
      .map((block) => [block.title, block.body].filter(Boolean).join("\n"))
      .join("\n\n");
    const payload = {
      projectSlug,
      articleId: article?.id ?? "",
      pageId: getValue(formData, "pageId"),
      sourcePageNumber: Number(getValue(formData, "sourcePageNumber")) || 0,
      sortOrder: Number(getValue(formData, "sortOrder")) || 0,
      title: getValue(formData, "title"),
      summary: getValue(formData, "summary"),
      body,
      contentBlocks,
      contactName: getValue(formData, "contactName"),
      contactPhone: getValue(formData, "contactPhone"),
      status: getValue(formData, "status"),
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

    setMessage("기사와 콘텐츠 블록을 Supabase에 저장했습니다.");
    router.push(`/projects/${projectSlug}/reading?articleId=${result.article.id}`);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
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

        <div className="mt-5 rounded-lg border border-[#b8d7ff] bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Word 원고 가져오기</p>
              <h4 className="mt-1 text-base font-black text-[#092046]">.docx 원고를 모바일 기사 블록으로 변환</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Word의 글꼴·크기·줄간격은 가져오지 않고, 제목과 문단 구조만 가져와 모바일 스타일로 정리합니다.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]">
              {isImportingWord ? "가져오는 중..." : "Word 원고 선택"}
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                disabled={isImportingWord}
                onChange={(event) => {
                  void handleWordImport(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          {wordImportMessage ? (
            <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-700">
              {wordImportMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[140px_minmax(0,1fr)_180px]">
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
            {pages.length === 0 ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                등록된 페이지 이미지가 없으면 오른쪽에 원본 PDF 쪽수를 직접 입력하세요.
              </p>
            ) : null}
          </div>
          <div>
            <FieldLabel>원본 PDF 쪽수 직접 입력</FieldLabel>
            <input
              name="sourcePageNumber"
              type="number"
              min="1"
              max={projectPageCount > 0 ? projectPageCount : undefined}
              defaultValue={article?.pageNumber ?? ""}
              placeholder={projectPageCount > 0 ? `1~${projectPageCount}` : "예: 3"}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            />
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
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">콘텐츠 블록</p>
            <h3 className="mt-1 text-lg font-black text-[#092046]">표준형 기사 블록 편집</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              블록 순서가 모바일 공개 화면의 표시 순서입니다. 텍스트 사이에 이미지, URL 버튼, 유튜브 영상을 필요한 위치에 끼워 넣습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadStandardTemplate}
              className="rounded-lg border border-[#2f73b7] bg-white px-4 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
            >
              표준 기사 구성 불러오기
            </button>
            <StatusPill value={blockSummary || "블록 없음"} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {blockUseCases.map((item) => (
            <div key={item.title} className="rounded-lg border border-[#d8e8ff] bg-[#f7fbff] px-4 py-3">
              <p className="text-sm font-black text-[#092046]">{item.title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {editableBlockTypes.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => addBlock(item.type)}
              className="rounded-lg border border-[#2f73b7] bg-white px-3 py-3 text-left transition hover:bg-[#eaf3ff]"
            >
              <span className="block text-sm font-black text-[#092046]">+ {item.label}</span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{item.help}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {blocks.map((block, index) => (
            <div key={block.id} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black text-[#184a88]">
                    {index + 1}번 블록 · {blockTypeLabels[block.type]}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{getBlockGuide(block.type)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, "up")}
                    disabled={index === 0}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    위로
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, "down")}
                    disabled={index === blocks.length - 1}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    아래로
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    disabled={blocks.length === 1}
                    className="rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)]">
                <div>
                  <FieldLabel>{getBlockTitleLabel(block.type)}</FieldLabel>
                  <input
                    value={block.title}
                    onChange={(event) => updateBlock(block.id, "title", event.target.value)}
                    placeholder={
                      block.type === "button_group" ? "예: 신청하기" : block.type === "paragraph" ? "소제목" : "표시 제목"
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <div>
                  <FieldLabel>{getBlockBodyLabel(block.type)}</FieldLabel>
                  {shouldUseTextarea(block.type) ? (
                    <textarea
                      value={block.body}
                      onChange={(event) => updateBlock(block.id, "body", event.target.value)}
                      placeholder={getBlockBodyPlaceholder(block.type)}
                      className="min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                    />
                  ) : (
                    <input
                      value={block.body}
                      onChange={(event) => updateBlock(block.id, "body", event.target.value)}
                      placeholder={getBlockBodyPlaceholder(block.type)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">저장 전 구성 확인</p>
              <h4 className="text-base font-black text-[#092046]">모바일 표시 순서</h4>
            </div>
            <p className="text-xs font-semibold text-slate-500">실제 공개 화면은 저장 후 모바일 미리보기에서 확인합니다.</p>
          </div>
          <div className="mt-4 space-y-2">
            {blocks.map((block, index) => (
              <div key={`preview-${block.id}`} className="rounded-lg bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#eaf2ff] px-2.5 py-1 text-xs font-black text-[#184a88]">
                    {index + 1}
                  </span>
                  <p className="text-sm font-black text-[#092046]">{blockTypeLabels[block.type]}</p>
                  {block.title ? <p className="text-sm font-bold text-slate-700">{block.title}</p> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{getBlockPreviewText(block)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">문의 정보</p>
        <h3 className="mt-1 text-lg font-black text-[#092046]">기사 공통 연락처</h3>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div>
            <FieldLabel>담당 부서 또는 담당자</FieldLabel>
            <input
              name="contactName"
              defaultValue={article?.contactName ?? ""}
              placeholder="예: 기획실 홍보팀"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            />
          </div>
          <div>
            <FieldLabel>전화번호</FieldLabel>
            <input
              name="contactPhone"
              defaultValue={article?.contactPhone ?? ""}
              placeholder="예: 061-000-0000"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            />
          </div>
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
