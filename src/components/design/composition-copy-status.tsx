"use client";
import { useEffect, useMemo, useState } from "react";
import { CompositionCopySafety, copyScopeNotice } from "@/lib/composition-copy-safety";

export function useCompositionCopySafety(projectSlug: string) {
  const [, redraw] = useState(0);
  const safety = useMemo(() => new CompositionCopySafety(projectSlug, () => redraw(n => n + 1)), [projectSlug]);
  useEffect(() => { safety.activate(); safety.restore(); return () => safety.dispose(); }, [safety]);
  return safety;
}
const slots: Record<string, string> = { hero_background: "배경판", hero_illustration: "상단 이미지·장식", title_icon: "제목 아이콘 · 공개 미지원", body_decoration: "본문 장식 · 공개 미지원", footer_banner: "하단 배너 · 공개 미지원" };
export function CompositionCopyStatus({ safety }: { safety: CompositionCopySafety }) {
  const source = safety.source;
  return <div className="mt-4 space-y-3 text-sm leading-6">
    <p className="rounded-lg bg-sky-50 p-3 text-slate-700">{copyScopeNotice}</p>
    {source ? <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer font-bold">원본 배치 {source.composition.assets.length}개 · 슬롯·승인 상태 확인</summary>
      <ul className="mt-2 space-y-1">{source.composition.assets.map(p => { const asset = source.assets.find(a => a.id === p.assetId); return <li key={p.id} className="break-words">{slots[p.slot] ?? p.slot} · {asset?.name ?? "자산 정보 없음 · 비활성 등 확인 필요"} · {asset?.approvalStatus === "approved" ? "Approved" : asset?.approvalStatus === "draft" ? "Draft · 별도 승인 필요" : "상태 확인 필요"}{p.isVisible ? "" : " · 숨김"}</li>; })}</ul>
    </details> : null}
    {safety.message ? <p role="status" className={`rounded-lg p-3 ${safety.locked || safety.phase === "empty" || safety.phase === "rejected" ? "bg-amber-50 text-amber-950" : "bg-slate-50 text-slate-700"}`}>{safety.message}</p> : null}
    {safety.sourceId && !safety.locked ? <button type="button" disabled={safety.busy} onClick={() => void safety.selectSource(safety.sourceId)} className="rounded-lg border border-slate-300 px-3 py-2 font-bold disabled:opacity-50">원본 다시 확인</button> : null}
    {safety.locked ? <div><button type="button" disabled={safety.inspecting} onClick={() => void safety.inspectSaved()} className="rounded-lg border border-slate-300 px-3 py-2 font-bold disabled:opacity-50">{safety.inspecting ? "저장본 조회 중" : "저장본 조회 · 재실행하지 않음"}</button>
      <p className="mt-2 text-xs text-slate-600">요청 이력 식별자가 없는 기존 RPC이므로 조회만으로 잠금을 해제하지 않습니다. 관리자 확인이 필요합니다.</p>
      <ul>{safety.savedChecks.map(c => <li key={c.articleId} className="break-all"><a className="underline" target="_blank" rel="noreferrer" href={`/projects/${safety.projectSlug}/reading?articleId=${c.articleId}&tab=composition`}>저장본 열기</a> · 배치 {c.count}개 · {c.status}</li>)}</ul>
    </div> : null}
  </div>;
}
