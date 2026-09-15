"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { FontAsset } from "@/lib/newsletter-repository";

type SubmitState =
  | { status: "idle"; message: string }
  | { status: "saving"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function formatLicense(font: FontAsset) {
  return [font.licenseType, font.commercialAllowed ? "상업 사용 가능" : "상업 사용 확인 필요", font.webfontAllowed ? "웹폰트 허용" : "웹폰트 미허용"]
    .filter(Boolean)
    .join(" · ");
}

export function FontAssetManager({ fonts }: { fonts: FontAsset[] }) {
  const router = useRouter();
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: "woff2, woff, ttf, otf 파일을 업로드할 수 있습니다.",
  });
  const [updatingFontId, setUpdatingFontId] = useState("");

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setSubmitState({ status: "saving", message: "폰트를 업로드하는 중입니다." });

    const response = await fetch("/api/font-assets", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as { ok: boolean; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setSubmitState({ status: "error", message: result?.message || "폰트 업로드에 실패했습니다." });
      return;
    }

    form.reset();
    setSubmitState({ status: "success", message: result.message || "폰트를 업로드했습니다." });
    router.refresh();
  }

  async function updateActive(font: FontAsset, isActive: boolean) {
    setUpdatingFontId(font.id);

    const response = await fetch("/api/font-assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: font.id, isActive }),
    });
    const result = (await response.json().catch(() => null)) as { ok: boolean; message?: string } | null;

    setUpdatingFontId("");

    if (!response.ok || !result?.ok) {
      setSubmitState({ status: "error", message: result?.message || "폰트 상태 변경에 실패했습니다." });
      return;
    }

    setSubmitState({ status: "success", message: result.message || "폰트 상태를 변경했습니다." });
    router.refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Font Library</p>
            <h2 className="mt-1 text-xl font-black text-[#092046]">등록된 폰트</h2>
          </div>
          <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]">{fonts.length}개</span>
        </div>

        <div className="mt-5 space-y-3">
          {fonts.length > 0 ? (
            fonts.map((font) => (
              <article key={font.id} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-base font-black text-[#092046]">{font.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{formatLicense(font)}</p>
                    <p className="mt-2 break-all text-xs font-semibold text-slate-500">{font.filePath}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        font.isActive && font.webfontAllowed
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {font.isActive && font.webfontAllowed ? "사용 가능" : "비활성"}
                    </span>
                    <button
                      type="button"
                      disabled={!font.webfontAllowed || updatingFontId === font.id}
                      onClick={() => updateActive(font, !font.isActive)}
                      className="dd-btn dd-btn-secondary dd-btn-sm"
                    >
                      {font.isActive ? "비활성화" : "활성화"}
                    </button>
                  </div>
                </div>
                <p className="mt-4 rounded-lg bg-white px-4 py-3 text-xl font-black text-[#092046]" style={{ fontFamily: font.isActive ? `"${font.cssFamily}", sans-serif` : undefined }}>
                  가나다라마바사 ABC 123
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-[#b8d7ff] bg-[#f7fbff] px-4 py-8 text-center">
              <p className="text-sm font-black text-[#092046]">등록된 폰트가 없습니다.</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">오른쪽 업로드 영역에서 폰트를 추가하세요.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-5">
        <form onSubmit={handleUpload} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Admin Upload</p>
          <h2 className="mt-1 text-xl font-black text-[#092046]">폰트 업로드</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#092046]">폰트 파일</span>
              <input name="file" type="file" accept=".woff2,.woff,.ttf,.otf,font/*" required className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#092046] file:px-4 file:py-2 file:text-sm file:font-black file:text-white" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#092046]">표시 이름</span>
              <input name="fontName" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" placeholder="예: Pretendard" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#092046]">원래 font-family</span>
              <input name="fontFamily" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" placeholder="예: Pretendard" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#092046]">굵기</span>
                <input name="fontWeight" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" placeholder="400" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#092046]">스타일</span>
                <select name="fontStyle" defaultValue="normal" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                  <option value="normal">normal</option>
                  <option value="italic">italic</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#092046]">라이선스 유형</span>
              <input name="licenseType" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" placeholder="예: OFL, 구매 라이선스" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#092046]">라이선스 URL</span>
              <input name="licenseUrl" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" placeholder="https://..." />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#092046]">라이선스 메모</span>
              <textarea name="licenseNote" className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" placeholder="사용 범위와 출처를 짧게 남깁니다." />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#092046]">출처 표기 문구</span>
              <input name="attributionText" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" placeholder="예: Font by ..." />
            </label>
            <div className="space-y-2 rounded-lg bg-[#f7fbff] p-4">
              {[
                ["webfontAllowed", "웹폰트 사용 허용"],
                ["commercialAllowed", "상업/납품 사용 허용"],
                ["redistributionAllowed", "재배포 허용"],
                ["attributionRequired", "출처 표기 필요"],
                ["isActive", "업로드 후 바로 활성화"],
              ].map(([name, label]) => (
                <label key={name} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input name={name} type="checkbox" className="h-4 w-4 accent-[#092046]" />
                  {label}
                </label>
              ))}
              <p className="text-xs font-semibold leading-5 text-slate-500">
                웹폰트 사용 허용이 꺼져 있으면 바로 활성화할 수 없습니다.
              </p>
            </div>
          </div>
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-xs font-bold ${
              submitState.status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : submitState.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {submitState.message}
          </div>
          <button type="submit" disabled={submitState.status === "saving"} className="dd-btn dd-btn-primary mt-4 w-full">
            {submitState.status === "saving" ? "업로드 중..." : "폰트 업로드"}
          </button>
        </form>
      </aside>
    </div>
  );
}
