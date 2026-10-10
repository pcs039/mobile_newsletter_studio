"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { canvaTemplatePatterns, type CanvaTemplate, type CanvaPreviewField } from "@/lib/canva-template";
export function ArticleCanvaTemplates({ projectSlug, articleId, pattern }: { projectSlug: string; articleId: string; pattern?: unknown }) {
  const [templates, setTemplates] = useState<CanvaTemplate[]>([]);
  const [selected, setSelected] = useState("");
  const [fields, setFields] = useState<CanvaPreviewField[] | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const version = ++generation.current;
    let active = true;
    fetch(`/api/project-canva-templates?${new URLSearchParams({ projectSlug, articleId })}`).then(async r => {
      const data = await r.json(); if (!active || version !== generation.current) return;
      if (!r.ok) { setTemplates([]); setNotice(data.message || "템플릿을 불러오지 못했습니다."); return; }
      setTemplates(data.templates);
    }).catch(() => { if (active && version === generation.current) setNotice("템플릿을 불러오지 못했습니다. 기존 디자인 작업은 계속할 수 있습니다."); });
    return () => { active = false; };
  }, [projectSlug, articleId, pattern]);
  async function preview() {
    if (pending.current || !selected) return;
    const version = generation.current;
    pending.current = true; setBusy(true); setNotice(""); setFields(null);
    try {
      const r = await fetch("/api/project-canva-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", projectSlug, articleId, id: selected }) });
      const data = await r.json(); if (version !== generation.current) return;
      if (!r.ok) throw Error(data.message);
      setFields(data.fields);
    } catch (e) { if (version === generation.current) setNotice(e instanceof Error ? e.message : "미리보기를 불러오지 못했습니다."); } finally { pending.current = false; setBusy(false); }
  }
  const matches = templates.filter(t => t.productionPattern === pattern || t.productionPattern === "common");
  return <details className="my-4 min-w-0 rounded border border-slate-200 p-3"><summary className="cursor-pointer font-bold">Canva 제작 · 추천 템플릿 {matches.length}개</summary>
    <p className="mt-2 text-sm text-slate-600">현재 기사 데이터를 확인합니다. Canva 전송·디자인 적용은 실행하지 않습니다.</p>
    <Link className="text-sm text-blue-800 underline" href={`/projects/${projectSlug}/design#canva-templates`}>Canva 템플릿 관리</Link>
    <p role="status" className="my-2 text-sm">{notice}</p>
    <label className="block text-sm">템플릿 선택<select className="mt-1 w-full min-w-0 rounded border border-slate-300 p-2" value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setFields(null); }}><option value="">템플릿을 선택하세요</option>{templates.map(t => <option key={t.id} value={t.id}>{matches.includes(t) ? "추천 · " : ""}{t.name} · {canvaTemplatePatterns[t.productionPattern]}</option>)}</select></label>
    <button type="button" disabled={busy || !selected} className="mt-2 rounded bg-blue-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={() => void preview()}>{busy ? "확인 중" : "자동 입력 예정 확인"}</button>
    {fields && <section className="mt-3" aria-label="Canva 자동 입력 예정"><h4 className="font-bold">Canva 자동 입력 예정</h4>{!fields.length && <p>등록한 자동 입력 항목이 없습니다.</p>}<dl className="mt-2 space-y-2">{fields.map(f => <div key={f.field} className="min-w-0 rounded bg-slate-50 p-3"><dt className="break-all text-sm font-bold">{f.field}</dt><dd className="whitespace-pre-wrap break-words text-sm">{f.status === "missing" ? "값 없음" : f.status === "image_pending" ? "대표 이미지 있음 · Canva 이미지 변환 전" : f.text}</dd></div>)}</dl>
      <details className="mt-2 text-sm"><summary className="cursor-pointer">개발자 세부보기</summary><p>준비 데이터입니다. 이미지는 내부 참조이며 Canva asset_id가 아닙니다.</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2">{JSON.stringify({ fields }, null, 2)}</pre></details>
    </section>}
  </details>;
}
