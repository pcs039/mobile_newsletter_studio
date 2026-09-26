"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSelectableFontAssets } from "@/lib/font-css";
import type {
  FontAsset,
  ProjectDesignAsset,
  ProjectDesignAssetBackgroundMode,
  ProjectDesignAssetLanguage,
  ProjectDesignAssetVariant,
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

type LogoUploadDraft = {
  file: File | null;
  name: string;
  language: ProjectDesignAssetLanguage;
  variant: ProjectDesignAssetVariant;
  backgroundMode: ProjectDesignAssetBackgroundMode;
  altText: string;
  usageNote: string;
};

const colorFields: Array<{ key: keyof Pick<DesignKitDraft, "primaryColor" | "secondaryColor" | "accentColor" | "backgroundColor" | "textColor">; label: string }> = [
  { key: "primaryColor", label: "대표색" },
  { key: "secondaryColor", label: "보조색" },
  { key: "accentColor", label: "강조색" },
  { key: "backgroundColor", label: "배경색" },
  { key: "textColor", label: "기본 글자색" },
];

const languageLabels: Record<ProjectDesignAssetLanguage, string> = {
  ko: "국문",
  en: "영문",
  mixed: "국문+영문",
  other: "기타",
};

const variantLabels: Record<ProjectDesignAssetVariant, string> = {
  primary: "기본형",
  compact: "축약형",
  inverse: "반전형",
  symbol: "심볼형",
  other: "기타",
};

const backgroundModeLabels: Record<ProjectDesignAssetBackgroundMode, string> = {
  light: "밝은 배경용",
  dark: "어두운 배경용",
  any: "배경 무관",
};

const buttonStyleLabels: Record<ProjectDesignKitButtonStyle, string> = {
  solid: "채움형",
  outline: "테두리형",
  soft: "부드러운형",
};

const iconStyleLabels: Record<ProjectDesignKitIconStyle, string> = {
  outline: "선형",
  filled: "채움형",
  illustration: "일러스트형",
};

const imageStyleLabels: Record<ProjectDesignKitImageStyle, string> = {
  photo: "사진 중심",
  illustration: "일러스트 중심",
  mixed: "사진·일러스트 혼합",
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

function makeEmptyLogoUploadDraft(): LogoUploadDraft {
  return {
    file: null,
    name: "",
    language: "ko",
    variant: "primary",
    backgroundMode: "light",
    altText: "",
    usageNote: "",
  };
}

function getLogoDescriptor(asset: ProjectDesignAsset) {
  return `${languageLabels[asset.language]} · ${variantLabels[asset.variant]} · ${backgroundModeLabels[asset.backgroundMode]}`;
}

function getSelectedLogo(assets: ProjectDesignAsset[], legacyLogoUrl: string) {
  const primaryAsset = assets.find((asset) => asset.isPrimary && asset.isActive) ?? assets.find((asset) => asset.isActive);

  if (primaryAsset?.previewHref) {
    return {
      alt: primaryAsset.altText || primaryAsset.name,
      src: primaryAsset.previewHref,
      title: primaryAsset.name,
    };
  }

  if (legacyLogoUrl) {
    return {
      alt: "기관 로고",
      src: legacyLogoUrl,
      title: "외부 로고 URL",
    };
  }

  return null;
}

function isAllowedLogoFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExtension = ["png", "jpg", "jpeg", "webp"].includes(extension);
  const allowedMime = ["image/png", "image/jpeg", "image/webp", ""].includes(file.type);

  return file.size > 0 && file.size <= 5 * 1024 * 1024 && allowedExtension && allowedMime;
}

export function ProjectDesignKitForm({
  assets = [],
  assetsMessage = "",
  designKit,
  fonts = [],
  projectId,
}: {
  assets?: ProjectDesignAsset[];
  assetsMessage?: string;
  designKit: ProjectDesignKit;
  fonts?: FontAsset[];
  projectId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectableFonts = useMemo(() => getSelectableFontAssets(fonts), [fonts]);
  const [draft, setDraft] = useState<DesignKitDraft>(() => getInitialDraft(designKit));
  const [logoAssets, setLogoAssets] = useState<ProjectDesignAsset[]>(assets);
  const [logoFailed, setLogoFailed] = useState(false);
  const [showLogoForm, setShowLogoForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [logoDraft, setLogoDraft] = useState<LogoUploadDraft>(() => makeEmptyLogoUploadDraft());
  const [logoState, setLogoState] = useState<SaveState>({
    status: "idle",
    message: assetsMessage || "대표 로고와 추가 공식 로고를 등록할 수 있습니다.",
  });
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message: designKit.isDefault ? "처음에는 대표 로고와 대표색만 설정해도 됩니다." : "저장된 Design Kit을 수정합니다.",
  });

  function updateDraft<Key extends keyof DesignKitDraft>(key: Key, value: DesignKitDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));

    if (key === "logoUrl") {
      setLogoFailed(false);
    }
  }

  function updateLogoDraft<Key extends keyof LogoUploadDraft>(key: Key, value: LogoUploadDraft[Key]) {
    setLogoDraft((current) => ({ ...current, [key]: value }));
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

  async function uploadLogoAsset() {
    if (!logoDraft.file) {
      setLogoState({ status: "error", message: "업로드할 로고 파일을 선택하세요." });
      return;
    }

    if (!isAllowedLogoFile(logoDraft.file)) {
      setLogoState({ status: "error", message: "PNG, JPG, WebP 파일만 5MB까지 업로드할 수 있습니다." });
      return;
    }

    setLogoState({ status: "saving", message: "로고 파일을 업로드하고 있습니다." });

    const formData = new FormData();
    formData.set("projectSlug", projectId);
    formData.set("file", logoDraft.file);
    formData.set("name", logoDraft.name || logoDraft.file.name.replace(/\.[^.]+$/, ""));
    formData.set("language", logoDraft.language);
    formData.set("variant", logoDraft.variant);
    formData.set("backgroundMode", logoDraft.backgroundMode);
    formData.set("altText", logoDraft.altText);
    formData.set("usageNote", logoDraft.usageNote);

    const response = await fetch("/api/project-design-kit/assets", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; assets?: ProjectDesignAsset[]; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setLogoState({ status: "error", message: result?.message ?? "로고 업로드에 실패했습니다." });
      return;
    }

    setLogoAssets(result.assets ?? []);
    setLogoDraft(makeEmptyLogoUploadDraft());
    setShowLogoForm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setLogoState({ status: "success", message: result.message ?? "로고 자산을 등록했습니다." });
    setLogoFailed(false);
    router.refresh();
  }

  async function updateLogoAsset(assetId: string, payload: Record<string, unknown>) {
    setLogoState({ status: "saving", message: "로고 정보를 저장하고 있습니다." });

    const response = await fetch("/api/project-design-kit/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectSlug: projectId,
        assetId,
        ...payload,
      }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; assets?: ProjectDesignAsset[]; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setLogoState({ status: "error", message: result?.message ?? "로고 정보를 저장하지 못했습니다." });
      return;
    }

    setLogoAssets(result.assets ?? []);
    setLogoState({ status: "success", message: result.message ?? "로고 정보를 저장했습니다." });
    setLogoFailed(false);
    router.refresh();
  }

  async function deleteLogoAsset(asset: ProjectDesignAsset) {
    if (!window.confirm(`${asset.name} 로고를 삭제하시겠습니까?\nStorage 원본 파일과 자산 기록이 함께 삭제됩니다.`)) {
      return;
    }

    setLogoState({ status: "saving", message: "로고를 삭제하고 있습니다." });

    const params = new URLSearchParams({ projectSlug: projectId, assetId: asset.id });
    const response = await fetch(`/api/project-design-kit/assets?${params.toString()}`, {
      method: "DELETE",
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; assets?: ProjectDesignAsset[]; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setLogoState({ status: "error", message: result?.message ?? "로고 삭제에 실패했습니다." });
      return;
    }

    setLogoAssets(result.assets ?? []);
    setLogoState({ status: "success", message: result.message ?? "로고 자산을 삭제했습니다." });
    router.refresh();
  }

  const headingFont = draft.headingFontFamily || "var(--font-app-sans, system-ui, sans-serif)";
  const bodyFont = draft.bodyFontFamily || "var(--font-app-sans, system-ui, sans-serif)";
  const selectedLogo = getSelectedLogo(logoAssets, draft.logoUrl);
  const primaryLogo = logoAssets.find((asset) => asset.isPrimary && asset.isActive);
  const otherLogos = logoAssets.filter((asset) => asset.id !== primaryLogo?.id);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={saveDesignKit} className="space-y-5">
        <section className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기본 설정</p>
          <h3 className="mt-1 text-xl font-black text-[#092046]">대표 로고와 대표색만 먼저 정해도 됩니다.</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
            처음에는 대표 로고와 대표색만 설정해도 됩니다. 나머지 항목은 필요할 때 추가로 조정할 수 있습니다.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-lg border border-white bg-white p-4">
              <p className="text-sm font-black text-[#092046]">대표 로고</p>
              <div className="mt-3 flex min-h-28 items-center justify-center rounded-lg border border-dashed border-[#b8d7ff] bg-[#f7fbff] p-4">
                {selectedLogo && !logoFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedLogo.src}
                    alt={selectedLogo.alt}
                    onError={() => setLogoFailed(true)}
                    className="max-h-20 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-400">대표 로고 없음</span>
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">{selectedLogo?.title ?? "아래에서 로고를 추가하면 대표 로고로 사용할 수 있습니다."}</p>
            </div>
            <div className="rounded-lg border border-white bg-white p-4">
              <FieldLabel>대표색</FieldLabel>
              <div className="flex gap-2">
                <input
                  aria-label="대표색 선택"
                  type="color"
                  value={isHexColor(draft.primaryColor) ? draft.primaryColor : "#092046"}
                  onChange={(event) => updateDraft("primaryColor", event.target.value)}
                  className="h-11 w-14 rounded-md border border-slate-300 bg-white p-1"
                />
                <input
                  value={draft.primaryColor}
                  onChange={(event) => updateDraft("primaryColor", event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold uppercase outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                />
              </div>
              <FieldLabel>보조색</FieldLabel>
              <div className="flex gap-2">
                <input
                  aria-label="보조색 선택"
                  type="color"
                  value={isHexColor(draft.secondaryColor) ? draft.secondaryColor : "#184a88"}
                  onChange={(event) => updateDraft("secondaryColor", event.target.value)}
                  className="h-11 w-14 rounded-md border border-slate-300 bg-white p-1"
                />
                <input
                  value={draft.secondaryColor}
                  onChange={(event) => updateDraft("secondaryColor", event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold uppercase outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">로고 자산</p>
              <h3 className="mt-1 text-xl font-black text-[#092046]">공식 로고 관리</h3>
              <p className="mt-2 text-sm font-semibold text-slate-500">필요한 만큼 국문·영문·반전형 로고를 추가하고 대표 로고를 지정합니다.</p>
            </div>
            <button type="button" onClick={() => setShowLogoForm((value) => !value)} className="dd-btn dd-btn-secondary dd-btn-sm border-[#b8d7ff] text-[#092046]">
              + 로고 추가
            </button>
          </div>

          <p className={`mt-4 rounded-lg px-3 py-2 text-xs font-bold ${logoState.status === "error" ? "bg-rose-50 text-rose-700" : "bg-[#f7fbff] text-[#184a88]"}`}>
            {logoState.message}
          </p>

          {showLogoForm ? (
            <div className="mt-4 rounded-lg border border-[#d8e8ff] bg-[#f7fbff] p-4">
              <FieldLabel>로고 파일</FieldLabel>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  updateLogoDraft("file", file);
                  if (file && !logoDraft.name) {
                    updateLogoDraft("name", file.name.replace(/\.[^.]+$/, ""));
                  }
                }}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-2 text-xs font-semibold text-slate-500">PNG, JPG, WebP 파일을 5MB까지 업로드할 수 있습니다. 투명 배경 PNG 또는 WebP를 권장합니다.</p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <FieldLabel>로고 이름</FieldLabel>
                  <input
                    value={logoDraft.name}
                    onChange={(event) => updateLogoDraft("name", event.target.value)}
                    placeholder="국문 기본형"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <div>
                  <FieldLabel>대체 텍스트</FieldLabel>
                  <input
                    value={logoDraft.altText}
                    onChange={(event) => updateLogoDraft("altText", event.target.value)}
                    placeholder="화성시 로고"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <div>
                  <FieldLabel>언어</FieldLabel>
                  <select value={logoDraft.language} onChange={(event) => updateLogoDraft("language", event.target.value as ProjectDesignAssetLanguage)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">
                    {Object.entries(languageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>형태</FieldLabel>
                  <select value={logoDraft.variant} onChange={(event) => updateLogoDraft("variant", event.target.value as ProjectDesignAssetVariant)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">
                    {Object.entries(variantLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>배경 용도</FieldLabel>
                  <select value={logoDraft.backgroundMode} onChange={(event) => updateLogoDraft("backgroundMode", event.target.value as ProjectDesignAssetBackgroundMode)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">
                    {Object.entries(backgroundModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>사용 메모</FieldLabel>
                  <input
                    value={logoDraft.usageNote}
                    onChange={(event) => updateLogoDraft("usageNote", event.target.value)}
                    placeholder="헤더, 어두운 배경 등"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={uploadLogoAsset} disabled={logoState.status === "saving"} className="dd-btn dd-btn-primary dd-btn-sm">
                  {logoState.status === "saving" ? "업로드 중..." : "로고 등록"}
                </button>
                <button type="button" onClick={() => setShowLogoForm(false)} className="dd-btn dd-btn-secondary dd-btn-sm border-slate-300">
                  닫기
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {primaryLogo ? (
              <LogoAssetCard
                asset={primaryLogo}
                badge="대표"
                onDelete={deleteLogoAsset}
                onSetPrimary={(asset) => updateLogoAsset(asset.id, { isPrimary: true })}
                onUpdate={(asset, payload) => updateLogoAsset(asset.id, payload)}
              />
            ) : null}
            {otherLogos.map((asset) => (
              <LogoAssetCard
                key={asset.id}
                asset={asset}
                onDelete={deleteLogoAsset}
                onSetPrimary={(item) => updateLogoAsset(item.id, { isPrimary: true })}
                onUpdate={(item, payload) => updateLogoAsset(item.id, payload)}
              />
            ))}
            {logoAssets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-500">
                등록된 로고가 없습니다. + 로고 추가로 공식 로고 자산을 등록하세요.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">색상과 글꼴</p>
          <h3 className="mt-1 text-xl font-black text-[#092046]">기관 색상·글꼴</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {colorFields.filter((field) => field.key !== "primaryColor" && field.key !== "secondaryColor").map((field) => (
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
            <div>
              <FieldLabel>제목 글꼴</FieldLabel>
              <select value={draft.headingFontFamily} onChange={(event) => updateDraft("headingFontFamily", event.target.value)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                <option value="">시스템 기본값</option>
                {selectableFonts.map((font) => <option key={font.id} value={font.cssFamily}>{font.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>본문 글꼴</FieldLabel>
              <select value={draft.bodyFontFamily} onChange={(event) => updateDraft("bodyFontFamily", event.target.value)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                <option value="">시스템 기본값</option>
                {selectableFonts.map((font) => <option key={font.id} value={font.cssFamily}>{font.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        <details open={showAdvanced} onToggle={(event) => setShowAdvanced(event.currentTarget.open)} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-xl font-black text-[#092046]">세부 스타일 설정</summary>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>버튼 모서리 둥글기</FieldLabel>
              <input type="number" min={0} max={40} value={draft.buttonRadius} onChange={(event) => updateDraft("buttonRadius", Number(event.target.value))} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" />
            </div>
            <div>
              <FieldLabel>카드 모서리 둥글기</FieldLabel>
              <input type="number" min={0} max={48} value={draft.cardRadius} onChange={(event) => updateDraft("cardRadius", Number(event.target.value))} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" />
            </div>
            <div>
              <FieldLabel>버튼 스타일</FieldLabel>
              <select value={draft.buttonStyle} onChange={(event) => updateDraft("buttonStyle", event.target.value as ProjectDesignKitButtonStyle)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                {Object.entries(buttonStyleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>아이콘 스타일</FieldLabel>
              <select value={draft.iconStyle} onChange={(event) => updateDraft("iconStyle", event.target.value as ProjectDesignKitIconStyle)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                {Object.entries(iconStyleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>이미지 스타일</FieldLabel>
              <select value={draft.imageStyle} onChange={(event) => updateDraft("imageStyle", event.target.value as ProjectDesignKitImageStyle)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                {Object.entries(imageStyleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
        </details>

        <details open={showNotes} onToggle={(event) => setShowNotes(event.currentTarget.open)} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-xl font-black text-[#092046]">제작 메모</summary>
          <textarea value={draft.templateNotes} onChange={(event) => updateDraft("templateNotes", event.target.value)} rows={5} placeholder="기관 디자인 특징, 금지 색상, CI 사용 규칙, 로고 주변 여백 등을 입력하세요." className="mt-5 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" />
        </details>

        <details className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-lg font-black text-[#092046]">고급 설정 · 외부 로고 URL</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>외부 로고 URL</FieldLabel>
              <input value={draft.logoUrl} onChange={(event) => updateDraft("logoUrl", event.target.value)} placeholder="https://example.go.kr/logo.png" className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" />
            </div>
            <div>
              <FieldLabel>외부 로고 설명</FieldLabel>
              <input value={draft.logoAlt} onChange={(event) => updateDraft("logoAlt", event.target.value)} placeholder="기관 로고" className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100" />
            </div>
          </div>
        </details>

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
          <div className="mt-4 overflow-hidden border shadow-lg shadow-blue-950/10" style={{ backgroundColor: draft.backgroundColor, borderColor: `${draft.secondaryColor}44`, borderRadius: `${draft.cardRadius}px`, color: draft.textColor, fontFamily: bodyFont }}>
            <div className="p-4" style={{ backgroundColor: draft.primaryColor, color: "#ffffff" }}>
              {selectedLogo && !logoFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedLogo.src} alt={selectedLogo.alt} onError={() => setLogoFailed(true)} className="mb-3 max-h-12 max-w-[190px] rounded bg-white/95 object-contain p-2" />
              ) : (
                <div className="mb-3 inline-flex rounded-full bg-white/14 px-3 py-1 text-xs font-black">기관 로고 영역</div>
              )}
              <h4 className="text-2xl font-black leading-tight" style={{ fontFamily: headingFont }}>정책 소식</h4>
              <p className="mt-2 text-sm font-semibold leading-5 text-white/85">주민에게 필요한 정보를 쉽고 빠르게 안내합니다.</p>
            </div>
            <div className="space-y-3 p-4">
              <div className="rounded-lg border p-3" style={{ borderColor: `${draft.secondaryColor}55`, borderRadius: `${draft.cardRadius}px` }}>
                <p className="text-xs font-black" style={{ color: draft.secondaryColor }}>지원 대상</p>
                <p className="mt-1 text-lg font-black" style={{ fontFamily: headingFont }}>청년·신혼부부</p>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: `${draft.accentColor}55`, borderRadius: `${draft.cardRadius}px` }}>
                <p className="text-xs font-black" style={{ color: draft.accentColor }}>신청 기간</p>
                <p className="mt-1 text-base font-bold">2026.10.01 ~ 2026.10.31</p>
              </div>
              <button type="button" className="mt-1 w-full border px-4 py-3 text-sm font-black transition" style={{ ...getButtonPreviewStyle(draft), borderRadius: `${draft.buttonRadius}px` }}>
                신청하기
              </button>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-500">
            <div className="rounded-lg bg-slate-50 p-2"><dt>버튼</dt><dd className="mt-1 text-[#092046]">{buttonStyleLabels[draft.buttonStyle]}</dd></div>
            <div className="rounded-lg bg-slate-50 p-2"><dt>아이콘</dt><dd className="mt-1 text-[#092046]">{iconStyleLabels[draft.iconStyle]}</dd></div>
            <div className="rounded-lg bg-slate-50 p-2"><dt>이미지</dt><dd className="mt-1 text-[#092046]">{imageStyleLabels[draft.imageStyle]}</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  );
}

function LogoAssetCard({
  asset,
  badge,
  onDelete,
  onSetPrimary,
  onUpdate,
}: {
  asset: ProjectDesignAsset;
  badge?: string;
  onDelete: (asset: ProjectDesignAsset) => void;
  onSetPrimary: (asset: ProjectDesignAsset) => void;
  onUpdate: (asset: ProjectDesignAsset, payload: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: asset.name,
    language: asset.language,
    variant: asset.variant,
    backgroundMode: asset.backgroundMode,
    altText: asset.altText,
    usageNote: asset.usageNote,
  });

  return (
    <article className={`rounded-lg border p-4 ${asset.isPrimary ? "border-[#2f73b7] bg-[#f7fbff]" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex h-24 w-full items-center justify-center rounded-lg border border-slate-200 bg-white p-3 md:w-40">
          {asset.previewHref ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.previewHref} alt={asset.altText || asset.name} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs font-bold text-slate-400">미리보기 없음</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-black text-[#092046]">{asset.name}</h4>
            {badge ? <span className="rounded-full bg-[#092046] px-2 py-1 text-xs font-black text-white">{badge}</span> : null}
            {!asset.isActive ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">비활성</span> : null}
          </div>
          <p className="mt-1 text-sm font-bold text-slate-500">{getLogoDescriptor(asset)}</p>
          {asset.usageNote ? <p className="mt-1 text-xs font-semibold text-slate-400">{asset.usageNote}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {asset.isPrimary ? null : <button type="button" onClick={() => onSetPrimary(asset)} className="dd-btn dd-btn-sm dd-btn-primary">대표 로고로 지정</button>}
            <button type="button" onClick={() => setEditing((value) => !value)} className="dd-btn dd-btn-sm dd-btn-secondary border-slate-300">설정</button>
            <button type="button" onClick={() => onUpdate(asset, { isActive: !asset.isActive })} className="dd-btn dd-btn-sm dd-btn-secondary border-slate-300">
              {asset.isActive ? "비활성화" : "활성화"}
            </button>
            <button type="button" onClick={() => onDelete(asset)} className="dd-btn dd-btn-sm border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">삭제</button>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
          <div>
            <FieldLabel>로고 이름</FieldLabel>
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
          <div>
            <FieldLabel>대체 텍스트</FieldLabel>
            <input value={draft.altText} onChange={(event) => setDraft((current) => ({ ...current, altText: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
          <div>
            <FieldLabel>언어</FieldLabel>
            <select value={draft.language} onChange={(event) => setDraft((current) => ({ ...current, language: event.target.value as ProjectDesignAssetLanguage }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold">
              {Object.entries(languageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>형태</FieldLabel>
            <select value={draft.variant} onChange={(event) => setDraft((current) => ({ ...current, variant: event.target.value as ProjectDesignAssetVariant }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold">
              {Object.entries(variantLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>배경 용도</FieldLabel>
            <select value={draft.backgroundMode} onChange={(event) => setDraft((current) => ({ ...current, backgroundMode: event.target.value as ProjectDesignAssetBackgroundMode }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold">
              {Object.entries(backgroundModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>사용 메모</FieldLabel>
            <input value={draft.usageNote} onChange={(event) => setDraft((current) => ({ ...current, usageNote: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button type="button" onClick={() => {
              onUpdate(asset, draft);
              setEditing(false);
            }} className="dd-btn dd-btn-sm dd-btn-primary">
              설정 저장
            </button>
            <button type="button" onClick={() => setEditing(false)} className="dd-btn dd-btn-sm dd-btn-secondary border-slate-300">
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
