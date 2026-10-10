"use client";
import { useEffect, useState } from "react";
import { canvaTemplateTypes, canvaTemplatePatterns, canvaTemplatePurposes, canvaSources, isBlockSource, canvaBlockKind, validateCanvaTemplate, type CanvaTemplateInput, type CanvaTemplate, type CanvaMapping } from "@/lib/canva-template";
const inputClass = "w-full min-w-0 rounded border border-slate-300 bg-white p-2 text-sm text-slate-900";
const buttonClass = "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-50";
const emptyTemplate = (): CanvaTemplateInput => ({ name: "", externalId: "", templateType: "brand_template", productionPattern: "common", purpose: "card_news", isActive: true, fieldMappings: [] });
type BlockOption = { id: string; kind: string; label: string };
export function CanvaTemplateManager({ projectSlug }: { projectSlug: string }) {
  const [templates, setTemplates] = useState<CanvaTemplate[]>([]);
  const [blocks, setBlocks] = useState<BlockOption[]>([]);
  const [editing, setEditing] = useState<string | null | undefined>();
  const [draft, setDraft] = useState(emptyTemplate);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [pattern, setPattern] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(`/api/project-canva-templates?${new URLSearchParams({ projectSlug })}`).then(async r => {
      const data = await r.json();
      if (!active) return;
      if (!r.ok) { setNotice(data.message || "템플릿을 불러오지 못했습니다."); return; }
      setTemplates(data.templates); setBlocks(data.blocks); setLoaded(true);
    }).catch(() => { if (active) setNotice("템플릿을 불러오지 못했습니다."); });
    return () => { active = false; };
  }, [projectSlug, refresh]);
  function change<K extends keyof CanvaTemplateInput>(key: K, value: CanvaTemplateInput[K]) { setDraft(d => ({ ...d, [key]: value })); }
  function mapping(index: number, patch: Partial<CanvaMapping>) { change("fieldMappings", draft.fieldMappings.map((m, i) => i === index ? { ...m, ...patch } : m)); }
  async function save() {
    if (busy) return;
    try { validateCanvaTemplate(draft); } catch (e) { setNotice(e instanceof Error ? e.message : "항목을 확인하세요."); return; }
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/project-canva-templates", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectSlug, ...(editing ? { id: editing } : {}), template: draft }) });
      const data = await r.json();
      if (!r.ok) throw Error(data.message);
      setEditing(undefined); setRefresh(n => n + 1); setNotice("템플릿을 저장했습니다.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "저장하지 못했습니다."); } finally { setBusy(false); }
  }
  async function remove(template: CanvaTemplate) {
    if (busy || !window.confirm(`앱에 등록한 ‘${template.name}’을 삭제할까요? Canva 원본은 변경되지 않습니다.`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/project-canva-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectSlug, id: template.id }) });
      const data = await r.json(); if (!r.ok) throw Error(data.message);
      setRefresh(n => n + 1); if (editing === template.id) setEditing(undefined); setNotice("등록한 템플릿을 삭제했습니다.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "삭제하지 못했습니다."); } finally { setBusy(false); }
  }
  return <section className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="canva-template-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 id="canva-template-heading" className="text-xl font-black">Canva 템플릿</h3><p className="mt-1 text-sm text-slate-600">기사 데이터를 연결해 자동 입력 예정 값을 확인합니다. Canva에는 아직 전송하지 않습니다.</p></div><button type="button" className={buttonClass} disabled={!loaded || busy} onClick={() => { setEditing(null); setDraft(emptyTemplate()); setNotice(""); }}>템플릿 등록</button></div>
    <p role="status" className="text-sm">{notice}</p>
    <div className="flex flex-wrap gap-3">
      <label className="text-sm">제작 패턴 필터<select className={inputClass} value={pattern} onChange={e => setPattern(e.target.value)}><option value="">전체 패턴</option>{Object.entries(canvaTemplatePatterns).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm">용도 필터<select className={inputClass} value={purpose} onChange={e => setPurpose(e.target.value)}><option value="">전체 용도</option>{Object.entries(canvaTemplatePurposes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    {loaded && !templates.length && <p className="text-sm text-slate-600">등록한 Canva 템플릿이 없습니다.</p>}
    <ul className="space-y-2">{templates.filter(t => (!pattern || t.productionPattern === pattern) && (!purpose || t.purpose === purpose)).map(t => <li key={t.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded border border-slate-200 p-3"><div className="min-w-0 break-words"><p className="font-bold">{t.name}</p><p className="text-sm text-slate-600">{canvaTemplateTypes[t.templateType]} · {canvaTemplatePatterns[t.productionPattern]} · {canvaTemplatePurposes[t.purpose]} · {t.isActive ? "활성" : "비활성"}</p></div><div className="flex gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={() => { const { id, ...input } = t; setEditing(id); setDraft(input); setNotice(""); }}>수정</button><button type="button" className={buttonClass} disabled={busy} onClick={() => void remove(t)}>삭제</button></div></li>)}</ul>
    {editing !== undefined && <fieldset disabled={busy} className="min-w-0 space-y-4 rounded border border-sky-200 bg-sky-50 p-4"><legend className="font-bold">{editing ? "템플릿 수정" : "템플릿 등록"}</legend>
      <div className="grid gap-3 sm:grid-cols-2"><label>템플릿 이름<input className={inputClass} maxLength={120} value={draft.name} onChange={e => change("name", e.target.value)} /></label><label>Canva ID<input className={inputClass} maxLength={200} value={draft.externalId} onChange={e => change("externalId", e.target.value)} /></label>
        <label>템플릿 유형<select className={inputClass} value={draft.templateType} onChange={e => change("templateType", e.target.value as CanvaTemplateInput["templateType"])}>{Object.entries(canvaTemplateTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>제작 패턴<select className={inputClass} value={draft.productionPattern} onChange={e => change("productionPattern", e.target.value as CanvaTemplateInput["productionPattern"])}>{Object.entries(canvaTemplatePatterns).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>용도<select className={inputClass} value={draft.purpose} onChange={e => change("purpose", e.target.value as CanvaTemplateInput["purpose"])}>{Object.entries(canvaTemplatePurposes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.isActive} onChange={e => change("isActive", e.target.checked)} />활성 템플릿</label></div>
      <h4 className="font-bold">자동 입력 항목 · 기사 데이터 연결</h4><p className="text-sm text-slate-600">Canva에서 정의한 필드 이름을 입력하세요. 정보박스와 인용문은 특정 기사 블록을 선택합니다.</p>
      {draft.fieldMappings.map((m, i) => <div key={i} className="grid min-w-0 gap-2 rounded border border-slate-200 bg-white p-3 sm:grid-cols-2">
        <label>Canva 필드<input className={inputClass} maxLength={100} value={m.field} onChange={e => mapping(i, { field: e.target.value })} /></label>
        <label>입력 유형<select className={inputClass} value={m.type} onChange={e => { const type = e.target.value as CanvaMapping["type"]; const next = { field: m.field, type, source: type === "image" ? "article.primaryImage" : "article.title" } as CanvaMapping; change("fieldMappings", draft.fieldMappings.map((v, n) => n === i ? next : v)); }}><option value="text">글자</option><option value="image">이미지</option></select></label>
        <label>기사 데이터 연결<select className={inputClass} value={m.source} onChange={e => { const source = e.target.value as CanvaMapping["source"]; change("fieldMappings", draft.fieldMappings.map((v, n) => n === i ? { field: m.field, type: m.type, source, ...(isBlockSource(source) ? { blockId: "" } : {}) } : v)); }}>{Object.entries(canvaSources).filter(([source]) => (source === "article.primaryImage") === (m.type === "image")).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {isBlockSource(m.source) && <label>연결할 기사 블록<select className={inputClass} value={m.blockId || ""} onChange={e => mapping(i, { blockId: e.target.value })}><option value="">블록 선택</option>{blocks.filter(b => b.kind === canvaBlockKind(m.source)).map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>}
        <button type="button" className={buttonClass} onClick={() => change("fieldMappings", draft.fieldMappings.filter((_, n) => n !== i))}>항목 삭제</button>
      </div>)}
      <button type="button" className={buttonClass} disabled={draft.fieldMappings.length >= 40} onClick={() => change("fieldMappings", [...draft.fieldMappings, { field: "", type: "text", source: "article.title" }])}>자동 입력 항목 추가</button>
      <div className="flex gap-2"><button type="button" className="rounded bg-blue-950 px-4 py-2 font-bold text-white" onClick={() => void save()}>{busy ? "저장 중" : "템플릿 저장"}</button><button type="button" className={buttonClass} onClick={() => setEditing(undefined)}>취소</button></div>
    </fieldset>}
  </section>;
}
