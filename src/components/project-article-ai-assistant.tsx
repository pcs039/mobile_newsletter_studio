"use client";

import { useRef, useState } from "react";
import type { ArticleAiDraft, ArticleAiDraftResponse } from "@/lib/article-ai-draft-types";
import type { ArticleSourceImportResponse, ArticleSourceKind } from "@/lib/article-source-import-types";
import { getArticlePublicInfoEntries } from "@/lib/article-public-info-fields";
import type { ImportedWordArticle } from "@/lib/word-document-import";

const articleTypeLabels: Record<string, string> = {
  general: "일반형",
  welfare_health: "복지·건강형",
  application_recruitment: "신청·모집형",
  event_festival: "축제·행사형",
  tourism_place: "관광·장소형",
  life_civil: "생활·민원형",
  government_major: "시정·군정 주요소식형",
  local_news: "읍면동·지역소식형",
  emergency: "긴급·안전형",
};

const urgencyLabels: Record<string, string> = {
  normal: "일반",
  time_sensitive: "시한성 정보",
  urgent: "긴급 검토 필요",
};

const blockTypeLabels: Record<string, string> = {
  paragraph: "본문 문단",
  button_group: "행동 버튼",
  video_link: "영상 링크",
  map_link: "지도 링크",
};

type ProjectArticleAiAssistantProps = {
  getCurrentContent: () => string;
  onApplyDraft: (draft: ArticleAiDraft) => boolean;
  onApplyImportedWord: (article: ImportedWordArticle) => boolean;
};

