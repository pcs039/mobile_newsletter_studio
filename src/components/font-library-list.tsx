"use client";

import { useMemo, useState } from "react";
import type { FontAsset } from "@/lib/newsletter-repository";
import { filterFontLibrary, groupFontLibrary } from "@/lib/font-library-list";

export function FontLibraryList({ fonts, updatingFontId, onAssetActive, onFamilyActive }: {
  fonts: FontAsset[]; updatingFontId: string;
  onAssetActive: (font: FontAsset, active: boolean) => void;
  onFamilyActive: (id: string, active: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [order, setOrder] = useState("name");
  const [page, setPage] = useState(0);
  const groups = useMemo(() => groupFontLibrary(fonts), [fonts]);
  const results = useMemo(() => filterFontLibrary(groups, query, status, order), [groups, query, status, order]);
  const pages = Math.max(1, Math.ceil(results.length / 20)), current = Math.min(page, pages - 1);
  return <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-xl font-black text-[#092046]">등록된 폰트</h2>
    <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-sm font-bold sm:col-span-2">글꼴 이름 검색<input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} className="mt-1 h-11 w-full min-w-0 rounded border border-slate-300 px-3" placeholder="패밀리·파일 이름" /></label>
      <label className="text-sm font-bold">사용 상태<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} className="mt-1 h-11 w-full rounded border border-slate-300 px-2"><option value="all">전체</option><option value="active">사용 가능 파일 있음</option><option value="inactive">사용 가능 파일 없음</option></select></label>
      <label className="text-sm font-bold">목록 정렬<select value={order} onChange={e => { setOrder(e.target.value); setPage(0); }} className="mt-1 h-11 w-full rounded border border-slate-300 px-2"><option value="name">패밀리 이름순</option><option value="recent">최근 파일 등록순</option></select></label>
    </div>
    <p role="status" className="mt-3 text-sm text-slate-600">{results.length}개 그룹 · {current + 1}/{pages} 페이지 · 전체 {fonts.length}개 파일</p>
    <div className="mt-4 space-y-3">
      {results.slice(current * 20, (current + 1) * 20).map(group => {
        const font = group.fonts[0], family = !!font.familyId;
        const active = family ? font.familyIsActive : font.isActive;
        const allowed = family ? font.familyWebfontAllowed : font.webfontAllowed;
        return <article key={group.id} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4 [overflow-wrap:anywhere]">
          <h3 className="font-black text-[#092046]">{group.label}</h3>
          <p className="mt-1 text-xs text-slate-600">{group.fonts.length}개 파일 · {new Set(group.fonts.map(f => `${f.weight}/${f.style}`)).size}개 스타일 · 사용 가능 {group.available}개 · 최근 등록 {group.created || "정보 없음"}</p>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-bold text-[#184a88]">파일·스타일 및 기존 상태 관리</summary>
            <div className="mt-3 space-y-2">
              <p className="rounded bg-white p-3 text-xl" style={{ fontFamily: group.available ? `"${font.cssFamily}", sans-serif` : undefined }}>우리 지역의 새로운 소식</p>
              <p className="text-xs text-slate-600">{font.licenseType || "사용 조건 확인"} · {font.commercialAllowed ? "상업 사용 가능" : "상업 사용 확인 필요"} · {allowed ? "웹폰트 허용" : "웹폰트 미허용"}</p>
              <p className="text-xs text-slate-600">비활성화는 기존 발행본의 글꼴 표시에도 영향을 줄 수 있습니다. 사용 중인 글꼴은 신중히 관리하세요.</p>
              <button type="button" disabled={!allowed || updatingFontId === (family ? font.familyId : font.id)} onClick={() => family ? onFamilyActive(font.familyId, !active) : onAssetActive(font, !active)} className="dd-btn dd-btn-secondary dd-btn-sm">{family ? "패밀리 " : ""}{active ? "비활성화" : "활성화"}</button>
              {group.fonts.map(file => <p key={file.id} className="rounded bg-white p-2 text-xs">{file.sourceFileName || file.filePath.split("/").pop()} · {file.weight} / {file.style} · {file.fileFormat.toUpperCase()} · {file.isActive ? "파일 활성" : "파일 비활성"} · {file.webfontAllowed ? "웹폰트 허용" : "웹폰트 미허용"}</p>)}
            </div>
          </details>
        </article>;
      })}
      {!results.length ? <p className="py-5 text-sm text-slate-600">{fonts.length ? "검색 조건에 맞는 글꼴이 없습니다." : "등록된 폰트가 없습니다."}</p> : null}
    </div>
    {pages > 1 ? <nav aria-label="폰트 관리 목록 페이지" className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="dd-btn dd-btn-secondary">이전</button><button type="button" disabled={current === pages - 1} onClick={() => setPage(current + 1)} className="dd-btn dd-btn-secondary">다음</button></nav> : null}
  </section>;
}
