"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectAudioLinkArticleOption = {
  id: string;
  label: string;
};

type SaveStatus = "idle" | "saving" | "success" | "error";

export function ProjectAudioLinkManager({
  articles,
  audioId,
  currentArticleId,
  projectSlug,
}: {
  articles: ProjectAudioLinkArticleOption[];
  audioId: string;
  currentArticleId: string | null;
  projectSlug: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState(currentArticleId ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");

  async function saveLink(articleId: string | null) {
    setStatus("saving");
    setMessage("연결 정보를 저장하는 중입니다.");

    const response = await fetch("/api/project-audio-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        articleId,
        audioId,
        projectSlug,
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
        <div className="w-80 max-w-full rounded-xl border border-[#b8d7ff] bg-[#f7fbff] p-3 shadow-sm">
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

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveLink(selectedArticleId || null)}
              disabled={status === "saving" || !selectedArticleId}
              className="dd-btn dd-btn-primary dd-btn-sm"
            >
              {status === "saving" ? "저장 중" : "연결 저장"}
            </button>
            {currentArticleId || selectedArticleId ? (
              <button
                type="button"
                onClick={() => void saveLink(null)}
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
