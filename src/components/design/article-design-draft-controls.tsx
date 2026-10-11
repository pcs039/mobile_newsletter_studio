"use client";
import { useEffect, useRef, useState } from "react";
import type { ArticlePatternRecommendation } from "@/lib/article-pattern-recommendation";
import type { ArticleDesignDraft } from "@/lib/article-design-draft";
import type { ProjectArticleComposition } from "@/lib/article-composition";
import { conceptDirections, type ArticleDesignConcept } from "@/lib/article-design-concept";
import { productionPatternDescriptions } from "@/lib/article-production-pattern";
import { buildVisualAssetSpecifications, visualAssetRoles } from "@/lib/article-visual-asset-spec";

type Proposal = Pick<ArticleDesignDraft, "pattern" | "changes" | "preserved" | "placements"> & { confirmation: string };
export function ArticleDesignDraftControls({ projectSlug, articleId, disabled, composition, onApplied }: {
  projectSlug: string; articleId: string; disabled: boolean; composition: ProjectArticleComposition;
  recommendation: ArticlePatternRecommendation | null; onApplied: (value: ProjectArticleComposition) => void;
}) {
  const [draft, setDraft] = useState<Proposal | null>(null);
  const [concepts, setConcepts] = useState<ArticleDesignConcept[]>([]);
  const [selected, setSelected] = useState<ArticleDesignConcept | null>(null);
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);
  const localVersion = JSON.stringify({ settings: composition.settings, assets: composition.assets, updated: composition.updatedAt });
  const [version, setVersion] = useState(localVersion);
  const stale = version !== localVersion;
  const frame = composition.assets.find(asset => asset.slot === "hero_background" && asset.isVisible)?.settings;
  const colors = [frame?.titleColor, frame?.bodyColor, frame?.accentColor].filter((color): color is string => typeof color === "string");
  const visualAssets = selected ? buildVisualAssetSpecifications(selected, colors) : [];

  async function call(url: string, payload: unknown, controller: AbortController) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) throw new Error(body?.message ?? "초안을 확인하지 못했습니다. 기존 디자인은 유지됩니다.");
    return body;
  }
  async function perform(action: "concepts" | "prepare" | "apply") {
    if (inFlight.current || disabled) return;
    const controller = new AbortController(); inFlight.current = controller;
    setBusy(true); setMessage("");
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      if (action === "apply" && draft && selected) {
        const result = await call("/api/project-content/design-draft", { projectSlug, articleId, action: "apply", pattern: draft.pattern, concept: selected, confirmation: draft.confirmation }, controller);
        onApplied(result.composition); setDraft(null); setConcepts([]); setSelected(null); setMessage(result.message);
      } else if (action === "concepts") {
        setDraft(null); setSelected(null); setConcepts([]);
        const result = await call("/api/project-content/pattern-recommendation", { projectSlug, articleId, mode: "concepts" }, controller);
        setConcepts(result.concepts); setFallback(result.fallback); setVersion(localVersion);
      } else if (selected) {
        setDraft(null);
        const result = await call("/api/project-content/design-draft", { projectSlug, articleId, action: "prepare", pattern: selected.pattern, concept: selected }, controller);
        setVersion(localVersion); setDraft(result.draft);
      }
    } catch (error) {
      setMessage(error instanceof Error && error.name !== "AbortError" ? error.message : "요청 결과를 확인하지 못했습니다. 새로고침 후 현재 디자인을 확인해 주세요.");
    } finally { clearTimeout(timeout); inFlight.current = null; setBusy(false); }
  }
  return <div className="mt-3 min-w-0 rounded-lg border border-sky-200 p-3 [overflow-wrap:anywhere]">
    <button type="button" className="dd-btn dd-btn-primary max-w-full" style={{ whiteSpace: "normal" }} disabled={disabled || busy} onClick={() => void perform("concepts")}>
      {busy ? "처리 중…" : "디자인 콘셉트 제안받기"}
    </button>
    <p className="mt-2 text-sm text-slate-600">저장된 기사와 디자인 기준입니다. 편집 중인 설정은 먼저 저장하세요. 변경 예정 항목을 확인한 뒤에만 적용됩니다.</p>
    <div role="status" aria-live="polite" aria-busy={busy}>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
      {concepts.length ? <section className="mt-3" aria-label="디자인 콘셉트 선택">
        <p className="text-sm text-slate-600">{fallback ? "AI 분석을 완료하지 못했거나 정보가 부족해 기본 3안을 제안합니다." : "기사에 어울리는 콘셉트 3안을 제안했습니다."} 색상과 여백 방향은 안내이며, 현재 색상·본문·기존 배치를 유지합니다.</p>
        <div className="mt-3 grid min-w-0 gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }} role="group" aria-label="콘셉트 3안">
          {concepts.map(c => <button type="button" key={c.name} style={{ whiteSpace: "normal", overflowWrap: "anywhere" }} aria-pressed={selected === c} disabled={busy || disabled}
            className={`min-w-0 rounded-lg border p-3 text-left text-sm ${selected === c ? "border-sky-700 bg-sky-50 ring-2 ring-sky-700" : "border-slate-200 bg-white"}`}
            onClick={() => { setSelected(c); setDraft(null); setMessage(""); }}>
            <span className="block font-bold">{c.name}</span>
            <span className="mt-1 block">{c.description}</span>
            <span className="mt-2 block">제작 패턴: {productionPatternDescriptions[c.pattern].name}</span>
            <span className="block">분위기: {conceptDirections.visualTone[c.visualTone]}</span>
            <span className="block">구성: {conceptDirections.layoutDirection[c.layoutDirection]}</span>
            <span className="block">색상 방향: {conceptDirections.colorDirection[c.colorDirection]}</span>
            <span className="block">추천 자산: {conceptDirections.assetRole[c.assetRole]}</span>
            <span className="mt-2 block">추천 이유: {c.rationale}</span>
          </button>)}
        </div>
        {selected ? <section className="mt-3 min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label="비주얼 자산 계획">
          <h4 className="text-sm font-bold">비주얼 자산 계획</h4>
          <p className="mt-1 text-xs text-slate-600">생성·저장하지 않는 계획입니다. 글자는 HTML로 유지하고 기관 브랜드를 우선합니다. 장식·반복 무늬는 선택적인 재사용 계획이며 자동 배치하지 않습니다.</p>
          {visualAssets.length ? <ul className="mt-2 space-y-3 text-sm">
            {visualAssets.map(asset => <li key={asset.assetRole} className="min-w-0 border-t border-slate-200 pt-2">
              <p className="font-bold">{visualAssetRoles[asset.assetRole]}</p>
              <p>용도: {asset.purpose}</p>
              <p>스타일: {asset.visualStyle}</p>
              <p>크기: {asset.targetSize.width} × {asset.targetSize.height}px · {asset.aspectRatio}{asset.transparentBackground ? " · 투명 PNG" : " · 배경 포함"}</p>
              <p>Canva 사용: {asset.canvaUsage === "background" ? "배경" : asset.canvaUsage === "overlay" ? "겹쳐 쓰는 독립 자산" : "단독 이미지"}</p>
            </li>)}
          </ul> : <p className="mt-2 text-sm">현재 디자인을 유지하며 추가 이미지 자산을 계획하지 않습니다.</p>}
        </section> : null}
        {!draft ? <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="dd-btn dd-btn-primary max-w-full" style={{ whiteSpace: "normal" }} disabled={!selected || busy || disabled || stale} onClick={() => void perform("prepare")}>이 콘셉트로 초안 만들기</button>
          <button type="button" className="dd-btn dd-btn-secondary" disabled={busy} onClick={() => { setConcepts([]); setSelected(null); }}>취소</button>
        </div> : null}
        {stale && !draft ? <p className="mt-2 text-sm text-rose-800">편집 설정이 변경되었습니다. 콘셉트를 다시 제안받아 주세요.</p> : null}
      </section> : null}
      {draft ? <section className="mt-3 rounded-lg bg-sky-50 p-3" aria-label="디자인 초안 변경 예정">
        <h4 className="font-bold">추천 패턴: {productionPatternDescriptions[draft.pattern].name}</h4>
        <p className="mt-1 text-sm">{selected?.rationale}</p>
        <p className="mt-3 text-sm font-bold">변경 예정</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">{draft.changes.map(text => <li key={text}>{text}</li>)}</ul>
        <p className="mt-3 text-sm font-bold">유지되는 항목</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">{draft.preserved.map(text => <li key={text}>{text}</li>)}</ul>
        {stale ? <p className="mt-2 text-sm text-rose-800">편집 설정이 변경되었습니다. 초안을 다시 만들어 주세요.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy || disabled || stale} className="dd-btn dd-btn-primary" onClick={() => void perform("apply")}>초안 적용</button>
          <button type="button" disabled={busy} className="dd-btn dd-btn-secondary" onClick={() => { setDraft(null); setMessage(""); }}>취소</button>
        </div>
      </section> : null}
    </div>
  </div>;
}
