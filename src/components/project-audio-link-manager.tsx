"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AudioTranscriptReviewStatus, AudioTranscriptType } from "@/lib/newsletter-repository";

export type ProjectAudioLinkArticleOption = {
  body: string;
  id: string;
  label: string;
  summary: string;
};

type SaveStatus = "idle" | "saving" | "success" | "error";

export function ProjectAudioLinkManager({
  articles,
  audioId,
  currentArticleId,
  projectSlug,
  transcriptReviewNote,
  transcriptReviewStatus,
  transcriptText,
  transcriptType,
}: {
  articles: ProjectAudioLinkArticleOption[];
  audioId: string;
  currentArticleId: string | null;
  projectSlug: string;
  transcriptReviewNote: string;
  transcriptReviewStatus: AudioTranscriptReviewStatus;
  transcriptText: string;
  transcriptType: AudioTranscriptType;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState(currentArticleId ?? "");
  const [selectedTranscriptType, setSelectedTranscriptType] = useState<AudioTranscriptType>(transcriptType);
  const [selectedTranscriptReviewStatus, setSelectedTranscriptReviewStatus] =
    useState<AudioTranscriptReviewStatus>(transcriptReviewStatus);
  const [draftTranscriptText, setDraftTranscriptText] = useState(transcriptText);
  const [draftTranscriptReviewNote, setDraftTranscriptReviewNote] = useState(transcriptReviewNote);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const selectedArticle = articles.find((article) => article.id === selectedArticleId) ?? null;

  async function saveLink(articleId: string | null, unlink = false) {
    setStatus("saving");
    setMessage("연결과 대본 정보를 저장하는 중입니다.");

    const response = await fetch("/api/project-audio-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        articleId,
        audioId,
        projectSlug,
        unlink,
        transcriptReviewNote: draftTranscriptReviewNote,
        transcriptReviewStatus: selectedTranscriptReviewStatus,
        transcriptText: draftTranscriptText,
        transcriptType: selectedTranscriptType,
      }),
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setStatus("error");
      setMessage(result?.message ?? "음성 파일 연결 저장에 실패했습니다.");
      return;
    }

    setStatus("success");
    setMessage(result?.message ?? "음성 파일이 모바일 기사에 연결되었습니다.");
    setSelectedArticleId(articleId ?? "");
    router.refresh();
  }

  function loadArticleText() {
    if (!selectedArticle) {
      setStatus("error");
      setMessage("먼저 연결할 모바일 기사를 선택하세요.");
      return;
    }

    const nextTranscript = selectedArticle.body.trim() || selectedArticle.summary.trim();

    if (!nextTranscript) {
      setStatus("error");
      setMessage("선택한 기사에 불러올 본문이나 요약이 없습니다.");
      return;
    }

    setDraftTranscriptText(nextTranscript);
    setStatus("idle");
    setMessage("선택한 기사 내용을 대본 입력칸에 불러왔습니다. 저장 전 수정할 수 있습니다.");
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="dd-btn dd-btn-secondary dd-btn-sm rounded-lg px-4 py-3"
      >
        연결 관리
      </button>

      {isOpen ? (
        <div className="w-[420px] max-w-full rounded-xl border border-[#b8d7ff] bg-[#f7fbff] p-3 shadow-sm">
          <label className="block text-xs font-black text-[#184a88]" htmlFor={`audio-link-${audioId}`}>
            모바일 기사 선택
          </label>
          <select
            id={`audio-link-${audioId}`}
            value={selectedArticleId}
            onChange={(event) => setSelectedArticleId(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#092046] outline-none transition focus:border-[#2f73b7] focus:ring-4 focus:ring-sky-100"
          >
            <option value="">연결할 기사 선택</option>
            {articles.map((article) => (
              <option key={article.id} value={article.id}>
                {article.label}
              </option>
            ))}
          </select>
          <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">
            음성 대본은 기사 원문과 다를 수 있습니다. 실제 녹음 또는 TTS 생성에 사용한 문장을 입력해 검수용으로 보관하세요.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-black text-[#184a88]" htmlFor={`audio-transcript-type-${audioId}`}>
              음성 대본 유형
              <select
                id={`audio-transcript-type-${audioId}`}
                value={selectedTranscriptType}
                onChange={(event) => setSelectedTranscriptType(event.target.value as AudioTranscriptType)}
                className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#092046] outline-none transition focus:border-[#2f73b7] focus:ring-4 focus:ring-sky-100"
              >
                <option value="article_original">기사 원문 그대로</option>
                <option value="summary_script">요약 대본</option>
                <option value="custom_script">별도 낭독문</option>
              </select>
            </label>
            <label className="block text-xs font-black text-[#184a88]" htmlFor={`audio-transcript-status-${audioId}`}>
              대본 검수 상태
              <select
                id={`audio-transcript-status-${audioId}`}
                value={selectedTranscriptReviewStatus}
                onChange={(event) => setSelectedTranscriptReviewStatus(event.target.value as AudioTranscriptReviewStatus)}
                className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#092046] outline-none transition focus:border-[#2f73b7] focus:ring-4 focus:ring-sky-100"
              >
                <option value="pending">검수 대기</option>
                <option value="approved">검수 완료</option>
                <option value="needs_revision">수정 필요</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-black text-[#184a88]" htmlFor={`audio-transcript-text-${audioId}`}>
              음성 대본
            </label>
            <button
              type="button"
              onClick={loadArticleText}
              disabled={!selectedArticleId || status === "saving"}
              className="dd-btn dd-btn-secondary dd-btn-sm"
            >
              기사 본문 불러오기
            </button>
          </div>
          <textarea
            id={`audio-transcript-text-${audioId}`}
            value={draftTranscriptText}
            onChange={(event) => setDraftTranscriptText(event.target.value)}
            placeholder="실제 녹음 또는 TTS 생성에 사용한 낭독문을 입력하세요."
            className="mt-2 min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2f73b7] focus:ring-4 focus:ring-sky-100"
          />

          <label className="mt-3 block text-xs font-black text-[#184a88]" htmlFor={`audio-transcript-note-${audioId}`}>
            검수 메모
          </label>
          <textarea
            id={`audio-transcript-note-${audioId}`}
            value={draftTranscriptReviewNote}
            onChange={(event) => setDraftTranscriptReviewNote(event.target.value)}
            placeholder="발음, 누락, 수정 요청 등 검수 메모를 입력하세요."
            className="mt-2 min-h-20 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2f73b7] focus:ring-4 focus:ring-sky-100"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveLink(selectedArticleId || null)}
              disabled={status === "saving"}
              className="dd-btn dd-btn-primary dd-btn-sm"
            >
              {status === "saving" ? "저장 중" : "대본/연결 저장"}
            </button>
            {currentArticleId || selectedArticleId ? (
              <button
                type="button"
                onClick={() => void saveLink(null, true)}
                disabled={status === "saving"}
                className="dd-btn dd-btn-secondary dd-btn-sm"
              >
                연결 해제
              </button>
            ) : null}
          </div>

          {articles.length === 0 ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
              연결할 모바일 기사가 없습니다. 기사 작성/편집 화면에서 먼저 기사를 저장하세요.
            </p>
          ) : null}
          {message ? (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold leading-5 ${
                status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
