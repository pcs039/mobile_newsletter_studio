"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSelectableFontAssets } from "@/lib/font-css";
import type {
  FontAsset,
  ProjectDesignKit,
  ProjectDesignKitButtonStyle,
  ProjectDesignKitIconStyle,
  ProjectDesignKitImageStyle,
} from "@/lib/newsletter-repository";

type SaveState =
  | { status: "idle"; message: string }
  | { status: "saving"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type DesignKitDraft = {
  logoUrl: string;
  logoAlt: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingFontFamily: string;
  bodyFontFamily: string;
  buttonRadius: number;
  cardRadius: number;
  buttonStyle: ProjectDesignKitButtonStyle;
  iconStyle: ProjectDesignKitIconStyle;
  imageStyle: ProjectDesignKitImageStyle;
  templateNotes: string;
};

const colorFields: Array<{ key: keyof Pick<DesignKitDraft, "primaryColor" | "secondaryColor" | "accentColor" | "backgroundColor" | "textColor">; label: string }> = [
  { key: "primaryColor", label: "대표색" },
  { key: "secondaryColor", label: "보조색" },
  { key: "accentColor", label: "강조색" },
  { key: "backgroundColor", label: "배경색" },
  { key: "textColor", label: "기본 글자색" },
];

const buttonStyleLabels: Record<ProjectDesignKitButtonStyle, string> = {
  solid: "solid",
  outline: "outline",
  soft: "soft",
};
const iconStyleLabels: Record<ProjectDesignKitIconStyle, string> = {
  outline: "outline",
  filled: "filled",
  illustration: "illustration",
};
const imageStyleLabels: Record<ProjectDesignKitImageStyle, string> = {
  photo: "photo",
  illustration: "illustration",
  mixed: "mixed",
};

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeHex(value: string, fallback: string) {
  return isHexColor(value) ? value : fallback;
}

function FieldLabel({ children }: { children: string }) {
  return <label className="mb-2 block text-sm font-black text-[#092046]">{children}</label>;
}

function getInitialDraft(designKit: ProjectDesignKit): DesignKitDraft {
  return {
    logoUrl: designKit.logoUrl,
    logoAlt: designKit.logoAlt,
    primaryColor: normalizeHex(designKit.primaryColor, "#092046"),
    secondaryColor: normalizeHex(designKit.secondaryColor, "#184a88"),
    accentColor: normalizeHex(designKit.accentColor, "#2f73b7"),
    backgroundColor: normalizeHex(designKit.backgroundColor, "#ffffff"),
    textColor: normalizeHex(designKit.textColor, "#0f172a"),
    headingFontFamily: designKit.headingFontFamily,
    bodyFontFamily: designKit.bodyFontFamily,
    buttonRadius: designKit.buttonRadius,
    cardRadius: designKit.cardRadius,
    buttonStyle: designKit.buttonStyle,
    iconStyle: designKit.iconStyle,
    imageStyle: designKit.imageStyle,
    templateNotes: designKit.templateNotes,
  };
}

function getButtonPreviewStyle(draft: DesignKitDraft) {
  if (draft.buttonStyle === "outline") {
    return {
      backgroundColor: "transparent",
      borderColor: draft.primaryColor,
      color: draft.primaryColor,
    };
  }

  if (draft.buttonStyle === "soft") {
    return {
      backgroundColor: `${draft.accentColor}22`,
      borderColor: `${draft.accentColor}55`,
      color: draft.primaryColor,
    };
  }

  return {
    backgroundColor: draft.primaryColor,
    borderColor: draft.primaryColor,
    color: "#ffffff",
  };
}

export function ProjectDesignKitForm({
  designKit,
  fonts = [],
  projectId,
}: {
  designKit: ProjectDesignKit;
  fonts?: FontAsset[];
  projectId: string;
}) {
  const router = useRouter();
  const selectableFonts = useMemo(() => getSelectableFontAssets(fonts), [fonts]);
  const [draft, setDraft] = useState<DesignKitDraft>(() => getInitialDraft(designKit));
  const [logoFailed, setLogoFailed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message: designKit.isDefault ? "기본값을 바탕으로 기관 Design Kit을 등록합니다." : "저장된 Design Kit을 수정합니다.",
  });

  function updateDraft<Key extends keyof DesignKitDraft>(key: Key, value: DesignKitDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));

    if (key === "logoUrl") {
      setLogoFailed(false);
    }
  }

  async function saveDesignKit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const invalidColor = colorFields.find((field) => !isHexColor(draft[field.key]));

    if (invalidColor) {
      setSaveState({ status: "error", message: `${invalidColor.label}은 #092046 같은 6자리 HEX 코드로 입력하세요.` });
      return;
    }

    setSaveState({ status: "saving", message: "기관 Design Kit을 저장하고 있습니다." });

    const response = await fetch("/api/project-design-kit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        ...draft,
      }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setSaveState({ status: "error", message: result?.message ?? "기관 Design Kit 저장에 실패했습니다." });
      return;
    }

    setSaveState({ status: "success", message: result.message ?? "기관 Design Kit을 저장했습니다." });
    router.refresh();
  }

  const headingFont = draft.headingFontFamily || "var(--font-app-sans, system-ui, sans-serif)";
  const bodyFont = draft.bodyFontFamily || "var(--font-app-sans, system-ui, sans-serif)";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={saveDesignKit} className="space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기관 기본 디자인</p>
          <h3 className="mt-1 text-xl font-black text-[#092046]">로고와 기본 표기</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>로고 URL</FieldLabel>
              <input
                value={draft.logoUrl}
                onChange={(event) => updateDraft("logoUrl", event.target.value)}
                placeholder="https://example.go.kr/logo.png"
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div>
              <FieldLabel>로고 설명</FieldLabel>
              <input
                value={draft.logoAlt}
                onChange={(event) => updateDraft("logoAlt", event.target.value)}
                placeholder="기관 로고"
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기관 색상</p>
          <h3 className="mt-1 text-xl font-black text-[#092046]">CI 색상 규칙</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {colorFields.map((field) => (
              <div key={field.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <FieldLabel>{field.label}</FieldLabel>
                <div className="flex gap-2">
                  <input
                    aria-label={`${field.label} 색상 선택`}
                    type="color"
                    value={isHexColor(draft[field.key]) ? draft[field.key] : "#092046"}
                    onChange={(event) => updateDraft(field.key, event.target.value)}
                    className="h-11 w-14 rounded-md border border-slate-300 bg-white p-1"
                  />
                  <input
                    value={draft[field.key]}
                    onChange={(event) => updateDraft(field.key, event.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold uppercase outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">글꼴</p>
          <h3 className="mt-1 text-xl font-black text-[#092046]">제목·본문 글꼴</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>제목 글꼴</FieldLabel>
              <select
                value={draft.headingFontFamily}
                onChange={(event) => updateDraft("headingFontFamily", event.target.value)}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              >
                <option value="">시스템 기본값</option>
                {selectableFonts.map((font) => (
                  <option key={font.id} value={font.cssFamily}>
                    {font.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>본문 글꼴</FieldLabel>
              <select
                value={draft.bodyFontFamily}
                onChange={(event) => updateDraft("bodyFontFamily", event.target.value)}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              >
                <option value="">시스템 기본값</option>
                {selectableFonts.map((font) => (
                  <option key={font.id} value={font.cssFamily}>
                    {font.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">등록 폰트가 없으면 일반 font-family 문자열 대신 시스템 기본값을 사용합니다.</p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">컴포넌트 스타일</p>
          <h3 className="mt-1 text-xl font-black text-[#092046]">버튼·카드·이미지 규칙</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>버튼 모서리</FieldLabel>
              <input
                type="number"
                min={0}
                max={40}
                value={draft.buttonRadius}
                onChange={(event) => updateDraft("buttonRadius", Number(event.target.value))}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div>
              <FieldLabel>카드 모서리</FieldLabel>
              <input
                type="number"
                min={0}
                max={48}
                value={draft.cardRadius}
                onChange={(event) => updateDraft("cardRadius", Number(event.target.value))}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div>
              <FieldLabel>버튼 스타일</FieldLabel>
              <select
                value={draft.buttonStyle}
                onChange={(event) => updateDraft("buttonStyle", event.target.value as ProjectDesignKitButtonStyle)}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              >
                {Object.entries(buttonStyleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>아이콘 스타일</FieldLabel>
              <select
                value={draft.iconStyle}
                onChange={(event) => updateDraft("iconStyle", event.target.value as ProjectDesignKitIconStyle)}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              >
                {Object.entries(iconStyleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>이미지 스타일</FieldLabel>
              <select
                value={draft.imageStyle}
                onChange={(event) => updateDraft("imageStyle", event.target.value as ProjectDesignKitImageStyle)}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              >
                {Object.entries(imageStyleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">제작 메모</p>
          <h3 className="mt-1 text-xl font-black text-[#092046]">AI 자동조판용 규칙 메모</h3>
          <textarea
            value={draft.templateNotes}
            onChange={(event) => updateDraft("templateNotes", event.target.value)}
            rows={6}
            placeholder="기관 디자인 특징, 금지 색상, CI 사용 규칙, 로고 주변 여백, 사진과 일러스트 사용 기준 등을 입력하세요."
            className="mt-5 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
          />
        </section>

        <div className="flex flex-col gap-3 rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-sm font-bold ${saveState.status === "error" ? "text-rose-700" : "text-[#184a88]"}`}>{saveState.message}</p>
          <button type="submit" disabled={saveState.status === "saving"} className="dd-btn dd-btn-primary dd-btn-lg text-sm">
            {saveState.status === "saving" ? "저장 중..." : "Design Kit 저장"}
          </button>
        </div>
      </form>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Design Kit 미리보기</p>
          <div
            className="mt-4 overflow-hidden border shadow-lg shadow-blue-950/10"
            style={{
              backgroundColor: draft.backgroundColor,
              borderColor: `${draft.secondaryColor}44`,
              borderRadius: `${draft.cardRadius}px`,
              color: draft.textColor,
              fontFamily: bodyFont,
            }}
          >
            <div className="p-4" style={{ backgroundColor: draft.primaryColor, color: "#ffffff" }}>
              {draft.logoUrl && !logoFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.logoUrl}
                  alt={draft.logoAlt || "기관 로고"}
                  onError={() => setLogoFailed(true)}
                  className="mb-3 max-h-12 max-w-[180px] rounded bg-white/95 object-contain p-2"
                />
              ) : (
                <div className="mb-3 inline-flex rounded-full bg-white/14 px-3 py-1 text-xs font-black">기관 로고 영역</div>
              )}
              <h4 className="text-2xl font-black leading-tight" style={{ fontFamily: headingFont }}>
                정책 소식
              </h4>
              <p className="mt-2 text-sm font-semibold leading-5 text-white/85">주민에게 필요한 정보를 쉽고 빠르게 안내합니다.</p>
            </div>
            <div className="space-y-3 p-4">
              <div
                className="rounded-lg border p-3"
                style={{
                  borderColor: `${draft.secondaryColor}55`,
                  borderRadius: `${draft.cardRadius}px`,
                }}
              >
                <p className="text-xs font-black" style={{ color: draft.secondaryColor }}>
                  지원 대상
                </p>
                <p className="mt-1 text-lg font-black" style={{ fontFamily: headingFont }}>
                  청년·신혼부부
                </p>
              </div>
              <div
                className="rounded-lg border p-3"
                style={{
                  borderColor: `${draft.accentColor}55`,
                  borderRadius: `${draft.cardRadius}px`,
                }}
              >
                <p className="text-xs font-black" style={{ color: draft.accentColor }}>
                  신청 기간
                </p>
                <p className="mt-1 text-base font-bold">2026.10.01 ~ 2026.10.31</p>
              </div>
              <button
                type="button"
                className="mt-1 w-full border px-4 py-3 text-sm font-black transition"
                style={{
                  ...getButtonPreviewStyle(draft),
                  borderRadius: `${draft.buttonRadius}px`,
                }}
              >
                신청하기
              </button>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-500">
            <div className="rounded-lg bg-slate-50 p-2">
              <dt>버튼</dt>
              <dd className="mt-1 text-[#092046]">{draft.buttonStyle}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <dt>아이콘</dt>
              <dd className="mt-1 text-[#092046]">{draft.iconStyle}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <dt>이미지</dt>
              <dd className="mt-1 text-[#092046]">{draft.imageStyle}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}