type ImportedSourceFile = {
  fileName: string;
  fileSize: number;
  kind: ArticleSourceKind;
  originalCharCount: number;
  truncated: boolean;
  usedCharCount: number;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString("ko-KR")}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function ProjectArticleAiAssistant({
  getCurrentContent,
  onApplyDraft,
  onApplyImportedWord,
}: ProjectArticleAiAssistantProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState<ImportedSourceFile | null>(null);
  const [wordImportedArticle, setWordImportedArticle] = useState<ImportedWordArticle | null>(null);
  const [draft, setDraft] = useState<ArticleAiDraft | null>(null);
  const [isImportingSource, setIsImportingSource] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function loadCurrentContent() {
    const content = getCurrentContent().trim();

    if (!content) {
      setError("현재 입력된 기사 내용을 찾지 못했습니다.");
      return;
    }

    if (sourceText.trim() && !window.confirm("현재 원자료 입력 내용을 기사 폼의 내용으로 바꿀까요?")) {
      return;
    }

    setSourceText(content.slice(0, 30_000));
    setSourceFile(null);
    setWordImportedArticle(null);
    setDraft(null);
    setError("");
    setMessage("현재 기사 입력 내용을 원자료로 가져왔습니다.");
  }

  async function importSourceFile(file: File | undefined) {
    if (!file) return;

    if (sourceText.trim() && !window.confirm("현재 원자료 내용을 선택한 파일의 내용으로 바꿀까요?")) {
      return;
    }

    setError("");
    setMessage("");
    setDraft(null);
    setIsImportingSource(true);

    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/project-content/source-import", {
      method: "POST",
      body: formData,
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as ArticleSourceImportResponse | null)
      : null;

    setIsImportingSource(false);

    if (!response?.ok || !result || result.ok !== true) {
      setError(
        result && result.ok === false
          ? result.error === "PDF_TEXT_NOT_FOUND"
            ? `${result.message} 스캔 PDF는 현재 자동 문자 인식을 지원하지 않습니다. 텍스트형 PDF 또는 Word 파일을 사용하거나 원문을 직접 붙여넣어 주세요.`
            : result.message
          : "원자료 파일을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      return;
    }

    setSourceText(result.source.sourceText);
    setSourceFile({
      fileName: result.source.fileName,
      fileSize: file.size,
      kind: result.source.kind,
      originalCharCount: result.source.originalCharCount,
      truncated: result.source.truncated,
      usedCharCount: result.source.usedCharCount,
    });
    setWordImportedArticle(result.wordArticle ?? null);
    setMessage("파일에서 원문을 가져왔습니다. 내용을 확인하고 필요하면 수정하세요.");
  }

  async function generateDraft() {
    const source = sourceText.trim();

    if (!source) {
      setError("원자료를 먼저 입력해 주세요.");
      return;
    }

    setError("");
    setMessage("");
    setDraft(null);
    setIsGenerating(true);

    const response = await fetch("/api/project-content/ai-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceText: source }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as ArticleAiDraftResponse | null)
      : null;

    setIsGenerating(false);

    if (!response?.ok || !result || result.ok !== true) {
      setError(result && result.ok === false ? result.message : "AI 초안 생성에 실패했습니다.");
      return;
    }

    setDraft(result.draft);
    setMessage("AI 제안이 준비되었습니다. 원자료와 비교한 뒤 입력폼에 적용하세요.");
  }

  function applyDraft() {
    if (!draft || !onApplyDraft(draft)) return;

    setError("");
    setMessage("AI 제안을 입력폼에 반영했습니다. 원문과 비교해 사실관계를 확인한 뒤 저장하세요.");
  }

  function applyImportedWord() {
    if (!wordImportedArticle || !onApplyImportedWord(wordImportedArticle)) return;

    setError("");
    setMessage("Word 원고를 입력폼에 반영했습니다. 저장 버튼을 눌러야 DB에 저장됩니다.");
  }

  function clearSourceFile() {
    setSourceFile(null);
    setWordImportedArticle(null);
    setDraft(null);
    setMessage("파일 연결을 해제했습니다. 추출된 원문은 계속 편집할 수 있습니다.");
  }

  const publicInfoEntries = draft ? getArticlePublicInfoEntries(draft.publicInfo, draft.articleType) : [];

  return (
    <details className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block text-xs font-black uppercase tracking-wide text-[#184a88]">AI 작성 도우미</span>
          <span className="mt-1 block text-base font-black text-[#092046]">원자료를 모바일 기사 초안으로 정리</span>
        </span>
        <span className="self-start rounded-full bg-[#092046] px-3 py-1 text-xs font-black text-white">열기</span>
      </summary>

      <div className="mt-5 space-y-4 border-t border-[#d8e8ff] pt-5">
        <section className="rounded-lg border border-[#d8e8ff] bg-white p-4" aria-labelledby="article-source-import-heading">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">1. 원자료 가져오기</p>
          <h3 id="article-source-import-heading" className="mt-1 text-base font-black text-[#092046]">PDF 또는 Word 원고 선택</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImportingSource || isGenerating}
              className="dd-btn dd-btn-secondary dd-btn-sm"
            >
              {isImportingSource ? "원문을 가져오는 중..." : "PDF / Word 파일 선택"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              disabled={isImportingSource || isGenerating}
              onChange={(event) => {
                void importSourceFile(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <span className="text-xs font-semibold text-slate-500">PDF 최대 15MB · Word(.docx) 최대 8MB</span>
          </div>

          {sourceFile ? (
            <div className="mt-3 flex min-w-0 flex-col gap-3 rounded-lg bg-[#f7fbff] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#092046]" title={sourceFile.fileName}>{sourceFile.fileName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {sourceFile.kind === "pdf" ? "PDF" : "Word"} · {formatFileSize(sourceFile.fileSize)} · {sourceFile.originalCharCount.toLocaleString("ko-KR")}자 추출
                </p>
              </div>
              <button type="button" onClick={clearSourceFile} className="dd-btn dd-btn-secondary dd-btn-sm self-start">파일 해제</button>
            </div>
          ) : null}

          {sourceFile?.truncated ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-bold leading-5 text-amber-900">
              문서에서 {sourceFile.originalCharCount.toLocaleString("ko-KR")}자를 추출했습니다. 현재 AI 초안에는 최대 {sourceFile.usedCharCount.toLocaleString("ko-KR")}자까지 사용됩니다. 중요한 내용이 뒤쪽에 있다면 원문을 직접 줄여 주세요.
            </p>
          ) : null}
        </section>

        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">2. 원문 확인</p>
          <label htmlFor="article-ai-source" className="mt-1 block text-sm font-black text-[#092046]">추출된 원문 또는 직접 입력</label>
          <textarea
            id="article-ai-source"
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value.slice(0, 30_000));
              setDraft(null);
              setError("");
              setMessage("");
            }}
            maxLength={30_000}
            rows={9}
            placeholder="파일을 선택하거나 보도자료, 공지문, 사업안내, 행사 안내문 등 원문을 붙여넣으세요."
            className="mt-2 min-h-48 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
          />
          <div className="mt-2 flex flex-col gap-2 text-xs font-semibold leading-5 text-slate-500 sm:flex-row sm:items-start sm:justify-between">
            <p>PDF·Word에서 추출한 원문 또는 직접 입력한 원문은 AI 초안 생성을 누를 때 외부 AI API로 전송됩니다. 파일 원본 자체는 AI에 전송하거나 자동 보관하지 않습니다. 개인정보·민감정보는 필요한 부분을 제거한 뒤 사용하세요.</p>
            <span className="shrink-0 tabular-nums">{sourceText.length.toLocaleString("ko-KR")} / 30,000자</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">3. 기사 초안 생성</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={loadCurrentContent} disabled={isGenerating} className="dd-btn dd-btn-secondary dd-btn-sm">
              현재 입력 내용 가져오기
            </button>
            <button type="button" onClick={() => void generateDraft()} disabled={isGenerating} className="dd-btn dd-btn-primary dd-btn-sm">
              {isGenerating ? "공공정보 구조를 분석하고 있습니다..." : "AI 초안 만들기"}
            </button>
            {wordImportedArticle ? (
              <button type="button" onClick={applyImportedWord} disabled={isGenerating} className="dd-btn dd-btn-secondary dd-btn-sm">
                원문 그대로 기사에 적용
              </button>
            ) : null}
          </div>
        </div>

        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
          AI 제안은 원자료 정리 보조용입니다. 날짜·금액·대상·연락처 등 핵심 사실은 반드시 원문과 대조하세요.
        </p>

        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
        {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-800">{message}</p> : null}

        {draft ? (
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-label="AI 제안 미리보기">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">AI 제안</p>
                <h3 className="mt-1 text-lg font-black text-[#092046]">저장 전 검수할 기사 초안</h3>
              </div>
              <button type="button" onClick={applyDraft} className="dd-btn dd-btn-primary dd-btn-sm self-start">제안 적용</button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <PreviewField label="제목" value={draft.title} />
              <PreviewField label="요약" value={draft.summary} />
              <PreviewField label="기사 유형" value={articleTypeLabels[draft.articleType] ?? draft.articleType} />
              <PreviewField label="관심분야" value={draft.interestTags.join(", ") || "제안 없음"} />
              <PreviewField label="담당 부서·담당자" value={draft.contactName || "원문에서 확인되지 않음"} />
              <PreviewField label="문의 전화" value={draft.contactPhone || "원문에서 확인되지 않음"} />
            </div>

            {publicInfoEntries.length > 0 ? (
              <div>
                <p className="text-xs font-black text-[#184a88]">핵심 공공정보</p>
                <dl className="mt-2 grid gap-2 md:grid-cols-2">
                  {publicInfoEntries.map((entry) => (
                    <div key={entry.key} className="rounded-lg bg-[#f7fbff] px-3 py-2">
                      <dt className="text-xs font-black text-slate-500">{entry.label}</dt>
                      <dd className="mt-1 text-sm font-semibold leading-6 text-slate-800 [overflow-wrap:anywhere]">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-black text-[#184a88]">본문 구성</p>
              <ol className="mt-2 space-y-2">
                {draft.blocks.map((block, index) => (
                  <li key={`${block.type}-${index}`} className="rounded-lg border border-slate-200 px-3 py-3">
                    <p className="text-xs font-black text-slate-500">{index + 1}. {blockTypeLabels[block.type] ?? block.type}</p>
                    {block.title ? <p className="mt-1 text-sm font-black text-[#092046]">{block.title}</p> : null}
                    <p className="mt-1 line-clamp-3 text-sm font-medium leading-6 text-slate-700 [overflow-wrap:anywhere]">{block.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <PreviewField label="긴급도 제안" value={`${urgencyLabels[draft.suggestedUrgency] ?? draft.suggestedUrgency}${draft.urgencyReason ? ` · ${draft.urgencyReason}` : ""}`} />
              <PreviewList label="확인 필요" values={draft.missingFacts} />
              <PreviewList label="검수 메모" values={draft.reviewNotes} />
            </div>
            <p className="text-xs font-semibold leading-5 text-slate-500">긴급도 제안은 입력폼에 자동 적용되지 않습니다. 노출·우선순위에서 직접 결정하세요.</p>
          </section>
        ) : null}
      </div>
    </details>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold leading-6 text-slate-800 [overflow-wrap:anywhere]">{value || "제안 없음"}</p>
    </div>
  );
}

function PreviewList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      {values.length > 0 ? (
        <ul className="mt-1 space-y-1 text-sm font-semibold leading-6 text-slate-800">
          {values.map((value, index) => <li key={`${label}-${index}`}>- {value}</li>)}
        </ul>
      ) : <p className="mt-1 text-sm font-semibold text-slate-500">없음</p>}
    </div>
  );
}
