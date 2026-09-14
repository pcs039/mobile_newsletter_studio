"use client";

import { useState } from "react";

export function AdminMobilePreviewFrame({ previewHref }: { previewHref: string }) {
  const [previewVersion, setPreviewVersion] = useState(0);
  const separator = previewHref.includes("?") ? "&" : "?";
  const iframeSrc = `${previewHref}${separator}previewReload=${previewVersion}`;

  return (
    <article className="admin-mobile-preview-panel rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">저장본 기준</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">모바일 미리보기</h3>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            저장된 내용을 기준으로 표시됩니다. 최종 확인은 새 탭의 실제 공개 화면에서도 진행하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewVersion((version) => version + 1)}
          className="rounded-lg border border-[#2f73b7] bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          미리보기 새로고침
        </button>
      </div>

      <div className="mt-5 mx-auto w-full max-w-[340px] rounded-[34px] border border-slate-300 bg-slate-950 p-3 shadow-xl shadow-blue-950/20">
        <div className="rounded-[26px] bg-slate-900 px-4 pb-3 pt-2">
          <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-slate-700" />
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span>9:41</span>
            <span>LTE · 100%</span>
          </div>
          <div className="overflow-hidden rounded-[22px] border border-slate-800 bg-white">
            <iframe
              key={previewVersion}
              title="저장된 모바일 소식지 미리보기"
              src={iframeSrc}
              className="h-[640px] w-full border-0 bg-white"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
