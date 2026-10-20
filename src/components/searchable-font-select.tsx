"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { FontAsset } from "@/lib/newsletter-repository";
import { getFontAssetById, getFontFaceCss, getFontFamilyValue } from "@/lib/font-css";
import { getFontPickerFaces, getFontPickerFamilies, searchFontPickerFamilies } from "@/lib/font-picker";

export function SearchableFontSelect({ defaultValue, fonts, help, inheritLabel, inheritedId, preferredIds = [], label, name, form, compact = false, onValueChange }: {
  form?: string;
  compact?: boolean;
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
  const [limit, setLimit] = useState(40);
  const [load, setLoad] = useState<{ id: string; status: "loaded" | "failed" }>({ id: "", status: "loaded" });
  const groups = useMemo(() => getFontPickerFamilies(fonts, preferredIds), [fonts, preferredIds]);
  const results = useMemo(() => searchFontPickerFamilies(groups, query), [groups, query]);
  const selected = groups.find(group => group.fonts.some(font => font.id === (value || inheritedId)));
  const face = getFontAssetById(fonts, value || inheritedId);
  const unavailable = !!value && !getFontAssetById(fonts, value);
  const original = fonts.find(font => font.id === value);

  useEffect(() => {
    if (!face || !expanded) return;
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setLoad({ id: face.id, status: "failed" }); }, 10000);
    document.fonts.load(`400 20px ${getFontFamilyValue(face)?.split(", var(")[0]}`, "우리 지역의 새로운 소식")
      .then(loaded => { clearTimeout(timer); if (!cancelled) setLoad({ id: face.id, status: loaded.length ? "loaded" : "failed" }); })
      .catch(() => { clearTimeout(timer); if (!cancelled) setLoad({ id: face.id, status: "failed" }); });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [face, expanded]);

  function choose(next: string) { setValue(next); onValueChange?.(next); }

  const controls = <>
      <button type="button" onClick={() => choose("")} className="text-left text-xs font-bold text-[#184a88]">{inheritLabel}으로 변경</button>
      <input id={`${id}-search`} type="search" onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} value={query} onChange={event => { setQuery(event.target.value); setLimit(40); }} placeholder="패밀리 이름 검색" className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm" />
      <label htmlFor={`${id}-results`} className="sr-only">{label} 검색 결과</label>
      <select id={`${id}-results`} size={5} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} value={value && results.slice(0, limit).some(group => group.id === selected?.id) ? selected?.representativeId ?? "" : ""} onChange={event => { if (event.target.value) choose(event.target.value); }} className="w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" aria-describedby={`${id}-count`}>
        <option value="" disabled>패밀리를 선택하세요</option>
        {results.slice(0, limit).map(group => <option key={group.id} value={group.representativeId}>{group.preferred ? "프로젝트 기본 · " : ""}{group.label}</option>)}
      </select>
      <p id={`${id}-count`} role="status" className="text-xs text-slate-500">{results.length ? `${results.length}개 패밀리 중 ${Math.min(limit, results.length)}개 표시` : "검색 결과가 없습니다. 다른 이름으로 검색하세요."}</p>
      {results.length > limit ? <button type="button" onClick={() => setLimit(limit + 40)} className="text-xs font-bold text-[#184a88]">40개 더 보기</button> : null}
      {selected ? <p className="break-words text-xs leading-5 text-slate-600">등록된 굵기 / 스타일: {getFontPickerFaces(selected).join(" · ")}<br />패밀리를 선택하며, 실제 굵기는 기존 제목·본문 스타일을 따릅니다.</p> : null}
      {face ? <>
        <style>{getFontFaceCss(selected?.fonts ?? [face])}</style>
        <p className="break-words rounded-lg bg-slate-50 p-3 text-xl [overflow-wrap:anywhere]" style={{ fontFamily: getFontFamilyValue(face), fontWeight: 400 }}>우리 지역의 새로운 소식</p>
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
