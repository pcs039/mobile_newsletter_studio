"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArticleMobilePreviewModal } from "@/components/article-mobile-preview-modal";
import { moveArticle, sameArticleOrder, type ArticleOrderState } from "@/lib/article-order";

export type ArticleListRow = {
  id: string; title: string; typeLabel: string; statusLabel: string;
  updated: string; visibilityLabel: string; designLabel: string;
  blockCount: number; linkCount: number;
};
const button = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-[#092046] disabled:cursor-not-allowed disabled:opacity-40";

export function ProjectArticleList({ projectSlug, rows }: { projectSlug: string; rows: ArticleListRow[] }) {
  const [ids, setIds] = useState(rows.map(row => row.id));
  const [saved, setSaved] = useState<ArticleOrderState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("순서 저장 상태를 확인하고 있습니다.");
  const [preview, setPreview] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const lock = useRef(false);
  const dirty = !!saved && !sameArticleOrder(ids, saved.articles.map(row => row.id));
  const byId = new Map(rows.map(row => [row.id, row]));
  const closePreview = useCallback(() => setPreview(null), []);

  const accept = useCallback((data: ArticleOrderState) => {
    const nextIds = data.articles.map(row => row.id);
    if (nextIds.length !== rows.length || new Set(nextIds).size !== rows.length || nextIds.some(id => !rows.some(row => row.id === id))) {
      throw new Error("기사 목록이 변경되었습니다. 페이지를 새로고침해 주세요.");
    }
    setSaved(data); setIds(nextIds);
  }, [rows]);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/project-content/order?projectSlug=${encodeURIComponent(projectSlug)}`, { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "목록을 확인하지 못했습니다.");
    return data as ArticleOrderState;
  }, [projectSlug]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(data => { if (!controller.signal.aborted) { accept(data); setMessage("드래그하거나 위·아래 버튼으로 옮긴 뒤 순서를 저장하세요."); } }).catch(error => {
      if (!controller.signal.aborted) { setSaved(null); setMessage(error instanceof Error ? error.message : "목록을 확인하지 못했습니다."); }
    });
    return () => controller.abort();
  }, [load, accept]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function move(id: string, target: string) {
    if (!saved || lock.current) return;
    setIds(current => moveArticle(current, id, target));
    setMessage("변경된 순서는 아직 저장되지 않았습니다.");
  }

  async function save() {
    if (lock.current || !saved || !dirty) return;
    lock.current = true; setBusy(true);
    try {
      const response = await fetch("/api/project-content/order", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ projectSlug, articleIds: ids, snapshot: saved.snapshot }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "순서를 저장하지 못했습니다.");
      accept(data); setMessage(data.duplicate ? "이미 저장된 순서입니다." : "기사 순서를 저장했습니다.");
    } catch (error) {
      // A timed-out write can have committed. Require a fresh snapshot before any retry.
      setSaved(null); setMessage(error instanceof Error ? error.message : "저장 여부가 불확실합니다. 목록을 다시 확인해 주세요.");
    } finally { lock.current = false; setBusy(false); }
  }

  return <section className="min-w-0 space-y-4" aria-label="프로젝트 기사 목록">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold text-slate-600">기사 {rows.length}개 · 기본 공개 순서</p>
      <Link href={`/projects/${projectSlug}/reading?tab=content`} className="dd-btn dd-btn-primary">+ 새 기사 작성</Link>
    </div>
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={busy || !dirty} onClick={() => void save()}>{busy ? "순서 저장 중…" : "순서 저장"}</button>
        <button type="button" className={button} disabled={busy || !dirty} onClick={() => { if (saved) setIds(saved.articles.map(row => row.id)); setMessage("순서 변경을 취소했습니다."); }}>변경 취소</button>
        {!saved && <button type="button" className={button} disabled={busy} onClick={() => {
          if (lock.current) return;
          lock.current = true; setBusy(true);
          void load().then(data => { accept(data); setMessage("목록을 다시 확인했습니다."); }).catch(error => setMessage(error instanceof Error ? error.message : "확인 실패")).finally(() => { lock.current = false; setBusy(false); });
        }}>목록 다시 확인</button>}
      </div>
      <p role="status" className="mt-3 break-words text-sm font-semibold text-slate-700">{message}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">정기호 기본 순서에 반영됩니다. 수시·긴급 소식 우선 표시와 독자의 관심분야 맞춤 정렬은 기존 규칙을 따릅니다. 편집 화면을 열기 전에 순서를 저장하세요.</p>
    </div>
    {rows.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center">등록된 기사가 없습니다. 새 기사를 작성해 주세요.</p> : <ol className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {ids.map((id, index) => {
        const row = byId.get(id); if (!row) return null;
        return <li key={id} data-article-id={id} draggable={!!saved && !busy} onDragStart={event => { setDragged(id); event.dataTransfer.setData("text/plain", id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragged(null)} onDragOver={event => { if (dragged && saved && !busy) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (dragged) move(dragged, id); setDragged(null); }} className={`min-w-0 p-4 ${dragged === id ? "bg-sky-50" : ""}`}>
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center">
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-base font-black leading-7 text-[#092046]"><span className="mr-2 text-slate-500">{index + 1}.</span>{row.title || "제목 없음"}</h3>
              <p className="mt-1 break-words text-xs font-semibold leading-6 text-slate-600">{row.typeLabel} · {row.statusLabel} · {row.visibilityLabel} · {row.designLabel}</p>
              <p className="text-xs leading-6 text-slate-500">최근 수정 {row.updated}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2" aria-label={`${row.title} 작업`}>
              <button type="button" className={button} aria-label={`${row.title} 위로 이동`} disabled={!saved || busy || index === 0} onClick={() => move(id, ids[index - 1])}>↑ 위</button>
              <button type="button" className={button} aria-label={`${row.title} 아래로 이동`} disabled={!saved || busy || index === ids.length - 1} onClick={() => move(id, ids[index + 1])}>↓ 아래</button>
              <Link href={`/projects/${projectSlug}/reading?articleId=${id}&tab=content`} className={button}>편집</Link>
              <button type="button" className={button} onClick={() => setPreview(id)} aria-label={`${row.title} 미리보기`}>미리보기</button>
            </div>
          </div>
          <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">구성 정보</summary><p className="mt-2">블록 {row.blockCount}개 · 링크 {row.linkCount}개</p></details>
        </li>;
      })}
    </ol>}
    {preview && <ArticleMobilePreviewModal isOpen onClose={closePreview} articleIds={rows.map(row => row.id)} previewHref={`/newsletters/${projectSlug}?preview=admin&articleId=${preview}`} />}
  </section>;
}
