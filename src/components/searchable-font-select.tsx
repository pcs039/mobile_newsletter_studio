"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { FontAsset } from "@/lib/newsletter-repository";
import { getFontAssetById, getFontFaceCss, getFontFamilyValue } from "@/lib/font-css";
import { getFontPickerFaces, getFontPickerFamilies, searchFontPickerFamilies } from "@/lib/font-picker";

export function SearchableFontSelect({ defaultValue, fonts, help, inheritLabel, inheritedId, preferredIds = [], label, name, form, compact = false, selectFace = false, onValueChange }: {
  form?: string;
  compact?: boolean;
  selectFace?: boolean;
  onValueChange?: (value: string) => void;
  defaultValue?: string | null;
  fonts: FontAsset[];
  help?: string;
  inheritLabel: string;
  inheritedId?: string | null;
  preferredIds?: string[];
  label: string;
  name: string;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue ?? "");
  const [expanded, setExpanded] = useState(!compact);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [load, setLoad] = useState<{ id: string; status: "loaded" | "failed" }>({ id: "", status: "loaded" });
  const groups = useMemo(() => getFontPickerFamilies(fonts, preferredIds), [fonts, preferredIds]);
  const results = useMemo(() => searchFontPickerFamilies(groups, query), [groups, query]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleResults = results.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selected = groups.find(group => group.fonts.some(font => font.id === (value || inheritedId)));
  const face = getFontAssetById(fonts, value || inheritedId);
  const unavailable = !!value && !getFontAssetById(fonts, value);
  const original = fonts.find(font => font.id === value);

  useEffect(() => {
    if (!face || !expanded) return;
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setLoad({ id: face.id, status: "failed" }); }, 10000);
    document.fonts.load(`${selectFace ? `${face.style || "normal"} ${face.weight || "400"}` : "400"} 20px ${getFontFamilyValue(face)?.split(", var(")[0]}`, "우리 지역의 새로운 소식")
      .then(loaded => { clearTimeout(timer); if (!cancelled) setLoad({ id: face.id, status: loaded.length ? "loaded" : "failed" }); })
      .catch(() => { clearTimeout(timer); if (!cancelled) setLoad({ id: face.id, status: "failed" }); });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [face, expanded, selectFace]);

  function choose(next: string) { setValue(next); onValueChange?.(next); }

  const controls = <>
      <button type="button" onClick={() => choose("")} className="text-left text-xs font-bold text-[#184a88]">{inheritLabel}으로 변경</button>
      <input id={`${id}-search`} type="search" onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="패밀리 이름 검색" className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
      <label htmlFor={`${id}-results`} className="sr-only">{label} 검색 결과</label>
      <select id={`${id}-results`} size={5} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} value={value && visibleResults.some(group => group.id === selected?.id) ? selected?.representativeId ?? "" : ""} onChange={event => { if (event.target.value) choose(event.target.value); }} className="w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" aria-describedby={`${id}-count`}>
        <option value="" disabled>패밀리를 선택하세요</option>
        {visibleResults.map(group => <option key={group.id} value={group.representativeId}>{group.preferred ? "프로젝트 기본 · " : ""}{group.label}</option>)}
      </select>
      <p id={`${id}-count`} role="status" className="text-xs text-slate-500">{results.length ? `${results.length}개 패밀리 · ${currentPage + 1}/${pageCount} 페이지` : "검색 결과가 없습니다. 다른 이름으로 검색하세요."}</p>
      {pageCount > 1 ? <nav aria-label={`${label} 결과 페이지`} className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="dd-btn dd-btn-secondary dd-btn-sm">이전 패밀리</button>
        <button type="button" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} className="dd-btn dd-btn-secondary dd-btn-sm">다음 패밀리</button>
      </nav> : null}
      {selectFace && selected ? <label className="block text-xs font-bold">등록 굵기 · 스타일<select aria-label={`${label} 굵기 · 스타일`} value={face?.id ?? ""} onChange={event => choose(event.target.value)} className="mt-1 h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2">{selected.fonts.filter((font, i, all) => all.findIndex(other => other.weight === font.weight && other.style === font.style) === i).map(font => <option key={font.id} value={font.id}>{font.weight} / {font.style} · {font.fileFormat.toUpperCase()}</option>)}</select></label> : null}
      {selected ? <p className="break-words text-xs leading-5 text-slate-600">이 패밀리에 등록된 굵기 / 스타일: {getFontPickerFaces(selected).join(" · ")}<br />{selectFace ? "실제 등록된 파일의 굵기·스타일만 선택합니다. 인위적인 굵기는 합성하지 않습니다." : "등록 정보이며 기사 굵기·기울임 선택 기능은 아닙니다. 실제 표시는 기존 제목·본문 CSS를 따릅니다."}</p> : null}
      {face ? <>
        <p className="text-xs text-slate-600">저장 참조 파일: {face.weight || "400"} / {face.style || "normal"} · {face.fileFormat.toUpperCase()} {selectFace ? "— 선택한 굵기를 HTML에 적용합니다." : "— 이 값이 기사 CSS 굵기를 변경하지는 않습니다."}</p>
        <style>{getFontFaceCss(selected?.fonts ?? [face])}</style>
        <p className="text-xs text-slate-500">{selectFace ? `미리보기 · ${face.weight} / ${face.style}` : "패밀리 미리보기 · 400 / normal · 기사 표시 굵기와 다를 수 있습니다."}</p>
        <p className="break-words rounded-lg bg-slate-50 p-3 text-xl [overflow-wrap:anywhere]" style={{ fontFamily: getFontFamilyValue(face), fontWeight: selectFace ? Number(face.weight) : 400, fontStyle: selectFace ? face.style : undefined, fontSynthesis: selectFace ? "none" : undefined }}>우리 지역의 새로운 소식</p>
        <p role="status" className="text-xs text-slate-500">{load.id !== face.id ? "글꼴 불러오는 중…" : load.status === "failed" ? "글꼴을 불러오지 못했습니다. 기본 글꼴로 보일 수 있습니다." : "선택 글꼴을 불러왔습니다. 지원하지 않는 문자는 기본 글꼴로 보일 수 있습니다."}</p>
      </> : null}
      {unavailable ? <p className="text-xs text-amber-800">비활성 또는 사용이 허용되지 않은 글꼴입니다. 공개 화면에서는 기본 글꼴로 표시될 수 있습니다.</p> : null}
      </>;

  return <div className="min-w-0 space-y-2">
      <label htmlFor={`${id}-search`} className="block text-sm font-bold text-slate-800">{label}</label>
      <input type="hidden" form={form} name={name} value={value} />
      <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">
        선택: {unavailable ? `${original?.name || "기존 글꼴"} (사용 불가 · 저장값 유지)` : value ? selected?.label : `${inheritLabel}${selected ? ` · ${selected.label}` : ""}`}
      </p>
      {compact ? <details onToggle={event => setExpanded(event.currentTarget.open)}>
        <summary className="cursor-pointer text-sm font-bold text-[#184a88]">변경</summary>
        <div className="mt-3 space-y-2">{controls}</div>
      </details> : controls}
      {help ? <p className="text-xs font-semibold leading-5 text-slate-500">{help}</p> : null}
    </div>;
}
