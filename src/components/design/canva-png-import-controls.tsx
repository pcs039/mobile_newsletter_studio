"use client";

import { useEffect, useRef, useState } from "react";
import { productionAssetLabels, productionAssetTypes } from "./design-asset-options";

type ImportState = { status: string; assetId?: string; assetName?: string };

export function CanvaPngImportControls({ projectSlug, articleId, designId }: { projectSlug: string; articleId: string; designId: string }) {
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
    void fetch(`/api/canva/png-import?${new URLSearchParams({ projectSlug, articleId })}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw Error(); return r.json(); })
      .then(d => { if (alive.current) { setEnabled(d.enabled === true); setCurrent(d.import); } })
      .catch(() => { if (alive.current && !controller.signal.aborted) setNotice("가져오기 상태를 확인하지 못했습니다."); });
    return () => { alive.current = false; controller.abort(); };
  }, [projectSlug, articleId, designId]);

  async function send(action: "start" | "status") {
    const r = await fetch("/api/canva/png-import", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectSlug, articleId, designId, action, ...(action === "start" ? { assetType } : {}) }), signal: AbortSignal.timeout(55000) });
    const d = await r.json();
    if (!r.ok) throw Error(d.message || "PNG를 가져오지 못했습니다. 기존 기사에는 영향이 없습니다.");
    return d.import as ImportState;
  }

  async function run(action: "start" | "status") {
    if (pending.current) return;
    pending.current = true; setBusy(true); setNotice("");
    try {
      let next = await send(action);
      if (!alive.current) return;
      setCurrent(next);
      const deadline = Date.now() + 90000;
      for (let n = 0; n < 20 && next?.status === "in_progress" && Date.now() < deadline && alive.current; n++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!alive.current) return;
        next = await send("status");
        if (alive.current) setCurrent(next);
      }
      if (alive.current && next?.status === "in_progress") setNotice("확인 시간이 지났습니다. 진행 작업 확인으로 이어서 조회할 수 있습니다.");
    } catch (error) {
      if (alive.current) setNotice(error instanceof Error ? error.message : "PNG를 가져오지 못했습니다.");
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  }

  if (!enabled) return notice ? <p role="status">{notice}</p> : null;
  const uncertain = current && ["sending", "unknown"].includes(current.status);
  const resumable = current && ["in_progress", "ready"].includes(current.status);
  return <div className="mt-3 rounded border border-slate-200 p-3">
    <h5 className="font-bold">Canva 디자인 자산 가져오기</h5>
    {current?.status === "success" ? <>
      <p role="status" className="my-2 break-words">등록 완료: {current.assetName}</p>
      <p className="text-sm">기사 디자인에서 사용: 자산 관리에서 승인한 뒤 배경·장식 선택에서 직접 선택하세요.</p>
      <a className="text-sm text-blue-800 underline" href={`/projects/${encodeURIComponent(projectSlug)}/design`}>디자인 자산 관리</a>
      <button type="button" disabled={busy} className="ml-3 text-sm underline" onClick={() => void run("status")}>등록 상태 확인</button>
    </> : <>
      <p className="my-2 text-sm">한 페이지 PNG를 프로젝트 자산으로 등록합니다. 기사에 자동으로 배치하지 않습니다.</p>
      <label className="block text-sm">가져올 자산 유형
        <select value={assetType} disabled={busy || !!resumable || !!uncertain} onChange={e => setAssetType(e.target.value)} className="my-2 block max-w-full rounded border p-2">
          <option value="">용도에 맞는 유형 선택</option>
          {productionAssetTypes.map(type => <option key={type} value={type}>{productionAssetLabels[type]}</option>)}
        </select>
      </label>
      {uncertain ? <p role="status">이전 요청 결과가 불확실합니다. 중복 내보내기를 실행하지 않고 Canva에서 확인하세요.</p> :
        <button type="button" disabled={busy || (!resumable && !assetType)} onClick={() => void run(resumable ? "status" : "start")} className="rounded bg-blue-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{resumable ? "진행 작업 확인" : "PNG로 디자인 자산 가져오기"}</button>}
    </>}
    <p role="status" className="my-2 break-words text-sm">{busy ? "PNG 내보내기 및 자산 등록 중" : notice}</p>
  </div>;
}
