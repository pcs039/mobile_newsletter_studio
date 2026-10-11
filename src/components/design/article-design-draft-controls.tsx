"use client";
import { useEffect, useRef, useState } from "react";
import type { ArticlePatternRecommendation } from "@/lib/article-pattern-recommendation";
import type { ArticleDesignDraft } from "@/lib/article-design-draft";
import type { ProjectArticleComposition } from "@/lib/article-composition";
import { productionPatternDescriptions } from "@/lib/article-production-pattern";

type Proposal = Pick<ArticleDesignDraft, "pattern" | "changes" | "preserved" | "placements"> & { confirmation: string };
export function ArticleDesignDraftControls({ projectSlug, articleId, disabled, composition, recommendation, onApplied }: {
  projectSlug: string; articleId: string; disabled: boolean; composition: ProjectArticleComposition;
  recommendation: ArticlePatternRecommendation | null; onApplied: (value: ProjectArticleComposition) => void;
}) {
  const [draft, setDraft] = useState<Proposal | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);
  const localVersion = JSON.stringify({ settings: composition.settings, assets: composition.assets, updated: composition.updatedAt });
  const [version, setVersion] = useState(localVersion);
  const stale = version !== localVersion;

  async function call(url: string, payload: unknown, controller: AbortController) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) throw new Error(body?.message ?? "초안을 확인하지 못했습니다. 기존 디자인은 유지됩니다.");
    return body;
  }
  async function perform(apply: boolean) {
    if (inFlight.current || disabled) return;
    const controller = new AbortController(); inFlight.current = controller;
    setBusy(true); setMessage("");
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      if (apply && draft) {
        const result = await call("/api/project-content/design-draft", { projectSlug, articleId, action: "apply", pattern: draft.pattern, confirmation: draft.confirmation }, controller);
        onApplied(result.composition); setDraft(null); setMessage(result.message);
      } else {
        setDraft(null);
        const recommended = recommendation ?? (await call("/api/project-content/pattern-recommendation", { projectSlug, articleId }, controller)).recommendation as ArticlePatternRecommendation;
        const result = await call("/api/project-content/design-draft", { projectSlug, articleId, action: "prepare", pattern: recommended.pattern }, controller);
        setVersion(localVersion); setReason(recommended.reason); setDraft(result.draft);
      }
    } catch (error) {
      setMessage(error instanceof Error && error.name !== "AbortError" ? error.message : "요청 결과를 확인하지 못했습니다. 새로고침 후 현재 디자인을 확인해 주세요.");
    } finally { clearTimeout(timeout); inFlight.current = null; setBusy(false); }
  }
  return <div className="mt-3 min-w-0 rounded-lg border border-sky-200 p-3 [overflow-wrap:anywhere]">
    <button type="button" className="dd-btn dd-btn-primary" disabled={disabled || busy} onClick={() => void perform(false)}>
      {busy ? "처리 중…" : "AI 디자인 초안 만들기"}
    </button>
    <p className="mt-2 text-sm text-slate-600">저장된 기사와 디자인 기준입니다. 편집 중인 설정은 먼저 저장하세요. 변경 예정 항목을 확인한 뒤에만 적용됩니다.</p>
    <div role="status" aria-live="polite" aria-busy={busy}>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
      {draft ? <section className="mt-3 rounded-lg bg-sky-50 p-3" aria-label="디자인 초안 변경 예정">
        <h4 className="font-bold">추천 패턴: {productionPatternDescriptions[draft.pattern].name}</h4>
        <p className="mt-1 text-sm">{reason}</p>
        <p className="mt-3 text-sm font-bold">변경 예정</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">{draft.changes.map(text => <li key={text}>{text}</li>)}</ul>
        <p className="mt-3 text-sm font-bold">유지되는 항목</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">{draft.preserved.map(text => <li key={text}>{text}</li>)}</ul>
        {stale ? <p className="mt-2 text-sm text-rose-800">편집 설정이 변경되었습니다. 초안을 다시 만들어 주세요.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy || disabled || stale} className="dd-btn dd-btn-primary" onClick={() => void perform(true)}>초안 적용</button>
          <button type="button" disabled={busy} className="dd-btn dd-btn-secondary" onClick={() => { setDraft(null); setMessage(""); }}>취소</button>
        </div>
      </section> : null}
    </div>
  </div>;
}
