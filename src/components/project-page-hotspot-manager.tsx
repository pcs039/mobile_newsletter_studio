"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
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

type DraftBoxField = "xPercent" | "yPercent" | "widthPercent" | "heightPercent";

type DraftBox = Pick<typeof defaultForm, DraftBoxField>;

type DragMode = "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se";

type DragState = {
  mode: DragMode;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startBox: DraftBox;
};

const minBoxSize = 3;

function linkTypeLabel(type: string) {
  return linkTypes.find((item) => item.value === type)?.label ?? type;
}

function makeHref(link: Pick<ProjectPageHotspotLink, "targetValue" | "type">) {
  if (link.type === "phone") {
    return link.targetValue.startsWith("tel:") ? link.targetValue : `tel:${link.targetValue}`;
  }

  return link.targetValue;
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function clampPercent(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, roundPercent(value)));
}

function clampDraftBox(box: DraftBox): DraftBox {
  const widthPercent = clampPercent(box.widthPercent, minBoxSize, 100);
  const heightPercent = clampPercent(box.heightPercent, minBoxSize, 100);

  return {
    widthPercent,
    heightPercent,
    xPercent: clampPercent(box.xPercent, 0, 100 - widthPercent),
    yPercent: clampPercent(box.yPercent, 0, 100 - heightPercent),
  };
}

function makeMovedBox(startBox: DraftBox, dxPercent: number, dyPercent: number) {
  return clampDraftBox({
    ...startBox,
    xPercent: startBox.xPercent + dxPercent,
    yPercent: startBox.yPercent + dyPercent,
  });
}

function makeResizedBox(startBox: DraftBox, mode: DragMode, dxPercent: number, dyPercent: number) {
  if (mode === "resize-se") {
    return clampDraftBox({
      ...startBox,
      widthPercent: startBox.widthPercent + dxPercent,
      heightPercent: startBox.heightPercent + dyPercent,
    });
  }

  if (mode === "resize-sw") {
    return clampDraftBox({
      xPercent: startBox.xPercent + dxPercent,
      yPercent: startBox.yPercent,
      widthPercent: startBox.widthPercent - dxPercent,
      heightPercent: startBox.heightPercent + dyPercent,
    });
  }

  if (mode === "resize-ne") {
    return clampDraftBox({
      xPercent: startBox.xPercent,
      yPercent: startBox.yPercent + dyPercent,
      widthPercent: startBox.widthPercent + dxPercent,
      heightPercent: startBox.heightPercent - dyPercent,
    });
  }

  return clampDraftBox({
    xPercent: startBox.xPercent + dxPercent,
    yPercent: startBox.yPercent + dyPercent,
    widthPercent: startBox.widthPercent - dxPercent,
    heightPercent: startBox.heightPercent - dyPercent,
  });
}

export function ProjectPageHotspotManager({ links, pages, projectSlug }: ProjectPageHotspotManagerProps) {
  const router = useRouter();
  const imageFrameRef = useRef<HTMLDivElement>(null);
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id ?? "");
  const [form, setForm] = useState(defaultForm);
  const [dragState, setDragState] = useState<DragState | null>(null);
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

    setForm((current) => ({
      ...current,
      ...clampDraftBox({ ...current, [field]: Number.isFinite(numberValue) ? numberValue : 0 }),
    }));
  }

  function applyPreset(preset: (typeof positionPresets)[number]) {
    setForm((current) => ({
      ...current,
      ...clampDraftBox({
        xPercent: preset.xPercent,
        yPercent: preset.yPercent,
        widthPercent: preset.widthPercent,
        heightPercent: preset.heightPercent,
      }),
    }));
  }

  function startDraftDrag(event: PointerEvent<HTMLElement>, mode: DragMode) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBox: {
        xPercent: form.xPercent,
        yPercent: form.yPercent,
        widthPercent: form.widthPercent,
        heightPercent: form.heightPercent,
      },
    });
  }

  function updateDraftDrag(event: PointerEvent<HTMLElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const frame = imageFrameRef.current;

    if (!frame) {
      return;
    }

    const rect = frame.getBoundingClientRect();
    const dxPercent = ((event.clientX - dragState.startClientX) / rect.width) * 100;
    const dyPercent = ((event.clientY - dragState.startClientY) / rect.height) * 100;
    const nextBox =
      dragState.mode === "move"
        ? makeMovedBox(dragState.startBox, dxPercent, dyPercent)
        : makeResizedBox(dragState.startBox, dragState.mode, dxPercent, dyPercent);

    setForm((current) => ({
      ...current,
      ...nextBox,
    }));
  }

  function endDraftDrag(event: PointerEvent<HTMLElement>) {
    if (dragState?.pointerId === event.pointerId) {
      setDragState(null);
    }
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
            프리셋으로 파란 박스를 만든 뒤 이미지 위에서 직접 드래그해 위치와 크기를 조정합니다.
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
            <div
              ref={imageFrameRef}
              className="relative overflow-hidden rounded-lg border border-slate-300 bg-slate-100 touch-none select-none"
            >
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
                role="button"
                tabIndex={0}
                aria-label="새 클릭 영역 위치 조정"
                onPointerDown={(event) => startDraftDrag(event, "move")}
                onPointerMove={updateDraftDrag}
                onPointerUp={endDraftDrag}
                onPointerCancel={endDraftDrag}
                className="absolute cursor-move rounded-md border-2 border-[#184a88] bg-sky-400/20 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
                style={{
                  left: `${form.xPercent}%`,
                  top: `${form.yPercent}%`,
                  width: `${form.widthPercent}%`,
                  height: `${form.heightPercent}%`,
                }}
              >
                <span className="m-1 inline-flex rounded bg-[#184a88] px-2 py-1 text-[11px] font-black text-white">
                  새 영역
                </span>
                {[
                  { mode: "resize-nw" as const, className: "-left-2 -top-2 cursor-nwse-resize" },
                  { mode: "resize-ne" as const, className: "-right-2 -top-2 cursor-nesw-resize" },
                  { mode: "resize-sw" as const, className: "-bottom-2 -left-2 cursor-nesw-resize" },
                  { mode: "resize-se" as const, className: "-bottom-2 -right-2 cursor-nwse-resize" },
                ].map((handle) => (
                  <span
                    key={handle.mode}
                    aria-hidden="true"
                    onPointerDown={(event) => startDraftDrag(event, handle.mode)}
                    onPointerMove={updateDraftDrag}
                    onPointerUp={endDraftDrag}
                    onPointerCancel={endDraftDrag}
                    className={`absolute h-4 w-4 rounded-full border-2 border-white bg-[#184a88] shadow ${handle.className}`}
                  />
                ))}
              </div>
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
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  파란 박스 안을 잡으면 이동하고, 네 모서리 점을 잡으면 크기를 조정합니다. 아래 숫자는 미세 조정용입니다.
                </p>
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
