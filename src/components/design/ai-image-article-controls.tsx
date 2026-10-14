"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AiImageApplyState, AiImageRole } from "@/lib/ai-image-article";
import { useStagingE2E } from "./staging-e2e-status";

export function AiImageArticleControls({ projectSlug, articleId, revision }: { projectSlug: string; articleId: string; revision: string }) {
  const [state, setState] = useState<AiImageApplyState | null>(null), [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [confirmed, setConfirmed] = useState(false);
  const flight = useRef(false), alive = useRef(true), router = useRouter(), gate = useStagingE2E();
  async function call(input: Record<string, unknown>) {
    const response = await fetch("/api/project-content/ai-image-apply", { method: "POST", headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000), body: JSON.stringify({ projectSlug, articleId, ...input }) });
    const value = await response.json();
    if (!response.ok || !value.ok) throw new Error(value.message ?? "현재 적용 상태를 다시 확인하세요.");
    return value;
  }
  useEffect(() => {
    alive.current = true;
    if (gate !== "enabled") return;
    const controller = new AbortController();
    void fetch("/api/project-content/ai-image-apply", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ projectSlug, articleId, action: "state" }) }).then(async response => {
      const value = await response.json();
      if (!response.ok || !value.ok) throw Error(value.message ?? "적용 상태를 확인하지 못했습니다.");
      if (!controller.signal.aborted) { setState(value); setSelected(id => value.candidates.some((c: { id: string }) => c.id === id) ? id : value.candidates[0]?.id ?? ""); setConfirmed(false); }
    }).catch(error => { if (!controller.signal.aborted) { setState(null); setNotice(error instanceof Error ? error.message : "적용 상태를 다시 확인하세요."); } });
    return () => { alive.current = false; controller.abort(); };
  }, [projectSlug, articleId, revision, gate]);
  const candidate = state?.candidates.find(a => a.id === selected);
  const hero = state?.connections.find(c => c.role === "hero"), body = state?.connections.find(c => c.role === "body" && c.assetId === selected);
  async function run(role: AiImageRole, revoke = false, assetId = selected) {
    if (flight.current || !state || (!revoke && !candidate) || gate !== "enabled") return;
    if (!revoke && hero && role === "hero" && hero.assetId !== selected && !window.confirm("현재 대표 이미지를 이 시안으로 교체합니다. 기존 자산은 보존됩니다.")) return;
    flight.current = true; setBusy(true); setNotice("");
    try {
      const value = await call({ action: revoke ? "revoke" : "apply", role, assetId, expected: state.snapshot, generationKey: candidate?.generationKey, confirmedStale: confirmed });
      if (alive.current) { setState(value.state); setNotice(revoke ? "기사 연결을 해제했습니다. 원본 자산은 유지됩니다." : value.duplicate ? "기존 기사 적용 상태를 재사용했습니다." : "기사에 적용되었습니다."); router.refresh(); }
    } catch (error) {
      if (alive.current) setNotice(error instanceof Error ? error.message : "적용 결과를 다시 확인하세요. 자동으로 재시도하지 않습니다.");
    } finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  if (gate !== "enabled") return null;
  if (!state) return notice ? <p role="status" className="mt-3 text-sm">{notice}</p> : null;
  const unavailableConnections = state.connections.filter(c => !state.candidates.some(a => a.id === c.assetId));
  const unavailable = unavailableConnections.length ? <div className="mt-3 text-sm"><p>기존 적용 자산이 삭제·비활성화되었거나 적용 후보 조건이 바뀌었습니다. 자동으로 연결을 제거하지 않습니다.</p>{unavailableConnections.map(c => <button type="button" className="dd-btn dd-btn-secondary mt-2 max-w-full whitespace-normal" key={c.blockId} disabled={busy} onClick={() => void run(c.role,true,c.assetId)}>{c.role === "hero" ? "대표 이미지" : "본문 이미지"} 연결 해제</button>)}</div> : null;
  if (!candidate) return <section className="mt-3"><p className="text-sm">현재 기사에서 생성된 AI 이미지 적용 후보가 없습니다.</p>{unavailable}<p role="status">{notice}</p></section>;
  const appliedHero = hero?.assetId === selected;
  const disabled = busy || candidate.approvalStatus !== "approved" || state.conflict || (candidate.stale && !confirmed);
  return <section aria-label="AI 이미지 기사 적용" className="mt-3 min-w-0 rounded border border-slate-200 p-3 [overflow-wrap:anywhere]">
    <h5 className="font-bold">생성 이미지 검토 및 기사 적용</h5>
    <div className="mt-2 flex flex-wrap gap-2" aria-label="생성 시안 선택">{state.candidates.map((c, i) => <button type="button" className={`dd-btn dd-btn-secondary max-w-full whitespace-normal ${selected === c.id ? "ring-2 ring-blue-600" : ""}`} aria-pressed={selected === c.id} key={c.id} disabled={busy} onClick={() => { setSelected(c.id); setConfirmed(false); setNotice(""); }}>시안 {c.variantIndex ?? i + 1}{c.variantIndex === null ? " · 등록 정보 확인" : ""}</button>)}</div>
    <Image unoptimized src={candidate.previewHref} width={400} height={500} alt="기사 적용 후보 개념 이미지" className="mt-3 h-auto max-h-64 max-w-full rounded object-contain" />
    <p className="mt-2 font-semibold">{candidate.name}</p>
    <p className="text-xs">{candidate.styleLabel} · {candidate.aspectRatio} · {candidate.approvalStatus === "approved" ? "승인됨" : "미승인 · 자산 관리에서 승인 필요"}</p>
    <p className="mt-2 text-sm">자산으로 등록됨 · {[appliedHero ? "대표 이미지로 적용됨" : "", body ? "본문 이미지로 적용됨" : ""].filter(Boolean).join(" · ") || "아직 기사에는 적용되지 않았습니다."}</p>
    {candidate.stale ? <label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />기사 내용 또는 생성 조건이 변경되었습니다. 이미지를 다시 확인했으며 적용하겠습니다.</label> : null}
    {state.conflict ? <p className="mt-2 text-sm">현재 Canva 전체 디자인 또는 이미지형 기사가 적용되어 있습니다. 먼저 해당 적용을 해제하세요.</p> : null}
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="dd-btn dd-btn-primary max-w-full whitespace-normal" disabled={disabled || appliedHero} onClick={() => void run("hero")}>{busy ? "처리 중…" : hero && !appliedHero ? "이 시안으로 교체" : "대표 이미지로 적용"}</button>
      <button type="button" className="dd-btn dd-btn-secondary max-w-full whitespace-normal" disabled={disabled || !!body} onClick={() => void run("body")}>본문 이미지로 삽입</button>
      {appliedHero ? <button type="button" className="dd-btn dd-btn-secondary max-w-full whitespace-normal" disabled={busy} onClick={() => void run("hero", true)}>대표 이미지 적용 해제</button> : null}
      {body ? <button type="button" className="dd-btn dd-btn-secondary max-w-full whitespace-normal" disabled={busy} onClick={() => void run("body", true)}>본문 이미지 적용 해제</button> : null}
      <a className="dd-btn dd-btn-secondary max-w-full whitespace-normal" href={`/projects/${encodeURIComponent(projectSlug)}/design`}>자산 관리에서 확인</a>
      {appliedHero || body ? <a className="dd-btn dd-btn-secondary max-w-full whitespace-normal" target="_blank" rel="noopener noreferrer" href={`/newsletters/${encodeURIComponent(projectSlug)}?preview=admin&articleId=${encodeURIComponent(articleId)}`}>미리보기에서 확인</a> : null}
    </div>{unavailable}<p role="status" aria-live="polite" className="mt-2 text-sm">{notice}</p>
  </section>;
}
