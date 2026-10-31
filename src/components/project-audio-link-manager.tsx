"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ManualAudioLinkState } from "@/lib/manual-audio-link";
import type { AudioTranscriptReviewStatus, AudioTranscriptType } from "@/lib/newsletter-repository";

export type ProjectAudioLinkArticleOption = {
  audioSource?: string;
  body: string;
  id: string;
  label: string;
  summary: string;
};

type SaveStatus = "idle" | "loading" | "saving" | "success" | "error" | "unknown" | "conflict";

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

  const [linkState, setLinkState] = useState<ManualAudioLinkState | null>(null);
  const busy = useRef(false);
  const pending = useRef<Record<string, unknown> | null>(null);
  const locked = !linkState || ["loading", "saving", "unknown", "conflict"].includes(status);

  async function loadState() {
    if (busy.current) return;
    busy.current = true;
    setIsOpen(true);
    setStatus("loading");
    setMessage("현재 음성 연결을 확인하고 있습니다.");
    try {
      const query = new URLSearchParams({ projectSlug, audioId });
      const response = await fetch(`/api/project-audio-links?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.state?.revision) throw new Error(result.message || "음성 상태를 불러오지 못했습니다.");
      const state = result.state as ManualAudioLinkState;
      setLinkState(state);
      setSelectedArticleId(state.articleId ?? "");
      setSelectedTranscriptType(state.transcriptType as AudioTranscriptType);
      setSelectedTranscriptReviewStatus(state.transcriptReviewStatus as AudioTranscriptReviewStatus);
      setDraftTranscriptText(state.transcriptText);
      setDraftTranscriptReviewNote(state.transcriptReviewNote);
      pending.current = null;
      setStatus("idle");
      setMessage("");
    } catch (error) {
      setLinkState(null);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "음성 상태를 불러오지 못했습니다.");
    } finally { busy.current = false; }
  }

  async function saveLink(articleId: string | null, retry = false) {
    if (busy.current || (!retry && locked)) return;
    const body = retry ? pending.current : {
      articleId, audioId, projectSlug, expectedRevision: linkState!.revision,
      transcriptReviewNote: draftTranscriptReviewNote,
      transcriptReviewStatus: selectedTranscriptReviewStatus,
      transcriptText: draftTranscriptText, transcriptType: selectedTranscriptType,
    };
    if (!body) return;
    pending.current = body;
    busy.current = true;
    setStatus("saving");
    setMessage("연결과 대본 정보를 함께 저장하고 있습니다.");
    try {
      const response = await fetch("/api/project-audio-links", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        setStatus(result.uncertain ? "unknown" : response.status === 409 ? "conflict" : "error");
        setMessage(result.message || "저장 결과를 확인하지 못했습니다.");
        if (!result.uncertain) pending.current = null;
        return;
      }
      setStatus("success");
      setMessage(result.message || "음성 연결과 대본을 저장했습니다.");
      setLinkState(null);
      pending.current = null;
      setIsOpen(false);
      router.refresh();
    } catch {
      setStatus("unknown");
      setMessage("저장 응답을 확인하지 못했습니다. 같은 저장 요청으로 결과를 확인해 주세요.");
    } finally { busy.current = false; }
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
        onClick={() => { if (busy.current) return; if (isOpen) setIsOpen(false); else if (linkState) setIsOpen(true); else void loadState(); }}
        className="dd-btn dd-btn-secondary dd-btn-sm rounded-lg px-4 py-3"
      >
        연결 관리
      </button>

      {isOpen ? (
        <div className="w-[420px] max-w-full rounded-xl border border-[#b8d7ff] bg-[#f7fbff] p-3 shadow-sm">
          <fieldset disabled={locked}>
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
              <option key={article.id} value={article.id} disabled={article.audioSource === "ai_tts"}>
                {article.label}{article.audioSource === "ai_tts" ? " · AI 음성 사용 중" : ""}
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
              disabled={locked}
              className="dd-btn dd-btn-primary dd-btn-sm"
            >
              {status === "saving" ? "저장 중" : "대본/연결 저장"}
            </button>
            {linkState?.articleId || selectedArticleId ? (
              <button
                type="button"
                onClick={() => void saveLink(null)}
                disabled={locked}
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
          </fieldset>
          {status === "unknown" ? <button type="button" className="dd-btn dd-btn-secondary dd-btn-sm" onClick={() => void saveLink(null, true)}>같은 저장 요청 결과 확인</button> : null}
          {status !== "unknown" && status !== "saving" && status !== "loading" ? <button type="button" className="dd-btn dd-btn-secondary dd-btn-sm" onClick={() => void loadState()}>최신 상태 불러오기 · 입력 초기화</button> : null}
          <p className="mt-2 text-xs leading-5 text-slate-500">연결하면 직접 제작 음성을 사용합니다. AI 음성이 선택된 기사는 작성 화면에서 음성 방식을 먼저 변경하세요. 기존 AI 파일은 삭제하지 않습니다.</p>
        </div>
      ) : null}
      {message ? <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold leading-5 ${["error", "unknown", "conflict"].includes(status) ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p> : null}
    </div>
  );
}
