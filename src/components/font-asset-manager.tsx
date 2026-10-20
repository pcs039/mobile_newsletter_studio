"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { FontAsset } from "@/lib/newsletter-repository";
import { FontLibraryList } from "@/components/font-library-list";
import { FontBatchUpload } from "@/components/font-batch-upload";

type SubmitState =
  | { status: "idle"; message: string }
  | { status: "saving"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type PackageUploadResult = {
  ok: true;
  family: { id: string; displayName: string; isActive: boolean };
  fonts: Array<{ fileName: string; weight: string; style: string; path: string }>;
  licenses: Array<{ fileName: string; path: string }>;
  message?: string;
};

export function FontAssetManager({ fonts }: { fonts: FontAsset[] }) {
  const router = useRouter();
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: "woff2, woff, ttf, otf 파일을 업로드할 수 있습니다.",
  });
  const [updatingFontId, setUpdatingFontId] = useState("");
  const [packageResult, setPackageResult] = useState<PackageUploadResult | null>(null);
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

  async function handlePackageUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setPackageResult(null);
    setSubmitState({ status: "saving", message: "ZIP 폰트 패키지를 업로드하고 분석하는 중입니다." });

    const response = await fetch("/api/font-packages", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as
      | PackageUploadResult
      | { ok: false; message?: string }
      | null;

    if (!response.ok || !result?.ok) {
      setSubmitState({ status: "error", message: result?.message || "ZIP 폰트 패키지 업로드에 실패했습니다." });
      return;
    }

    form.reset();
    setPackageResult(result);
    setSubmitState({ status: "success", message: result.message || "ZIP 폰트 패키지를 등록했습니다." });
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

  async function updateFamilyActive(familyId: string, isActive: boolean) {
    setUpdatingFontId(familyId);

    const response = await fetch("/api/font-packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId, isActive }),
    });
    const result = (await response.json().catch(() => null)) as { ok: boolean; message?: string } | null;

    setUpdatingFontId("");

    if (!response.ok || !result?.ok) {
      setSubmitState({ status: "error", message: result?.message || "폰트 패밀리 상태 변경에 실패했습니다." });
      return;
    }

    setSubmitState({ status: "success", message: result.message || "폰트 패밀리 상태를 변경했습니다." });
    router.refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <FontLibraryList fonts={fonts} updatingFontId={updatingFontId} onAssetActive={(font, active) => void updateActive(font, active)} onFamilyActive={(id, active) => void updateFamilyActive(id, active)} />

      <aside className="space-y-5">
        <FontBatchUpload />
        <form onSubmit={handlePackageUpload} className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">ZIP Package Upload</p>
          <h2 className="mt-1 text-xl font-black text-[#092046]">ZIP 패키지 등록</h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            ZIP 패키지는 웹폰트 사용권과 상업적 이용권이 확인된 경우에만 활성화하세요.
          </p>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#092046]">패키지 표시 글꼴명</span>
              <input name="displayName" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" placeholder="예: 무안군체" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#092046]">ZIP 파일</span>
              <input name="file" type="file" accept=".zip,application/zip" required className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#092046] file:px-4 file:py-2 file:text-sm file:font-black file:text-white" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#092046]">글꼴 유형</span>
              <select name="fontType" defaultValue="public_free" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                <option value="local_government">지자체 제공 글꼴</option>
                <option value="public_free">공공/무료 글꼴</option>
                <option value="purchased">구매 글꼴</option>
                <option value="internal">내부 전용 글꼴</option>
              </select>
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
            <div className="space-y-2 rounded-lg bg-white p-4">
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
            </div>
          </div>
          <button type="submit" disabled={submitState.status === "saving"} className="dd-btn dd-btn-primary mt-4 w-full">
            {submitState.status === "saving" ? "패키지 업로드 중..." : "ZIP 패키지 업로드"}
          </button>
          {packageResult ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              <p>{packageResult.family.displayName} · 폰트 {packageResult.fonts.length}개 등록 완료</p>
              <details className="mt-2"><summary className="cursor-pointer">등록 결과 상세</summary>
              <p className="mt-2">폰트: {packageResult.fonts.map((font) => `${font.fileName}(${font.weight}/${font.style})`).join(", ")}</p>
              <p className="mt-1">라이선스 문서: {packageResult.licenses.length > 0 ? packageResult.licenses.map((file) => file.fileName).join(", ") : "없음"}</p>
              </details>
            </div>
          ) : null}
        </form>

        <form onSubmit={handleUpload} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Admin Upload</p>
          <h2 className="mt-1 text-xl font-black text-[#092046]">개별 글꼴 등록</h2>
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
