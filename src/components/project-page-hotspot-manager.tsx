"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectPageHotspotLink, ProjectPageImage } from "@/lib/newsletter-repository";

type ProjectPageHotspotManagerProps = {
  links: ProjectPageHotspotLink[];
  pages: ProjectPageImage[];
  projectSlug: string;
};

const linkTypes = [
  { value: "url", label: "URL" },
  { value: "video", label: "유튜브" },
  { value: "map", label: "지도" },
  { value: "phone", label: "전화" },
];

const positionPresets = [
  { label: "상단 버튼", xPercent: 12, yPercent: 12, widthPercent: 76, heightPercent: 8 },
  { label: "중앙 카드", xPercent: 10, yPercent: 42, widthPercent: 80, heightPercent: 14 },
  { label: "하단 버튼", xPercent: 12, yPercent: 82, widthPercent: 76, heightPercent: 8 },
  { label: "전체 이미지", xPercent: 0, yPercent: 0, widthPercent: 100, heightPercent: 100 },
];

const defaultForm = {
  label: "",
  type: "url",
  targetValue: "",
  xPercent: 12,
  yPercent: 82,
  widthPercent: 76,
  heightPercent: 8,
};

function linkTypeLabel(type: string) {
  return linkTypes.find((item) => item.value === type)?.label ?? type;
}

function makeHref(link: Pick<ProjectPageHotspotLink, "targetValue" | "type">) {
  if (link.type === "phone") {
    return link.targetValue.startsWith("tel:") ? link.targetValue : `tel:${link.targetValue}`;
  }

  return link.targetValue;
}

