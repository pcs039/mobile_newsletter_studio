"use client";

import { useMemo, useState } from "react";
import type { ProjectHomeSettings, PublicHomeSectionSetting } from "@/lib/newsletter-repository";

type ProjectHomeSettingsFormProps = {
  projectId: string;
  settings: ProjectHomeSettings;
};

type SaveResult =
  | {
      ok: true;
      message?: string;
      settings?: ProjectHomeSettings;
    }
  | {
      ok: false;
      message?: string;
    };

function parseRegionText(value: string) {
  return value
    .split(/[,，\n]/)
    .map((region) => region.trim())
    .filter(Boolean);
}

export function ProjectHomeSettingsForm({ projectId, settings }: ProjectHomeSettingsFormProps) {
  const [isEnabled, setIsEnabled] = useState(settings.isEnabled);
  const [regionsText, setRegionsText] = useState(settings.regions.join("\n"));
  const [sectionSettings, setSectionSettings] = useState<PublicHomeSectionSetting[]>(settings.sectionSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const regions = useMemo(() => parseRegionText(regionsText), [regionsText]);
  const orderedSections = useMemo(
    () => [...sectionSettings].sort((a, b) => a.order - b.order),
    [sectionSettings],
  );

  function updateSection(key: string, patch: Partial<PublicHomeSectionSetting>) {
    setSectionSettings((current) =>
      current.map((section) => (section.key === key ? { ...section, ...patch } : section)),
    );
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/project-home-settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectSlug: projectId,
        isEnabled,
        regions,
        sectionSettings,
      }),
    });
    const result = (await response.json().catch(() => null)) as SaveResult | null;

    setIsSaving(false);

    if (!response.ok || !result?.ok) {
      setError(result?.message ?? "첫 화면 설정 저장에 실패했습니다.");
      return;
    }

    if (result.settings) {
      setIsEnabled(result.settings.isEnabled);
      setRegionsText(result.settings.regions.join("\n"));
      setSectionSettings(result.settings.sectionSettings);
    }

    setMessage(result.message ?? "첫 화면 설정을 저장했습니다.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Public Home</p>
              <h3 className="mt-1 text-xl font-black text-[#092046]">생활수요형 첫 화면</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 [word-break:keep-all]">
                주민 관심분야와 지역 선택을 반영해 첫 화면의 기사 묶음을 자동 배치합니다.
              </p>
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-full border border-[#b8d7ff] bg-[#f4f8ff] px-4 text-sm font-black text-[#092046]">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(event) => setIsEnabled(event.currentTarget.checked)}
                className="h-4 w-4 accent-[#184a88]"
              />
              표지형 첫 화면 사용
            </label>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-[#092046]">지역 선택</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">읍면동 또는 생활권 이름을 줄바꿈으로 입력합니다.</p>
          <textarea
            value={regionsText}
            onChange={(event) => setRegionsText(event.currentTarget.value)}
            placeholder={"남양읍\n향남읍\n동탄1동"}
            className="mt-4 min-h-36 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold leading-7 text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {regions.length > 0 ? (
              regions.map((region) => (
                <span key={region} className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]">
                  {region}
                </span>
              ))
            ) : (
              <span className="text-xs font-semibold text-slate-500">지역을 입력하지 않으면 전체 지역만 표시됩니다.</span>
            )}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-[#092046]">첫 화면 섹션</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">표시 여부와 이름, 순서를 조정합니다.</p>
          <div className="mt-4 grid gap-3">
            {orderedSections.map((section) => (
              <div key={section.key} className="grid gap-3 rounded-xl border border-slate-200 bg-[#f8fbff] p-4 lg:grid-cols-[120px_minmax(0,1fr)_120px]">
                <label className="inline-flex items-center gap-2 text-sm font-black text-[#092046]">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(event) => updateSection(section.key, { enabled: event.currentTarget.checked })}
                    className="h-4 w-4 accent-[#184a88]"
                  />
                  표시
                </label>
                <input
                  value={section.label}
                  onChange={(event) => updateSection(section.key, { label: event.currentTarget.value })}
                  className="h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                />
                <input
                  type="number"
                  value={section.order}
                  onChange={(event) => updateSection(section.key, { order: Number(event.currentTarget.value) || section.order })}
                  className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  aria-label={`${section.label} 순서`}
                />
              </div>
            ))}
          </div>
        </article>

        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p> : null}
        {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</p> : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="dd-btn dd-btn-primary dd-btn-lg rounded-lg px-6 text-sm disabled:pointer-events-none disabled:opacity-60"
        >
          {isSaving ? "저장 중..." : "첫 화면 설정 저장"}
        </button>
      </section>

      <aside className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4 shadow-sm xl:sticky xl:top-6 xl:self-start">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">미리보기</p>
        <h3 className="mt-1 text-lg font-black text-[#092046]">주민 첫 화면 구성</h3>
        <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg shadow-blue-950/10">
          <div className="rounded-2xl bg-[#092046] px-4 py-4 text-white">
            <p className="text-xs font-bold text-sky-100">지역과 관심분야로 먼저 보는 소식</p>
            <h4 className="mt-1 text-xl font-black">오늘 필요한 공공정보</h4>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#092046] px-3 py-1 text-xs font-black text-white">전체</span>
            {regions.slice(0, 3).map((region) => (
              <span key={region} className="rounded-full border border-[#d8e8ff] px-3 py-1 text-xs font-black text-[#184a88]">
                {region}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {orderedSections
              .filter((section) => section.enabled)
              .slice(0, 5)
              .map((section) => (
                <div key={section.key} className="rounded-2xl border border-slate-200 bg-[#f8fbff] p-3">
                  <p className="text-sm font-black text-[#092046]">{section.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">관련 기사 2~4개가 자동 배치됩니다.</p>
                </div>
              ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
