"use client";

import { CanvaArticleApplyControls } from "@/components/design/canva-article-apply-controls";
import { useEffect, useRef, useState } from "react";
import { productionAssetLabels, productionAssetTypes } from "./design-asset-options";

type ImportState = { status: string; assetId?: string; assetName?: string; duplicate?: boolean };

export function CanvaPngImportControls({ projectSlug, articleId, designId, templateId, onBusyChange }: { projectSlug: string; articleId: string; designId: string; templateId?: string; onBusyChange?: (busy: boolean) => void }) {
  const [approval, setApproval] = useState<{ approved: boolean; confirmation?: string; templateId?: string } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [assetType, setAssetType] = useState("");
  const [current, setCurrent] = useState<ImportState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void fetch(`/api/canva/png-import?${new URLSearchParams({ projectSlug, articleId, ...(templateId ? { templateId, designId } : {}) })}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw Error(); return r.json(); })
      .then(d => { if (alive.current) { setEnabled(d.enabled === true); setCurrent(d.import); setApproval({ approved: d.approved === true, confirmation: d.confirmation, templateId: d.templateId }); } })
      .catch(() => { if (alive.current && !controller.signal.aborted) setNotice("가져오기 상태를 확인하지 못했습니다."); });
    return () => { alive.current = false; controller.abort(); };
  }, [projectSlug, articleId, designId, templateId]);

  async function send(action: "start" | "status") {
    const r = await fetch("/api/canva/png-import", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectSlug, articleId, designId, templateId: templateId ?? approval?.templateId, action, ...(action === "start" ? { assetType } : {}) }), signal: AbortSignal.timeout(55000) });
    const d = await r.json();
    if (!r.ok) throw Error(d.message || "PNG를 가져오지 못했습니다. 기존 기사에는 영향이 없습니다.");
    return { ...d.import, duplicate: d.duplicate === true } as ImportState;
  }

  async function run(action: "start" | "status") {
    if (pending.current || approval?.approved !== true || (action === "start" && current && ["sending", "unknown", "failed", "in_progress", "ready"].includes(current.status))) return;
    pending.current = true; setBusy(true); onBusyChange?.(true); setNotice("");
    if (action === "start") setCurrent({ status: "sending" });
    try {
      let next = await send(action);
      if (!alive.current) return;
      setCurrent(next);
      const deadline = Date.now() + 90000;
      for (let n = 0; n < 20 && ["in_progress", "ready"].includes(next?.status) && Date.now() < deadline && alive.current; n++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!alive.current) return;
        next = await send("status");
        if (alive.current) setCurrent(next);
      }
      if (alive.current && ["in_progress", "ready"].includes(next?.status)) setNotice("확인 시간이 지났습니다. 진행 작업 확인으로 이어서 조회할 수 있습니다.");
    } catch (error) {
      if (alive.current) setNotice(error instanceof Error ? error.message : "PNG를 가져오지 못했습니다.");
    } finally { pending.current = false; onBusyChange?.(false); if (alive.current) setBusy(false); }
  }

  async function approveAgain() {
    if (pending.current) return;
    pending.current = true; setBusy(true); onBusyChange?.(true); setNotice("");
    try {
      const selected = templateId ?? approval?.templateId;
      if (!selected) throw Error("현재 제작 결과를 확인하세요.");
      const response = await fetch(`/api/canva/png-import?${new URLSearchParams({ projectSlug, articleId, templateId: selected, designId })}`, { signal: AbortSignal.timeout(15000) });
      const candidate = await response.json();
      if (!response.ok || !candidate.enabled || candidate.designId !== designId) throw Error("현재 기사와 제작 결과를 다시 확인해 주세요.");
      const approved = await fetch("/api/canva/png-import", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ projectSlug, articleId, templateId: selected, designId, action: "approve", confirmation: candidate.confirmation }) });
      if (!approved.ok) throw Error("현재 결과를 승인하지 못했습니다.");
      if (alive.current) setApproval({ approved: true, templateId: selected });
    } catch (e) { if (alive.current) setNotice(e instanceof Error ? e.message : "승인 상태를 확인하지 못했습니다."); }
    finally { pending.current = false; onBusyChange?.(false); if (alive.current) setBusy(false); }
  }
  if (!enabled) return <p role="status" className="mt-2 text-sm">{notice || "앱으로 가져오기는 고정 Staging에서만 사용할 수 있습니다."}</p>;
  if (!approval?.approved) return <div className="mt-2 text-sm"><p role="status">현재 결과를 다시 검토하고 이 디자인 사용으로 승인해 주세요. {notice}</p><button type="button" disabled={busy} onClick={() => void approveAgain()} className="dd-btn dd-btn-secondary mt-2">이 디자인 사용</button></div>;
  const uncertain = current && ["sending", "unknown", "failed"].includes(current.status);
  const resumable = current && ["in_progress", "ready"].includes(current.status);
  return <div className="mt-3 rounded border border-slate-200 p-3">
    <h5 className="font-bold">Canva 디자인 자산 가져오기</h5>
    {current?.status === "success" ? <>
      <p role="status" className="my-2 break-words">디자인을 앱 자산으로 가져왔습니다. {current.assetName}</p>
      {current.duplicate ? <p className="text-sm">기존 앱 자산을 재사용했습니다. Canva 수정본 자동 동기화는 지원하지 않습니다.</p> : null}
      <p className="text-sm">아직 기사에 적용되지 않았습니다. 자산 관리에서 승인한 뒤 기사 디자인에서 직접 선택하세요.</p>
      <a className="text-sm text-blue-800 underline" href={`/projects/${encodeURIComponent(projectSlug)}/design`}>디자인 자산 관리</a>
      {current.assetId && (templateId ?? approval?.templateId) ? <CanvaArticleApplyControls key={`${articleId}:${templateId ?? approval?.templateId}:${current.assetId}`} projectSlug={projectSlug} articleId={articleId} assetId={current.assetId} templateId={(templateId ?? approval?.templateId)!} /> : null}
      <button type="button" disabled={busy} className="ml-3 text-sm underline" onClick={() => void run("status")}>등록 상태 확인</button>
    </> : <>
      <p className="my-2 text-sm">한 페이지 PNG를 프로젝트 자산으로 등록합니다. 기사에 자동으로 배치하지 않습니다.</p>
      <label className="block text-sm">가져올 자산 유형
        <select value={assetType} disabled={busy || !!resumable || !!uncertain} onChange={e => setAssetType(e.target.value)} className="my-2 block max-w-full rounded border p-2">
          <option value="">용도에 맞는 유형 선택</option>
          {productionAssetTypes.map(type => <option key={type} value={type}>{productionAssetLabels[type]}</option>)}
        </select>
      </label>
      {uncertain ? <p role="status">{current?.status === "failed" ? "이전 내보내기에 실패했습니다. 자동으로 다시 실행하지 않습니다." : "이전 요청 결과가 불확실합니다. 중복 내보내기를 실행하지 않고 Canva에서 확인하세요."}</p> :
        <button type="button" disabled={busy || (!resumable && !assetType)} onClick={() => void run(resumable ? "status" : "start")} className="rounded bg-blue-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{resumable ? "진행 작업 확인" : "앱으로 가져오기"}</button>}
    </>}
    <p role="status" className="my-2 break-words text-sm">{busy ? current?.status === "ready" ? "가져오는 중" : "내보내는 중" : notice ? `가져오기 실패 · ${notice}` : (current?.status === "success" ? "가져오기 완료" : "가져오기 가능")}</p>
  </div>;
}