export function ProjectPageHotspotManager({ links, pages, projectSlug }: ProjectPageHotspotManagerProps) {
  const router = useRouter();
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id ?? "");
  const [form, setForm] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null;
  const selectedLinks = useMemo(
    () => links.filter((link) => link.pageId === selectedPage?.id).sort((a, b) => a.sortOrder - b.sortOrder),
    [links, selectedPage?.id],
  );

  function updateField(field: keyof typeof defaultForm, value: string | number) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateNumberField(field: "xPercent" | "yPercent" | "widthPercent" | "heightPercent", value: string) {
    const numberValue = Number(value);

    updateField(field, Number.isFinite(numberValue) ? numberValue : 0);
  }

  function applyPreset(preset: (typeof positionPresets)[number]) {
    setForm((current) => ({
      ...current,
      xPercent: preset.xPercent,
      yPercent: preset.yPercent,
      widthPercent: preset.widthPercent,
      heightPercent: preset.heightPercent,
    }));
  }

  async function handleSubmit() {
    if (!selectedPage) {
      setError("먼저 페이지 이미지를 업로드해 주세요.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/project-page-hotspots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        pageId: selectedPage.id,
        projectSlug,
        sortOrder: selectedLinks.length * 10 + 10,
      }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

    setIsSaving(false);

    if (!response.ok || !result?.ok) {
      setError(result?.message ?? "이미지 클릭 영역 저장에 실패했습니다.");
      return;
    }

    setForm(defaultForm);
    setMessage(result.message ?? "이미지 클릭 영역을 저장했습니다.");
    router.refresh();
  }

  async function handleDelete(linkId: string) {
    if (!window.confirm("이 클릭 영역을 삭제할까요?")) {
      return;
    }

    setMessage("");
    setError("");

    const response = await fetch(
      `/api/project-page-hotspots?projectSlug=${encodeURIComponent(projectSlug)}&linkId=${encodeURIComponent(linkId)}`,
      { method: "DELETE" },
    );
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setError(result?.message ?? "이미지 클릭 영역 삭제에 실패했습니다.");
      return;
    }

    setMessage(result.message ?? "이미지 클릭 영역을 삭제했습니다.");
    router.refresh();
  }

  if (pages.length === 0) {
    return (
      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">클릭 영역</p>
        <h3 className="mt-1 text-lg font-bold text-[#092046]">이미지 링크 영역 지정</h3>
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
          <p className="text-sm font-black text-[#092046]">먼저 페이지 이미지를 업로드해야 합니다.</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            페이지 이미지가 있어야 그 위에 URL, 전화, 지도, 유튜브 클릭 영역을 지정할 수 있습니다.
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">프리미엄 링크 영역</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">이미지 위 클릭 영역 지정</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            이미지 안의 버튼, 배너, 전화번호처럼 눌러야 하는 위치를 퍼센트 좌표로 저장합니다.
          </p>
        </div>
        <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]">
          {links.length}개 영역
        </span>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <label className="block text-sm font-black text-[#092046]">
            작업 페이지
            <select
              value={selectedPage?.id ?? ""}
              onChange={(event) => setSelectedPageId(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#092046] outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            >
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.pageNumber}쪽 · {page.title}
                </option>
              ))}
            </select>
          </label>

          {selectedPage?.previewHref ? (
            <div className="relative overflow-hidden rounded-lg border border-slate-300 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedPage.previewHref} alt={`${selectedPage.pageNumber}쪽 페이지 이미지`} className="w-full" />
              {selectedLinks.map((link) => (
                <a
                  key={link.id}
                  href={makeHref(link)}
                  target={link.type === "phone" ? undefined : "_blank"}
                  rel={link.type === "phone" ? undefined : "noreferrer"}
                  className="absolute rounded-md border-2 border-[#f97316] bg-orange-400/25 px-2 py-1 text-[11px] font-black text-white shadow-sm"
                  style={{
                    left: `${link.xPercent}%`,
                    top: `${link.yPercent}%`,
                    width: `${link.widthPercent}%`,
                    height: `${link.heightPercent}%`,
                  }}
                >
                  {link.label}
                </a>
              ))}
              <div
                className="pointer-events-none absolute rounded-md border-2 border-[#184a88] bg-sky-400/20"
                style={{
                  left: `${form.xPercent}%`,
                  top: `${form.yPercent}%`,
                  width: `${form.widthPercent}%`,
                  height: `${form.heightPercent}%`,
                }}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <p className="text-sm font-black text-[#092046]">선택한 페이지에 이미지가 없습니다.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[#d8e8ff] bg-[#f7fbff] p-4">
            <p className="text-sm font-black text-[#092046]">새 클릭 영역 추가</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-black text-slate-600">
                영역명
                <input
                  value={form.label}
                  onChange={(event) => updateField("label", event.target.value)}
                  placeholder="예: 신청하기"
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-[#092046]"
                />
              </label>
              <label className="block text-xs font-black text-slate-600">
                링크 종류
                <select
                  value={form.type}
                  onChange={(event) => updateField("type", event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-[#092046]"
                >
                  {linkTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-black text-slate-600">
                연결 주소
                <input
                  value={form.targetValue}
                  onChange={(event) => updateField("targetValue", event.target.value)}
                  placeholder="https://... 또는 061-000-0000"
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-[#092046]"
                />
              </label>

              <div>
                <p className="text-xs font-black text-slate-600">위치 프리셋</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {positionPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(["xPercent", "yPercent", "widthPercent", "heightPercent"] as const).map((field) => (
                  <label key={field} className="block text-xs font-black text-slate-600">
                    {field === "xPercent" ? "왼쪽 %" : field === "yPercent" ? "위쪽 %" : field === "widthPercent" ? "가로 %" : "세로 %"}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form[field]}
                      onChange={(event) => updateNumberField(field, event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-[#092046]"
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="w-full rounded-lg bg-[#092046] px-4 py-3 text-sm font-black text-white transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "저장 중" : "클릭 영역 저장"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-black text-[#092046]">선택 페이지 영역 목록</p>
            {selectedLinks.length === 0 ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-4 text-center text-sm font-bold text-slate-500">
                아직 저장된 클릭 영역이 없습니다.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {selectedLinks.map((link) => (
                  <div key={link.id} className="rounded-lg border border-slate-200 bg-[#f8fbff] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#092046]">{link.label}</p>
                        <p className="mt-1 text-xs font-bold text-[#184a88]">{linkTypeLabel(link.type)}</p>
                        <p className="mt-1 break-all text-xs leading-5 text-slate-500">{link.targetValue}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDelete(link.id)}
                        className="shrink-0 rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {message ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}
          {error ? <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
        </div>
      </div>
    </article>
  );
}
