"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ArticleMotionPreviewCard } from "@/components/article-motion-preview-card";
import { ProjectFileDownloadLink } from "@/components/project-file-download-link";
import { StatusPill } from "@/components/status-pill";
import { getSelectableFontAssets } from "@/lib/font-css";
import {
  detectLongKoreanTitleTokens,
  getDisplayArticleTitle,
  renderKoreanTitleWithBreaks,
} from "@/lib/korean-title-breaks";
import type {
  ArticleElementMotionEffect,
  ArticleElementMotionSpeed,
  ArticleMotionPreset,
  ArticleMotionSpeed,
  ArticlePublicInfoType,
  FontAsset,
  ArticleTextAlignment,
  ArticleUrgency,
  ProjectAssetFile,
  ProjectContentArticle,
  ProjectContentBlock,
  ProjectPageImage,
  ProjectSurveyItem,
} from "@/lib/newsletter-repository";

type ProjectArticleEditorFormProps = {
  projectSlug: string;
  pages: ProjectPageImage[];
  surveys?: ProjectSurveyItem[];
  assets: ProjectAssetFile[];
  fonts?: FontAsset[];
  projectBodyFontAssetId?: string | null;
  projectTitleFontAssetId?: string | null;
  projectPageCount?: number;
  article: ProjectContentArticle | null;
};

type EditorBlockType = Extract<
  ProjectContentBlock["type"],
  "paragraph" | "image" | "video_link" | "map_link" | "button_group" | "audio"
>;

type EditorBlock = {
  id: string;
  type: EditorBlockType;
  title: string;
  body: string;
  textAlignment: ArticleTextAlignment;
};

type ImportedWordResponse =
  | {
      ok: true;
      imported: {
        title: string;
        summary: string;
        blocks: Array<{
          type: "paragraph" | "video_link" | "button_group";
          title: string;
          body: string;
          sortOrder: number;
        }>;
      };
    }
  | {
      ok: false;
      message?: string;
    };

type ProjectFileUploadResponse =
  | {
      ok: true;
      bucket: string;
      fileName: string;
      message?: string;
      mimeType: string;
      path: string;
      size: number;
      uploadUrl?: string;
    }
  | {
      ok: false;
      message?: string;
    };

type ArticleAudioSourceInput = "uploaded" | "ai_tts" | "none";
type ArticleTtsVoiceInput = "marin" | "cedar" | "onyx" | "coral";
type ArticlePayload = {
  articleId: string;
  articleTtsVoice: string;
  audioSource: string;
  body: string;
  bodyAlignment: string;
  bodyFontAssetId: string;
  buttonFontAssetId: string;
  captionFontAssetId: string;
  contactName: string;
  contactPhone: string;
  contentBlocks: Array<{
    body: string;
    sortOrder: number;
    textAlignment: ArticleTextAlignment;
    title: string;
    type: EditorBlockType;
  }>;
  displayTitle: string;
  imageMotionEffect: string;
  imageMotionSpeed: string;
  institutionPriority: number;
  interestTags: string[];
  linkMotionEffect: string;
  linkMotionSpeed: string;
  motionPreset: string;
  motionSpeed: string;
  pageId: string;
  projectSlug: string;
  sortOrder: number;
  sourcePageNumber: number;
  status: string;
  summary: string;
  summaryAlignment: string;
  surveyId: string;
  textAlignment: string;
  textBoxMotionEffect: string;
  textBoxMotionSpeed: string;
  title: string;
  titleAlignment: string;
  titleFontAssetId: string;
  titleMotionEffect: string;
  titleMotionSpeed: string;
  articleType: string;
  urgency: string;
  validFrom: string;
  validUntil: string;
};

const articleStatuses = [
  { value: "draft", label: "작성 중" },
  { value: "review", label: "검수 요청" },
  { value: "needs_revision", label: "수정 필요" },
  { value: "approved", label: "검수 완료" },
  { value: "published", label: "발행 반영" },
];

const articleMotionPresetOptions: Array<{ value: ArticleMotionPreset; label: string; description: string }> = [
  { value: "none", label: "기본형", description: "효과를 거의 사용하지 않습니다." },
  { value: "calm", label: "단정한 등장형", description: "제목과 요약이 부드럽게 나타납니다." },
  { value: "image_focus", label: "이미지 강조형", description: "이미지가 선명하게 드러나도록 강조합니다." },
  { value: "promotion", label: "홍보형", description: "제목과 버튼을 조금 더 눈에 띄게 보여줍니다." },
  { value: "dynamic", label: "모션 강화형", description: "제목 글자가 순차적으로 등장하고 이미지도 부드럽게 표시됩니다." },
];

const articleMotionSpeedOptions: Array<{ value: ArticleMotionSpeed; label: string; description: string }> = [
  { value: "slow", label: "느리게", description: "차분한 보고형 소식지에 적합합니다." },
  { value: "normal", label: "기본", description: "일반 모바일 소식지에 적합합니다." },
  { value: "fast", label: "빠르게", description: "홍보·행사 안내형 콘텐츠에 적합합니다." },
];

const articleTextAlignmentOptions: Array<{ value: ArticleTextAlignment; label: string }> = [
  { value: "left", label: "왼쪽 정렬" },
  { value: "center", label: "가운데 정렬" },
  { value: "right", label: "오른쪽 정렬" },
  { value: "justify", label: "양쪽 정렬" },
];

const recommendedInterestTags = [
  "건강·복지",
  "생활·민원",
  "교통·도시",
  "청년·일자리",
  "교육·돌봄",
  "문화·축제",
  "관광",
  "농업·귀농",
  "기업·산업",
  "우리동네",
  "시정·군정 주요소식",
];

const articlePublicInfoTypeOptions: Array<{ value: ArticlePublicInfoType; label: string }> = [
  { value: "general", label: "일반형" },
  { value: "welfare_health", label: "복지·건강형" },
  { value: "application_recruitment", label: "신청·모집형" },
  { value: "event_festival", label: "축제·행사형" },
  { value: "tourism_place", label: "관광·장소형" },
  { value: "life_civil", label: "생활·민원형" },
  { value: "government_major", label: "시정·군정 주요소식형" },
  { value: "local_news", label: "읍면동·지역소식형" },
  { value: "emergency", label: "긴급·안전형" },
];

const articleUrgencyOptions: Array<{ value: ArticleUrgency; label: string; description: string }> = [
  { value: "normal", label: "일반", description: "일반적인 정기 기사" },
  { value: "time_sensitive", label: "시한성 정보", description: "신청 마감, 행사 일정, 모집 기간 등" },
  { value: "urgent", label: "긴급", description: "재난·안전·교통 통제 등 우선 확인 정보" },
];

const institutionPriorityOptions = [
  { value: 1, label: "1 낮음" },
  { value: 2, label: "2 보통 이하" },
  { value: 3, label: "3 보통" },
  { value: 4, label: "4 중요" },
  { value: 5, label: "5 최우선" },
];

const articleAudioSourceOptions: Array<{ value: ArticleAudioSourceInput; label: string; description: string }> = [
  {
    value: "uploaded",
    label: "직접 제작 음성파일",
    description: "음성 관리 화면에서 업로드한 MP3, WAV, M4A 파일을 기사와 연결합니다.",
  },
  {
    value: "ai_tts",
    label: "AI 음성 자동 생성",
    description: "저장된 기사 제목, 요약, 본문, 대본을 기준으로 AI 음성을 생성합니다.",
  },
  {
    value: "none",
    label: "음성 사용 안 함",
    description: "공개 모바일 기사에서 음성 플레이어를 표시하지 않습니다.",
  },
];

const articleTtsVoiceOptions: Array<{ value: ArticleTtsVoiceInput; label: string }> = [
  { value: "marin", label: "Marin" },
  { value: "cedar", label: "Cedar" },
  { value: "onyx", label: "Onyx" },
  { value: "coral", label: "Coral" },
];

const titleMotionEffectOptions: Array<{ value: ArticleElementMotionEffect; label: string }> = [
  { value: "inherit", label: "기본값 따름" },
  { value: "none", label: "효과 없음" },
  { value: "fade_up", label: "부드럽게 등장" },
  { value: "char_by_char", label: "글자별 등장" },
];

const textBoxMotionEffectOptions: Array<{ value: ArticleElementMotionEffect; label: string }> = [
  { value: "inherit", label: "기본값 따름" },
  { value: "none", label: "효과 없음" },
  { value: "fade_up", label: "부드럽게 등장" },
  { value: "card_lift", label: "카드가 떠오름" },
];

const imageMotionEffectOptions: Array<{ value: ArticleElementMotionEffect; label: string }> = [
  { value: "inherit", label: "기본값 따름" },
  { value: "none", label: "효과 없음" },
  { value: "fade_in", label: "서서히 표시" },
  { value: "reveal_up", label: "아래에서 나타남" },
  { value: "soft_zoom", label: "살짝 확대" },
  { value: "blur_clear", label: "흐림에서 선명" },
];

const linkMotionEffectOptions: Array<{ value: ArticleElementMotionEffect; label: string }> = [
  { value: "inherit", label: "기본값 따름" },
  { value: "none", label: "효과 없음" },
  { value: "soft_emphasis", label: "부드러운 강조" },
  { value: "card_lift", label: "카드가 떠오름" },
];

const elementMotionSpeedOptions: Array<{ value: ArticleElementMotionSpeed; label: string }> = [
  { value: "inherit", label: "기본값 따름" },
  { value: "slow", label: "느리게" },
  { value: "normal", label: "기본" },
  { value: "fast", label: "빠르게" },
];

const editableBlockTypes: Array<{ type: EditorBlockType; label: string; help: string }> = [
  { type: "paragraph", label: "문단", help: "기사 본문 텍스트" },
  { type: "image", label: "이미지", help: "사진 URL과 캡션" },
  { type: "video_link", label: "유튜브", help: "영상 주소 삽입" },
  { type: "map_link", label: "지도", help: "위치 링크 삽입" },
  { type: "button_group", label: "URL 버튼", help: "신청·문의 바로가기" },
  { type: "audio", label: "음성 대본", help: "낭독용 원고" },
];

const blockTypeThemes: Record<EditorBlockType, { button: string; marker: string }> = {
  paragraph: {
    button: "border-[#2f73b7] bg-[#eef6ff] hover:bg-[#e1efff]",
    marker: "bg-[#184a88] text-white",
  },
  image: {
    button: "border-sky-300 bg-sky-50 hover:bg-sky-100",
    marker: "bg-sky-600 text-white",
  },
  video_link: {
    button: "border-rose-200 bg-rose-50 hover:bg-rose-100",
    marker: "bg-rose-600 text-white",
  },
  map_link: {
    button: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100",
    marker: "bg-emerald-700 text-white",
  },
  button_group: {
    button: "border-violet-200 bg-violet-50 hover:bg-violet-100",
    marker: "bg-violet-700 text-white",
  },
  audio: {
    button: "border-amber-200 bg-amber-50 hover:bg-amber-100",
    marker: "bg-amber-600 text-white",
  },
};

const blockTypeLabels: Record<EditorBlockType, string> = {
  paragraph: "문단",
  image: "이미지",
  video_link: "유튜브",
  map_link: "지도",
  button_group: "URL 버튼",
  audio: "음성 대본",
};

const standardArticleTemplate: EditorBlock[] = [
  {
    id: "template-paragraph-1",
    type: "paragraph",
    title: "핵심 내용",
    body: "모바일 독자가 먼저 알아야 할 핵심 내용을 2~4문장으로 입력합니다.",
    textAlignment: "left",
  },
  {
    id: "template-image-1",
    type: "image",
    title: "관련 사진 설명",
    body: "https://... 이미지 공개 URL",
    textAlignment: "left",
  },
  {
    id: "template-paragraph-2",
    type: "paragraph",
    title: "상세 안내",
    body: "사진 아래에 이어질 설명 문단을 입력합니다. 날짜, 장소, 대상, 신청 방법처럼 구체 정보를 넣습니다.",
    textAlignment: "left",
  },
  {
    id: "template-button-1",
    type: "button_group",
    title: "자세히 보기",
    body: "https://... 연결할 페이지 URL",
    textAlignment: "left",
  },
];

const blockUseCases: Array<{ title: string; description: string }> = [
  { title: "텍스트 사이 사진", description: "문단 → 이미지 → 문단 순서로 블록을 배치합니다." },
  { title: "신청 링크", description: "URL 버튼 블록에 버튼명과 연결 주소를 입력합니다." },
  { title: "유튜브 영상", description: "유튜브 블록에 영상 제목과 YouTube URL을 입력합니다." },
];

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-black text-[#092046]">
      {children}
      {required ? <span className="text-[#c2410c]"> *</span> : null}
    </label>
  );
}

function SectionBadge({ tone, children }: { tone: "required" | "optional" | "advanced"; children: string }) {
  const className =
    tone === "required"
      ? "bg-[#092046] text-white"
      : tone === "optional"
        ? "bg-[#eaf2ff] text-[#184a88]"
        : "bg-slate-100 text-slate-600";

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}

function getValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function getValues(formData: FormData, name: string) {
  return formData.getAll(name).filter((value): value is string => typeof value === "string").map((value) => value.trim());
}

function parseCustomInterestTags(value: string) {
  return value
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildInterestTags(formData: FormData) {
  return [...getValues(formData, "interestTags"), ...parseCustomInterestTags(getValue(formData, "customInterestTags"))];
}

function toIsoFromDatetimeLocal(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function toDatetimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function makeBlockId(type: string) {
  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeTemplateBlock(block: EditorBlock, index: number): EditorBlock {
  return {
    ...block,
    id: makeBlockId(`${block.type}-${index}`),
  };
}

function isEditableBlockType(type: ProjectContentBlock["type"]): type is EditorBlockType {
  return editableBlockTypes.some((item) => item.type === type);
}

function makeInitialBlocks(article: ProjectContentArticle | null): EditorBlock[] {
  const blocks =
    article?.blocks
      .filter((block) => isEditableBlockType(block.type) && block.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((block, index) => {
        const link = block.linkActionId ? article.links.find((item) => item.id === block.linkActionId) : null;

        return {
          id: block.id || `${block.type}-${index + 1}`,
          type: block.type as EditorBlockType,
          title: block.type === "paragraph" && block.title === "본문" ? "" : block.title || link?.label || "",
          body: block.body || link?.targetValue || "",
          textAlignment: block.textAlignment,
        };
      }) ?? [];

  if (blocks.length > 0) {
    return blocks;
  }

  const fallbackBlocks: EditorBlock[] = [];

  if (article?.body) {
    fallbackBlocks.push({ id: "paragraph-1", type: "paragraph", title: "", body: article.body, textAlignment: article.bodyAlignment });
  }

  const videoLink = article?.links.find((link) => link.actionType === "video");
  const mapLink = article?.links.find((link) => link.actionType === "map");
  const buttonLink = article?.links.find((link) => link.displayStyle === "button");

  if (videoLink) {
    fallbackBlocks.push({ id: "video-1", type: "video_link", title: videoLink.label, body: videoLink.targetValue, textAlignment: "left" });
  }

  if (mapLink) {
    fallbackBlocks.push({ id: "map-1", type: "map_link", title: mapLink.label, body: mapLink.targetValue, textAlignment: "left" });
  }

  if (buttonLink) {
    fallbackBlocks.push({ id: "button-1", type: "button_group", title: buttonLink.label, body: buttonLink.targetValue, textAlignment: "left" });
  }

  const audioScript = article?.blocks.find((block) => block.type === "audio")?.body;

  if (audioScript) {
    fallbackBlocks.push({ id: "audio-1", type: "audio", title: "음성 대본", body: audioScript, textAlignment: "left" });
  }

  return fallbackBlocks.length > 0 ? fallbackBlocks : [{ id: "paragraph-1", type: "paragraph", title: "", body: "", textAlignment: "left" }];
}

function getBlockTitleLabel(type: EditorBlockType) {
  switch (type) {
    case "paragraph":
      return "소제목";
    case "image":
      return "이미지 캡션";
    case "video_link":
      return "영상 제목";
    case "map_link":
      return "지도 제목";
    case "button_group":
      return "버튼에 표시할 문구";
    case "audio":
      return "대본 제목";
    default:
      return "제목";
  }
}

function getBlockBodyLabel(type: EditorBlockType) {
  switch (type) {
    case "paragraph":
      return "본문";
    case "image":
      return "이미지 URL";
    case "video_link":
      return "YouTube URL";
    case "map_link":
      return "지도 URL";
    case "button_group":
      return "연결 URL 또는 전화번호";
    case "audio":
      return "음성 대본";
    default:
      return "내용";
  }
}

function getBlockBodyPlaceholder(type: EditorBlockType) {
  switch (type) {
    case "paragraph":
      return "모바일 독자가 읽기 쉽게 2~5문장 단위로 입력합니다.";
    case "image":
      return "저장 이미지 불러오기, 로컬 업로드, 또는 외부 공개 이미지 URL";
    case "video_link":
      return "https://www.youtube.com/watch?v=...";
    case "map_link":
      return "카카오·네이버·구글 지도 URL";
    case "button_group":
      return "https://... 또는 061-000-0000";
    case "audio":
      return "음성 파일 제작 또는 검수에 사용할 대본을 입력합니다.";
    default:
      return "";
  }
}

function getBlockGuide(type: EditorBlockType) {
  switch (type) {
    case "paragraph":
      return "워드의 본문 문단에 해당합니다. 문단을 여러 개로 나누면 모바일에서 훨씬 읽기 쉽습니다.";
    case "image":
      return "저장된 이미지 소재를 불러오거나 로컬 이미지를 업로드하면 공개 화면용 이미지 주소가 자동 입력됩니다.";
    case "video_link":
      return "유튜브 주소를 입력하면 공개 화면에서 영상 영역으로 표시됩니다. 예: https://www.youtube.com/watch?v=...";
    case "map_link":
      return "카카오맵, 네이버지도, 구글지도 공유 주소를 입력하면 위치 확인 카드로 표시됩니다.";
    case "button_group":
      return "신청하기, 자세히 보기, 문의하기처럼 독자가 눌러야 하는 링크를 버튼으로 표시합니다.";
    case "audio":
      return "음성 파일 제작이나 낭독 검수에 사용할 원고입니다. 공개 화면에서는 접어서 볼 수 있는 대본으로 표시됩니다.";
    default:
      return "모바일 화면에 표시할 내용을 입력합니다.";
  }
}

function getBlockPreviewText(block: EditorBlock) {
  if (block.type === "paragraph") {
    return block.body || "본문 문단이 여기에 표시됩니다.";
  }

  if (block.type === "image") {
    return block.body || "이미지 URL 입력 전";
  }

  if (block.type === "video_link") {
    return block.body || "유튜브 URL 입력 전";
  }

  if (block.type === "map_link") {
    return block.body || "지도 URL 입력 전";
  }

  if (block.type === "button_group") {
    return block.body || "연결 URL 입력 전";
  }

  return block.body || "음성 대본 입력 전";
}

function shouldUseTextarea(type: EditorBlockType) {
  return type === "paragraph" || type === "audio";
}

function makePublicAssetPreviewHref(path: string) {
  return `/api/public-files/preview?bucket=mobile-assets&path=${encodeURIComponent(path)}`;
}

function getMobileAssetPathFromPreviewHref(value: string) {
  if (!value.trim()) {
    return "";
  }

  try {
    const url = new URL(value, "https://local.invalid");
    const isMobileAssetPreview =
      url.pathname === "/api/public-files/preview" && url.searchParams.get("bucket") === "mobile-assets";

    return isMobileAssetPreview ? url.searchParams.get("path")?.trim() ?? "" : "";
  } catch {
    return "";
  }
}

function isPersistedBlockId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readUploadMessage(response: ProjectFileUploadResponse | null, fallback: string) {
  return response && response.ok === false ? response.message || fallback : fallback;
}

function readArticleMotionPreset(value: string): ArticleMotionPreset {
  return articleMotionPresetOptions.some((option) => option.value === value) ? (value as ArticleMotionPreset) : "dynamic";
}

function readArticleMotionSpeed(value: string): ArticleMotionSpeed {
  return articleMotionSpeedOptions.some((option) => option.value === value) ? (value as ArticleMotionSpeed) : "normal";
}

function readArticleElementMotionEffect(
  value: string,
  options: Array<{ value: ArticleElementMotionEffect; label: string }>,
): ArticleElementMotionEffect {
  return options.some((option) => option.value === value) ? (value as ArticleElementMotionEffect) : "inherit";
}

function readArticleElementMotionSpeed(value: string): ArticleElementMotionSpeed {
  return elementMotionSpeedOptions.some((option) => option.value === value)
    ? (value as ArticleElementMotionSpeed)
    : "inherit";
}

function isUrlBlockType(type: EditorBlockType) {
  return type === "image" || type === "video_link" || type === "map_link" || type === "button_group";
}

function ElementMotionSettingRow({
  effectName,
  effectOptions,
  effectValue,
  label,
  onEffectChange,
  onSpeedChange,
  speedName,
  speedValue,
}: {
  effectName: string;
  effectOptions: Array<{ value: ArticleElementMotionEffect; label: string }>;
  effectValue: ArticleElementMotionEffect;
  label: string;
  onEffectChange: (value: ArticleElementMotionEffect) => void;
  onSpeedChange: (value: ArticleElementMotionSpeed) => void;
  speedName: string;
  speedValue: ArticleElementMotionSpeed;
}) {
  return (
    <div className="rounded-lg border border-[#d8e8ff] bg-white p-3">
      <p className="text-xs font-black text-[#092046]">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select
          name={effectName}
          value={effectValue}
          onChange={(event) => onEffectChange(readArticleElementMotionEffect(event.currentTarget.value, effectOptions))}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
        >
          {effectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          name={speedName}
          value={speedValue}
          onChange={(event) => onSpeedChange(readArticleElementMotionSpeed(event.currentTarget.value))}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
        >
          {elementMotionSpeedOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function FontSelect({
  defaultValue,
  fonts,
  help,
  inheritLabel,
  label,
  name,
}: {
  defaultValue?: string | null;
  fonts: FontAsset[];
  help?: string;
  inheritLabel: string;
  label: string;
  name: string;
}) {
  const selectableFonts = getSelectableFontAssets(fonts);

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
      >
        <option value="">{inheritLabel}</option>
        {selectableFonts.map((font) => (
          <option key={font.id} value={font.id}>
            {font.name}
          </option>
        ))}
      </select>
      {help ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{help}</p> : null}
    </div>
  );
}

export function ProjectArticleEditorForm({
  projectSlug,
  pages,
  surveys = [],
  assets,
  fonts = [],
  projectBodyFontAssetId,
  projectTitleFontAssetId,
  projectPageCount = 0,
  article,
}: ProjectArticleEditorFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingArticle, setIsDeletingArticle] = useState(false);
  const [isImportingWord, setIsImportingWord] = useState(false);
  const [uploadingImageBlockId, setUploadingImageBlockId] = useState("");
  const [wordImportMessage, setWordImportMessage] = useState("");
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => makeInitialBlocks(article));
  const [motionPreviewTitle, setMotionPreviewTitle] = useState(article?.title ?? "");
  const [mobileDisplayTitle, setMobileDisplayTitle] = useState(article?.displayTitle ?? "");
  const [motionPreviewSummary, setMotionPreviewSummary] = useState(article?.summary ?? "");
  const [selectedMotionPreset, setSelectedMotionPreset] = useState<ArticleMotionPreset>(article?.motionPreset ?? "dynamic");
  const [selectedMotionSpeed, setSelectedMotionSpeed] = useState<ArticleMotionSpeed>(article?.motionSpeed ?? "normal");
  const [titleMotionEffect, setTitleMotionEffect] = useState<ArticleElementMotionEffect>(
    article?.titleMotionEffect ?? "inherit",
  );
  const [titleMotionSpeed, setTitleMotionSpeed] = useState<ArticleElementMotionSpeed>(
    article?.titleMotionSpeed ?? "inherit",
  );
  const [textBoxMotionEffect, setTextBoxMotionEffect] = useState<ArticleElementMotionEffect>(
    article?.textBoxMotionEffect ?? "inherit",
  );
  const [textBoxMotionSpeed, setTextBoxMotionSpeed] = useState<ArticleElementMotionSpeed>(
    article?.textBoxMotionSpeed ?? "inherit",
  );
  const [imageMotionEffect, setImageMotionEffect] = useState<ArticleElementMotionEffect>(
    article?.imageMotionEffect ?? "inherit",
  );
  const [imageMotionSpeed, setImageMotionSpeed] = useState<ArticleElementMotionSpeed>(
    article?.imageMotionSpeed ?? "inherit",
  );
  const [linkMotionEffect, setLinkMotionEffect] = useState<ArticleElementMotionEffect>(
    article?.linkMotionEffect ?? "inherit",
  );
  const [linkMotionSpeed, setLinkMotionSpeed] = useState<ArticleElementMotionSpeed>(
    article?.linkMotionSpeed ?? "inherit",
  );
  const [selectedAudioSource, setSelectedAudioSource] = useState<ArticleAudioSourceInput>(
    article?.audioSource ?? (article?.audioFile?.sourceType === "uploaded" ? "uploaded" : "none"),
  );
  const [selectedArticleTtsVoice, setSelectedArticleTtsVoice] = useState<ArticleTtsVoiceInput>(
    articleTtsVoiceOptions.some((option) => option.value === article?.articleTtsVoice)
      ? (article?.articleTtsVoice as ArticleTtsVoiceInput)
      : "marin",
  );
  const [isGeneratingArticleTts, setIsGeneratingArticleTts] = useState(false);
  const [articleTtsMessage, setArticleTtsMessage] = useState("");
  const imageAssets = useMemo(
    () => assets.filter((asset) => asset.mimeType.startsWith("image/") || asset.previewHref),
    [assets],
  );
  const blockSummary = useMemo(
    () =>
      blocks
        .map((block, index) => `${index + 1}. ${blockTypeLabels[block.type]}`)
        .join(" / "),
    [blocks],
  );
  const effectiveMobileTitle = useMemo(
    () => getDisplayArticleTitle({ displayTitle: mobileDisplayTitle, title: motionPreviewTitle }, "기사 제목 미리보기"),
    [mobileDisplayTitle, motionPreviewTitle],
  );
  const mobileTitleRiskTokens = useMemo(
    () => detectLongKoreanTitleTokens(effectiveMobileTitle),
    [effectiveMobileTitle],
  );
  const customInterestTagText = useMemo(
    () => (article?.interestTags ?? []).filter((tag) => !recommendedInterestTags.includes(tag)).join(", "),
    [article?.interestTags],
  );

  function updateBlock(blockId: string, field: "title" | "body", value: string) {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => (block.id === blockId ? { ...block, [field]: value } : block)),
    );
  }

  function updateBlockTextAlignment(blockId: string, value: ArticleTextAlignment) {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => (block.id === blockId ? { ...block, textAlignment: value } : block)),
    );
  }

  function addBlock(type: EditorBlockType) {
    setBlocks((currentBlocks) => [
      ...currentBlocks,
      {
        id: makeBlockId(type),
        type,
        title: type === "audio" ? "음성 대본" : "",
        body: "",
        textAlignment: "left",
      },
    ]);
  }

  function applyImageAssetToBlock(blockId: string, asset: ProjectAssetFile) {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              title: block.title.trim() ? block.title : asset.title,
              body: makePublicAssetPreviewHref(asset.filePath),
            }
          : block,
      ),
    );
    setError("");
    setMessage("저장된 이미지 소재를 현재 블록에 불러왔습니다. 저장 버튼을 눌러 기사에 반영하세요.");
  }

  async function pasteClipboardUrlToBlock(blockId: string) {
    if (!navigator.clipboard?.readText) {
      setError("이 브라우저에서는 클립보드 주소 붙여넣기를 사용할 수 없습니다.");
      return;
    }

    const text = (await navigator.clipboard.readText().catch(() => "")).trim();

    if (!text) {
      setError("클립보드에서 붙여넣을 주소를 찾지 못했습니다.");
      return;
    }

    updateBlock(blockId, "body", text);
    setError("");
    setMessage("클립보드의 주소를 현재 블록에 붙여넣었습니다.");
  }

  async function uploadImageFileToBlock(blockId: string, file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 불러올 수 있습니다.");
      return;
    }

    setError("");
    setMessage("이미지를 Supabase에 업로드하는 중입니다.");
    setUploadingImageBlockId(blockId);

    const prepareResponse = await fetch("/api/project-files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "prepare",
        fileName: file.name,
        kind: "asset_image",
        mimeType: file.type,
        projectSlug,
        size: file.size,
      }),
    });
    const prepareResult = (await prepareResponse.json().catch(() => null)) as ProjectFileUploadResponse | null;

    if (!prepareResponse.ok || !prepareResult?.ok || !prepareResult.uploadUrl) {
      setUploadingImageBlockId("");
      setError(readUploadMessage(prepareResult, "이미지 업로드 준비에 실패했습니다."));
      return;
    }

    const uploadResponse = await fetch(prepareResult.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": prepareResult.mimeType || file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      setUploadingImageBlockId("");
      setError("이미지를 Supabase Storage에 업로드하지 못했습니다.");
      return;
    }

    const completeResponse = await fetch("/api/project-files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "complete",
        bucket: prepareResult.bucket,
        fileName: prepareResult.fileName ?? file.name,
        kind: "asset_image",
        mimeType: prepareResult.mimeType ?? file.type,
        path: prepareResult.path,
        projectSlug,
        size: prepareResult.size ?? file.size,
      }),
    });
    const completeResult = (await completeResponse.json().catch(() => null)) as ProjectFileUploadResponse | null;

    setUploadingImageBlockId("");

    if (!completeResponse.ok || !completeResult?.ok) {
      setError(readUploadMessage(completeResult, "이미지는 올라갔지만 프로젝트 소재 기록 연결에 실패했습니다."));
      return;
    }

    setBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              title: block.title.trim() ? block.title : completeResult.fileName,
              body: makePublicAssetPreviewHref(completeResult.path),
            }
          : block,
      ),
    );
    setMessage("이미지를 업로드하고 현재 이미지 블록에 불러왔습니다. 저장 버튼을 눌러 기사에 반영하세요.");
  }

  async function importTextFileToBlock(blockId: string, file: File | undefined) {
    if (!file) {
      return;
    }

    const fileName = file.name.toLowerCase();
    const isTextFile = file.type.startsWith("text/") || fileName.endsWith(".txt") || fileName.endsWith(".md");

    if (!isTextFile) {
      setError("음성 대본은 .txt 또는 .md 텍스트 파일만 불러올 수 있습니다.");
      return;
    }

    const text = (await file.text().catch(() => "")).trim();

    if (!text) {
      setError("불러온 파일에서 텍스트를 찾지 못했습니다.");
      return;
    }

    setBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              title: block.title.trim() ? block.title : "음성 대본",
              body: text,
            }
          : block,
      ),
    );
    setError("");
    setMessage("텍스트 파일을 음성 대본 블록에 불러왔습니다.");
  }

  function loadStandardTemplate() {
    const hasTypedContent = blocks.some((block) => block.title.trim() || block.body.trim());

    if (hasTypedContent && !window.confirm("현재 입력 중인 블록을 표준 기사 구성으로 바꿀까요?")) {
      return;
    }

    setBlocks(standardArticleTemplate.map(makeTemplateBlock));
  }

  function getFormFieldValue(name: string) {
    const field = formRef.current?.elements.namedItem(name);

    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      return field.value.trim();
    }

    return "";
  }

  function setFormFieldValue(name: string, value: string) {
    const field = formRef.current?.elements.namedItem(name);

    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = value;
    }
  }

  async function handleWordImport(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError(".docx 형식의 Word 파일만 가져올 수 있습니다.");
      return;
    }

    const hasTypedContent =
      getFormFieldValue("title") ||
      getFormFieldValue("summary") ||
      blocks.some((block) => block.title.trim() || block.body.trim());

    if (hasTypedContent && !window.confirm("현재 입력 중인 제목·요약·블록을 Word 원고 내용으로 바꿀까요?")) {
      return;
    }

    setError("");
    setMessage("");
    setWordImportMessage("");
    setIsImportingWord(true);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/project-content/import-word", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as ImportedWordResponse | null;

    setIsImportingWord(false);

    if (!response.ok || !result || result.ok !== true) {
      setError(result && result.ok === false ? result.message || "Word 원고를 가져오지 못했습니다." : "Word 원고를 가져오지 못했습니다.");
      return;
    }

    setFormFieldValue("title", result.imported.title);
    setFormFieldValue("displayTitle", "");
    setFormFieldValue("summary", result.imported.summary);
    setMotionPreviewTitle(result.imported.title);
    setMobileDisplayTitle("");
    setMotionPreviewSummary(result.imported.summary);
    setBlocks(
      result.imported.blocks.map((block, index) => ({
        id: makeBlockId(`word-${block.type}-${index}`),
        type: block.type,
        title: block.title,
        body: block.body,
        textAlignment: article?.bodyAlignment ?? article?.textAlignment ?? "left",
      })),
    );
    setWordImportMessage("Word 원고를 모바일 기사 블록으로 가져왔습니다. 이미지와 추가 링크는 필요한 위치에 블록으로 보완하세요.");
  }

  async function removeBlock(blockId: string) {
    const confirmed = window.confirm("이 콘텐츠 블록을 삭제하시겠습니까?");

    if (!confirmed) {
      return;
    }

    if (article?.id && isPersistedBlockId(blockId)) {
      setError("");
      setMessage("콘텐츠 블록을 삭제하는 중입니다.");

      const params = new URLSearchParams({
        articleId: article.id,
        blockId,
        projectSlug,
      });
      const response = await fetch(`/api/project-content/blocks?${params.toString()}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(result?.message ?? "콘텐츠 블록 삭제에 실패했습니다.");
        setMessage("");
        return;
      }
    }

    setBlocks((currentBlocks) => currentBlocks.filter((block) => block.id !== blockId));
    setError("");
    setMessage("콘텐츠 블록을 삭제했습니다. 필요하면 저장 버튼을 눌러 나머지 블록 순서를 반영하세요.");
  }

  function moveBlock(blockId: string, direction: "up" | "down") {
    setBlocks((currentBlocks) => {
      const index = currentBlocks.findIndex((block) => block.id === blockId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;

      if (index < 0 || nextIndex < 0 || nextIndex >= currentBlocks.length) {
        return currentBlocks;
      }

      const nextBlocks = [...currentBlocks];
      const [target] = nextBlocks.splice(index, 1);
      nextBlocks.splice(nextIndex, 0, target);

      return nextBlocks;
    });
  }

  function buildArticlePayload(formData: FormData, overrides: Partial<ArticlePayload> = {}): ArticlePayload {
    const contentBlocks = blocks
      .map((block, index) => ({
        type: block.type,
        title: block.title.trim(),
        body: block.body.trim(),
        textAlignment: block.textAlignment,
        sortOrder: (index + 1) * 10,
      }))
      .filter((block) => block.title || block.body);
    const body = contentBlocks
      .filter((block) => block.type === "paragraph")
      .map((block) => [block.title, block.body].filter(Boolean).join("\n"))
      .join("\n\n");
    const bodyAlignment = getValue(formData, "bodyAlignment");

    return {
      projectSlug,
      articleId: article?.id ?? "",
      pageId: getValue(formData, "pageId"),
      sourcePageNumber: Number(getValue(formData, "sourcePageNumber")) || 0,
      sortOrder: Number(getValue(formData, "sortOrder")) || 0,
      surveyId: getValue(formData, "surveyId"),
      title: getValue(formData, "title"),
      displayTitle: getValue(formData, "displayTitle"),
      summary: getValue(formData, "summary"),
      body,
      textAlignment: getValue(formData, "textAlignment") || bodyAlignment,
      titleAlignment: getValue(formData, "titleAlignment"),
      summaryAlignment: getValue(formData, "summaryAlignment"),
      bodyAlignment,
      interestTags: buildInterestTags(formData),
      articleType: getValue(formData, "articleType"),
      institutionPriority: Number(getValue(formData, "institutionPriority")) || 3,
      urgency: getValue(formData, "urgency"),
      validFrom: toIsoFromDatetimeLocal(getValue(formData, "validFrom")),
      validUntil: toIsoFromDatetimeLocal(getValue(formData, "validUntil")),
      contentBlocks,
      contactName: getValue(formData, "contactName"),
      contactPhone: getValue(formData, "contactPhone"),
      motionPreset: getValue(formData, "motionPreset"),
      motionSpeed: getValue(formData, "motionSpeed"),
      titleMotionEffect: getValue(formData, "titleMotionEffect"),
      titleMotionSpeed: getValue(formData, "titleMotionSpeed"),
      textBoxMotionEffect: getValue(formData, "textBoxMotionEffect"),
      textBoxMotionSpeed: getValue(formData, "textBoxMotionSpeed"),
      imageMotionEffect: getValue(formData, "imageMotionEffect"),
      imageMotionSpeed: getValue(formData, "imageMotionSpeed"),
      linkMotionEffect: getValue(formData, "linkMotionEffect"),
      linkMotionSpeed: getValue(formData, "linkMotionSpeed"),
      titleFontAssetId: getValue(formData, "titleFontAssetId"),
      bodyFontAssetId: getValue(formData, "bodyFontAssetId"),
      captionFontAssetId: getValue(formData, "captionFontAssetId"),
      buttonFontAssetId: getValue(formData, "buttonFontAssetId"),
      audioSource: getValue(formData, "audioSource"),
      articleTtsVoice: getValue(formData, "articleTtsVoice"),
      status: getValue(formData, "status"),
      ...overrides,
    };
  }

  async function persistArticle(payload: ArticlePayload) {
    if (!payload.title) {
      setError("기사 제목은 반드시 입력해야 합니다.");
      return null;
    }

    const response = await fetch("/api/project-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as
      | { ok: true; article: { id: string; title: string } }
      | { ok: false; message?: string }
      | null;

    if (!response.ok || !result || result.ok !== true) {
      setError(result && result.ok === false ? result.message || "기사 저장에 실패했습니다." : "기사 저장에 실패했습니다.");
      return null;
    }

    return result.article;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const savedArticle = await persistArticle(buildArticlePayload(formData));

    setIsSaving(false);

    if (!savedArticle) {
      return;
    }

    setMessage("기사와 콘텐츠 블록을 Supabase에 저장했습니다.");
    router.push(`/projects/${projectSlug}/reading?articleId=${savedArticle.id}`);
    router.refresh();
  }

  async function deleteArticle() {
    if (!article?.id) {
      return;
    }

    const confirmed = window.confirm(
      `이 기사를 삭제하시겠습니까?\n\n기사 제목:\n${article.title}\n\n기사에 포함된 콘텐츠 블록도 함께 삭제됩니다.\nSupabase Storage의 원본 이미지 파일은 삭제하지 않습니다.`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    setIsDeletingArticle(true);

    const params = new URLSearchParams({
      articleId: article.id,
      projectSlug,
    });
    const response = await fetch(`/api/project-content?${params.toString()}`, {
      method: "DELETE",
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setIsDeletingArticle(false);
      setError(result?.message ?? "기사 삭제에 실패했습니다.");
      return;
    }

    setIsDeletingArticle(false);
    setMessage("기사를 삭제했습니다.");
    router.push(`/projects/${projectSlug}/reading`);
    router.refresh();
  }

  async function generateArticleTtsAudio() {
    if (selectedAudioSource !== "ai_tts") {
      setError("AI 음성 자동 생성을 선택하세요.");
      return;
    }

    setError("");
    setMessage("");
    setArticleTtsMessage("기사 저장 중...");
    setIsGeneratingArticleTts(true);
    const formData = formRef.current ? new FormData(formRef.current) : null;

    if (!formData) {
      setIsGeneratingArticleTts(false);
      setError("기사 입력 폼을 확인하지 못했습니다.");
      return;
    }

    const savedArticle = await persistArticle(
      buildArticlePayload(formData, {
        articleTtsVoice: selectedArticleTtsVoice,
        audioSource: "ai_tts",
      }),
    );

    if (!savedArticle) {
      setIsGeneratingArticleTts(false);
      setArticleTtsMessage("");
      return;
    }

    setArticleTtsMessage("AI 음성 생성 중...");

    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectSlug)}/articles/${encodeURIComponent(savedArticle.id)}/tts/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          force: true,
          voice: selectedArticleTtsVoice,
        }),
      },
    );
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; segments?: number } | null;

    setIsGeneratingArticleTts(false);

    if (!response.ok || result?.ok !== true) {
      setError(result?.message ?? "AI 음성 생성에 실패했습니다.");
      setArticleTtsMessage("");
      return;
    }

    setArticleTtsMessage(
      result.segments && result.segments > 1
        ? `AI 음성을 생성했습니다. (${result.segments}개 구간)`
        : result.message ?? "AI 음성을 생성했습니다.",
    );
    setMessage("현재 입력한 기사 내용을 저장한 뒤 AI 음성을 생성했습니다.");
    if (!article?.id || article.id !== savedArticle.id) {
      router.push(`/projects/${projectSlug}/reading?articleId=${savedArticle.id}`);
    }
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">필수 입력</p>
            <h3 className="mt-1 text-lg font-black text-[#092046]">
              {article ? "선택 기사 수정" : "새 기사 작성"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">제목·요약, 노출 설정, 참여 연결, 본문 블록 순서로 정리합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SectionBadge tone="required">필수</SectionBadge>
            <StatusPill value={article ? "DB 저장됨" : "신규 작성"} />
            {article?.audioFile ? (
              <StatusPill value={article.audioFile.sourceType === "ai_tts" ? "AI 음성 있음" : "연결된 음성 있음"} />
            ) : null}
          </div>
        </div>
        {article?.audioFile ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-emerald-800">연결된 음성</p>
              <p className="mt-1 text-sm font-bold text-emerald-900">{article.audioFile.title}</p>
              <p className="mt-1 text-xs font-bold text-emerald-800">
                {article.audioFile.transcriptTypeLabel} · {article.audioFile.transcriptReviewStatusLabel}
              </p>
            </div>
            <Link href={`/projects/${projectSlug}/audio`} className="dd-btn dd-btn-secondary dd-btn-sm self-start sm:self-auto">
              음성 파일 관리로 이동
            </Link>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-[#d8e8ff] bg-white p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">음성·대본</p>
              <h4 className="text-base font-black text-[#092046]">모바일 기사 음성 방식</h4>
            </div>
            <Link href={`/projects/${projectSlug}/audio`} className="dd-btn dd-btn-secondary dd-btn-sm self-start sm:self-auto">
              음성 파일 관리
            </Link>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {articleAudioSourceOptions.map((option) => (
              <label
                key={option.value}
                className={`rounded-xl border px-4 py-3 transition ${
                  selectedAudioSource === option.value
                    ? "border-[#184a88] bg-[#eff6ff] shadow-sm"
                    : "border-slate-200 bg-white hover:border-[#b8d7ff]"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-black text-[#092046]">
                  <input
                    type="radio"
                    name="audioSource"
                    value={option.value}
                    checked={selectedAudioSource === option.value}
                    onChange={() => setSelectedAudioSource(option.value)}
                    className="h-4 w-4 accent-[#184a88]"
                  />
                  {option.label}
                </span>
                <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">{option.description}</span>
              </label>
            ))}
          </div>

          {selectedAudioSource === "uploaded" ? (
            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-black text-emerald-800">
                {article?.audioFile?.sourceType === "uploaded" ? "직접 제작 음성이 연결되어 있습니다." : "직접 제작 음성을 연결하세요."}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                기존 MP3/WAV/M4A 업로드와 기사 연결 기능을 그대로 사용합니다.
              </p>
            </div>
          ) : null}

          {selectedAudioSource === "ai_tts" ? (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-end">
                <div>
                  <FieldLabel>AI 음색</FieldLabel>
                  <select
                    name="articleTtsVoice"
                    value={selectedArticleTtsVoice}
                    onChange={(event) => setSelectedArticleTtsVoice(event.currentTarget.value as ArticleTtsVoiceInput)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-[#092046] outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  >
                    {articleTtsVoiceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void generateArticleTtsAudio();
                    }}
                    disabled={isGeneratingArticleTts}
                    className="dd-btn dd-btn-primary dd-btn-sm disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isGeneratingArticleTts ? "생성 중..." : article?.aiAudioId ? "AI 음성 다시 생성" : "AI 음성 생성"}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">
                공개 본문 문단을 기준으로 생성합니다. 제목·요약·이미지·링크·영상 텍스트는 낭독 원문에서 제외됩니다.
              </p>
              {articleTtsMessage ? (
                <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#184a88]">{articleTtsMessage}</p>
              ) : null}
            </div>
          ) : (
            <input type="hidden" name="articleTtsVoice" value={selectedArticleTtsVoice} />
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-[#d8e8ff] bg-white px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">제목/요약</p>
          <p className="mt-1 text-sm font-bold text-slate-600">모바일 기사 첫 화면에 보이는 기본 문구를 입력합니다.</p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_280px]">
          <div>
            <FieldLabel required>기사 제목</FieldLabel>
            <input
              name="title"
              defaultValue={article?.title ?? ""}
              onChange={(event) => setMotionPreviewTitle(event.currentTarget.value)}
              placeholder="예: 군정 주요 소식"
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            />
          </div>
          <div>
            <FieldLabel>제목 정렬 방식</FieldLabel>
            <select
              name="titleAlignment"
              defaultValue={article?.titleAlignment ?? "left"}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            >
              {articleTextAlignmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <FontSelect
            name="titleFontAssetId"
            label="제목 글꼴"
            fonts={fonts}
            defaultValue={article?.titleFontAssetId}
            inheritLabel={projectTitleFontAssetId ? "프로젝트 기본값 따름" : "시스템 기본 글꼴"}
            help="공개 모바일 기사 제목에 적용됩니다."
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <FieldLabel>모바일 표시 제목</FieldLabel>
            <textarea
              name="displayTitle"
              defaultValue={article?.displayTitle ?? ""}
              onChange={(event) => setMobileDisplayTitle(event.currentTarget.value)}
              placeholder="비워두면 원문 제목을 사용합니다."
              className="min-h-20 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            />
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
              모바일 화면에서만 사용할 제목입니다. 원문 제목은 그대로 유지됩니다.
            </p>
          </div>
          <div className="rounded-2xl border border-[#d8e8ff] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black text-[#184a88]">모바일 제목 미리보기</p>
              <span className="rounded-full bg-[#eff6ff] px-2.5 py-1 text-[11px] font-black text-[#184a88]">
                최대 기준
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-[clamp(1.6rem,8vw,2.35rem)] font-black leading-tight text-[#092046] [line-break:strict] [overflow-wrap:anywhere] [text-wrap:balance]">
              {renderKoreanTitleWithBreaks(effectiveMobileTitle)}
            </p>
            {mobileTitleRiskTokens.length > 0 ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-black text-amber-900">
                  긴 고유명사가 있어 최대 글자 크기에서 줄바꿈을 확인하세요.
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                  {mobileTitleRiskTokens.join(" · ")}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                긴 제목은 의미 단위 줄바꿈 후보를 자동으로 보정합니다.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_280px]">
          <div>
            <FieldLabel>요약 문장</FieldLabel>
            <textarea
              name="summary"
              defaultValue={article?.summary ?? ""}
              onChange={(event) => setMotionPreviewSummary(event.currentTarget.value)}
              placeholder="목록 카드와 모바일 첫 화면에 표시할 핵심 요약을 입력합니다."
              className="min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            />
          </div>
          <div>
            <FieldLabel>요약문 정렬 방식</FieldLabel>
            <select
              name="summaryAlignment"
              defaultValue={article?.summaryAlignment ?? article?.textAlignment ?? "left"}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            >
              {articleTextAlignmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <FontSelect
            name="bodyFontAssetId"
            label="본문 글꼴"
            fonts={fonts}
            defaultValue={article?.bodyFontAssetId}
            inheritLabel={projectBodyFontAssetId ? "프로젝트 기본값 따름" : "시스템 기본 글꼴"}
            help="요약과 기사 본문 문단에 적용됩니다."
          />
        </div>

        <div className="mt-5 rounded-lg border border-[#d8e8ff] bg-white p-4">
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div>
              <FieldLabel>본문 정렬 방식</FieldLabel>
              <select
                name="bodyAlignment"
                defaultValue={article?.bodyAlignment ?? article?.textAlignment ?? "left"}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              >
                {articleTextAlignmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="self-end text-xs font-semibold leading-5 text-slate-500">
              제목, 요약문, 본문 문단별로 정렬 방식을 선택할 수 있습니다. 단, 독자가 글자를 크게 또는 최대로 보는 경우에는 가독성을 위해 왼쪽 정렬로 표시됩니다.
            </p>
          </div>
          <input type="hidden" name="textAlignment" defaultValue={article?.textAlignment ?? "left"} />
        </div>

        <div className="mt-5 rounded-lg border border-[#d8e8ff] bg-white p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">공공정보 분류 및 노출 기준</p>
              <h4 className="mt-1 text-base font-black text-[#092046]">기사 메타데이터</h4>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                관심분야와 정보 성격을 지정하면 향후 관심사별 보기와 기사 우선순위 구성에 활용됩니다.
              </p>
            </div>
            <SectionBadge tone="optional">선택</SectionBadge>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <FieldLabel>관심분야</FieldLabel>
              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-[#f8fbff] p-3">
                {recommendedInterestTags.map((tag) => (
                  <label
                    key={tag}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[#d8e8ff] bg-white px-3 text-xs font-black text-[#092046] transition hover:border-[#184a88]"
                  >
                    <input
                      type="checkbox"
                      name="interestTags"
                      value={tag}
                      defaultChecked={article?.interestTags.includes(tag) ?? false}
                      className="h-3.5 w-3.5 accent-[#184a88]"
                    />
                    {tag}
                  </label>
                ))}
              </div>
              <input
                name="customInterestTags"
                defaultValue={customInterestTagText}
                placeholder="직접 태그 추가: 반려동물, 안전교육"
                className="mt-3 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                직접 태그는 쉼표 또는 줄바꿈으로 구분합니다. 저장 시 최대 8개까지 정리됩니다.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <FieldLabel>기사 유형</FieldLabel>
                <select
                  name="articleType"
                  defaultValue={article?.articleType ?? "general"}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                >
                  {articlePublicInfoTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>기관 중요도</FieldLabel>
                <select
                  name="institutionPriority"
                  defaultValue={article?.institutionPriority ?? 3}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                >
                  {institutionPriorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  기관이 판단하는 정보 중요도입니다. 향후 관심사별 기사 순서를 계산할 때 사용됩니다.
                </p>
              </div>
              <div>
                <FieldLabel>긴급도</FieldLabel>
                <select
                  name="urgency"
                  defaultValue={article?.urgency ?? "normal"}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                >
                  {articleUrgencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  {articleUrgencyOptions.map((option) => `${option.label}: ${option.description}`).join(" / ")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>노출 시작</FieldLabel>
              <input
                name="validFrom"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(article?.validFrom)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div>
              <FieldLabel>노출 종료</FieldLabel>
              <input
                name="validUntil"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(article?.validUntil)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            기간을 비워두면 기간 제한 없음으로 저장됩니다.
          </p>
        </div>

        <div className="mt-5 rounded-lg border border-[#d8e8ff] bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SectionBadge tone="required">필수</SectionBadge>
            <p className="text-sm font-black text-[#092046]">노출 설정</p>
            <p className="text-xs font-semibold text-slate-500">기사 순서와 원본 PDF 연결 기준을 정합니다.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-[140px_minmax(0,1fr)_180px]">
            <div>
              <FieldLabel>순서</FieldLabel>
              <input
                name="sortOrder"
                type="number"
                min="0"
                defaultValue={article?.sortOrder ?? 0}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div>
              <FieldLabel>연결 원본 페이지</FieldLabel>
              <select
                name="pageId"
                defaultValue={article?.pageId ?? ""}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              >
                <option value="">페이지 미지정</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.pageNumber}쪽 · {page.title}
                  </option>
                ))}
              </select>
              {pages.length === 0 ? (
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  등록된 페이지 이미지가 없으면 오른쪽에 원본 PDF 쪽수를 직접 입력하세요.
                </p>
              ) : null}
            </div>
            <div>
              <FieldLabel>원본 PDF 쪽수 직접 입력</FieldLabel>
              <input
                name="sourcePageNumber"
                type="number"
                min="1"
                max={projectPageCount > 0 ? projectPageCount : undefined}
                defaultValue={article?.pageNumber ?? ""}
                placeholder={projectPageCount > 0 ? `1~${projectPageCount}` : "예: 3"}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-[#d8e8ff] bg-[#f7fbff] p-4">
            <div className="mb-3">
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">참여 콘텐츠 연결</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                설문·이벤트를 연결하면 공개 모바일 기사 하단에 참여 카드가 표시됩니다.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-end">
            <div>
              <FieldLabel>연결할 설문·이벤트</FieldLabel>
              <select
                name="surveyId"
                defaultValue={article?.surveyId ?? ""}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              >
                <option value="">연결 없음</option>
                {surveys.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    [{survey.status}] {survey.kind} · {survey.title} · {survey.questionCount}문항
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs font-semibold leading-5 text-slate-500 [word-break:keep-all]">
              진행 중이고 문항이 있는 참여 콘텐츠만 실제 공개 화면에 버튼으로 표시됩니다.
              {surveys.length === 0 ? " 먼저 참여 콘텐츠 화면에서 설문 또는 이벤트를 등록하세요." : ""}
            </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">본문과 선택 콘텐츠</p>
            <h3 className="mt-1 text-lg font-black text-[#092046]">본문 블록을 작성합니다.</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">이미지, URL, 영상, 지도는 필요한 경우에만 추가합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadStandardTemplate}
              className="rounded-lg border border-[#2f73b7] bg-white px-4 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
            >
              표준 기사 구성 불러오기
            </button>
            <StatusPill value={blockSummary || "블록 없음"} />
          </div>
        </div>

        <details className="mt-5 rounded-lg border border-[#d8e8ff] bg-[#f7fbff] p-4">
          <summary className="cursor-pointer text-sm font-black text-[#092046]">
            <SectionBadge tone="optional">선택</SectionBadge>
            <span className="ml-2">선택 콘텐츠 추가</span>
          </summary>
          <p className="mt-3 text-sm leading-6 text-slate-500">필요한 콘텐츠만 추가합니다.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {blockUseCases.map((item) => (
              <div key={item.title} className="rounded-lg border border-[#d8e8ff] bg-white px-4 py-3">
                <p className="text-sm font-black text-[#092046]">{item.title}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {editableBlockTypes.map((item) => {
              const theme = blockTypeThemes[item.type];

              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => addBlock(item.type)}
                  className={`group rounded-xl border px-3 py-3 text-left shadow-sm shadow-blue-950/5 transition hover:-translate-y-0.5 hover:shadow-md ${theme.button}`}
                >
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${theme.marker}`}>
                    + {item.label}
                  </span>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-slate-600">{item.help}</span>
                </button>
              );
            })}
          </div>
        </details>

        <div className="mt-5 rounded-lg border border-[#d8e8ff] bg-[#f7fbff] p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">이미지·URL 글꼴</p>
              <h4 className="text-base font-black text-[#092046]">선택 콘텐츠 표시 기준</h4>
            </div>
            <p className="text-xs font-semibold text-slate-500">프로젝트 기본값 따름 가능</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FontSelect
              name="captionFontAssetId"
              label="이미지 캡션 글꼴"
              fonts={fonts}
              defaultValue={article?.captionFontAssetId}
              inheritLabel="본문 글꼴 사용"
              help="이미지 블록의 캡션 문구에 적용됩니다."
            />
            <FontSelect
              name="buttonFontAssetId"
              label="URL 버튼 글꼴"
              fonts={fonts}
              defaultValue={article?.buttonFontAssetId}
              inheritLabel="본문 글꼴 사용"
              help="URL 버튼 블록의 버튼 문구에 적용됩니다."
            />
          </div>
          {fonts.length === 0 ? (
            <p className="mt-3 text-xs font-semibold text-slate-500">
              활성화된 폰트가 없어 시스템 기본 글꼴로 표시됩니다.
            </p>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {blocks.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-sky-200 bg-[#f7fbff] px-5 py-8 text-center">
              <p className="text-base font-black text-[#092046]">콘텐츠 블록이 없습니다.</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                삭제 후에도 새 문단, 이미지, URL 버튼, 영상 블록을 다시 추가할 수 있습니다.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {editableBlockTypes.map((item) => {
                  const theme = blockTypeThemes[item.type];

                  return (
                    <button
                      key={`empty-${item.type}`}
                      type="button"
                      onClick={() => addBlock(item.type)}
                      className={`group rounded-xl border px-3 py-3 text-left shadow-sm shadow-blue-950/5 transition hover:-translate-y-0.5 hover:shadow-md ${theme.button}`}
                    >
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${theme.marker}`}>
                        + {item.label}
                      </span>
                      <span className="mt-2 block text-xs font-semibold leading-5 text-slate-600">{item.help}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {blocks.map((block, index) => (
            <div key={block.id} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black text-[#184a88]">
                    {index + 1}번 블록 · {blockTypeLabels[block.type]}
                  </p>
                  {index === 0 ? (
                    <div className="mt-2">
                      <SectionBadge tone="required">첫 본문</SectionBadge>
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{getBlockGuide(block.type)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, "up")}
                    disabled={index === 0}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    위로
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, "down")}
                    disabled={index === blocks.length - 1}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    아래로
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void removeBlock(block.id);
                    }}
                    className="rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50"
                  >
                    블록 삭제
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)]">
                <div>
                  <FieldLabel>{getBlockTitleLabel(block.type)}</FieldLabel>
                  <input
                    value={block.title}
                    onChange={(event) => updateBlock(block.id, "title", event.target.value)}
                    placeholder={
                      block.type === "button_group" ? "예: 신청하기" : block.type === "paragraph" ? "소제목" : "표시 제목"
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <div>
                  <FieldLabel>{getBlockBodyLabel(block.type)}</FieldLabel>
                  {shouldUseTextarea(block.type) ? (
                    <textarea
                      value={block.body}
                      onChange={(event) => updateBlock(block.id, "body", event.target.value)}
                      placeholder={getBlockBodyPlaceholder(block.type)}
                      className="min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                    />
                  ) : (
                    <input
                      value={block.body}
                      onChange={(event) => updateBlock(block.id, "body", event.target.value)}
                      placeholder={getBlockBodyPlaceholder(block.type)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                    />
                  )}
                </div>
              </div>

              {block.type === "paragraph" ? (
                <div className="mt-4 max-w-xs">
                  <FieldLabel>이 문단 정렬 방식</FieldLabel>
                  <select
                    value={block.textAlignment}
                    onChange={(event) => updateBlockTextAlignment(block.id, event.currentTarget.value as ArticleTextAlignment)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  >
                    {articleTextAlignmentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {block.type === "image" && (
                <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <label className="flex-1 text-xs font-black text-[#092046]">
                      저장 이미지 불러오기
                      <select
                        defaultValue=""
                        className="mt-2 h-10 w-full rounded-md border border-sky-200 bg-white px-3 text-sm font-bold text-[#092046] outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                        onChange={(event) => {
                          const asset = imageAssets.find((item) => item.id === event.currentTarget.value);

                          if (asset) {
                            applyImageAssetToBlock(block.id, asset);
                          }

                          event.currentTarget.value = "";
                        }}
                      >
                        <option value="">
                          {imageAssets.length > 0 ? "소재 보관함 이미지 선택" : "저장된 이미지 소재 없음"}
                        </option>
                        {imageAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.title} · {asset.review}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-sky-700 px-3 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-800 hover:shadow-md">
                        {uploadingImageBlockId === block.id ? "업로드 중" : "로컬 이미지 업로드"}
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={uploadingImageBlockId === block.id}
                          onChange={(event) => {
                            void uploadImageFileToBlock(block.id, event.currentTarget.files?.[0]);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          void pasteClipboardUrlToBlock(block.id);
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-sky-300 bg-white px-3 text-xs font-black text-[#092046] transition hover:bg-white"
                      >
                        이미지 URL 붙여넣기
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">업로드 후 이미지 주소가 자동 입력됩니다.</p>
                  {block.body.trim() ? (
                    <div className="mt-4 rounded-lg border border-sky-100 bg-white p-3">
                      <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={block.body}
                          alt={block.title || "기사 이미지 미리보기"}
                          className="max-h-56 w-full object-contain"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="dd-btn dd-btn-secondary dd-btn-sm cursor-pointer">
                          이미지 교체
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            disabled={uploadingImageBlockId === block.id}
                            onChange={(event) => {
                              void uploadImageFileToBlock(block.id, event.currentTarget.files?.[0]);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        <ProjectFileDownloadLink
                          className="dd-btn dd-btn-secondary dd-btn-sm"
                          fileName={block.title || "article-image"}
                          path={getMobileAssetPathFromPreviewHref(block.body)}
                          projectSlug={projectSlug}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void removeBlock(block.id);
                          }}
                          className="dd-btn dd-btn-danger dd-btn-sm"
                        >
                          블록 삭제
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {isUrlBlockType(block.type) && block.type !== "image" && (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[#d8e8ff] bg-[#f7fbff] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold leading-5 text-slate-500">공유 주소를 붙여넣습니다.</p>
                  <button
                    type="button"
                    onClick={() => {
                      void pasteClipboardUrlToBlock(block.id);
                    }}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-[#2f73b7] bg-white px-3 text-xs font-black text-[#092046] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#eaf3ff] hover:shadow-md"
                  >
                    클립보드 주소 붙여넣기
                  </button>
                </div>
              )}

              {block.type === "audio" && (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold leading-5 text-slate-700">대본 파일을 불러올 수 있습니다.</p>
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-amber-600 px-3 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-700 hover:shadow-md">
                    대본 파일 불러오기
                    <input
                      type="file"
                      accept=".txt,.md,text/plain,text/markdown"
                      className="sr-only"
                      onChange={(event) => {
                        void importTextFileToBlock(block.id, event.currentTarget.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">저장 전 구성 확인</p>
              <h4 className="text-base font-black text-[#092046]">모바일 표시 순서</h4>
            </div>
            <p className="text-xs font-semibold text-slate-500">저장 후 미리보기 확인</p>
          </div>
          <div className="mt-4 space-y-2">
            {blocks.map((block, index) => (
              <div key={`preview-${block.id}`} className="rounded-lg bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#eaf2ff] px-2.5 py-1 text-xs font-black text-[#184a88]">
                    {index + 1}
                  </span>
                  <p className="text-sm font-black text-[#092046]">{blockTypeLabels[block.type]}</p>
                  {block.title ? <p className="text-sm font-bold text-slate-700">{block.title}</p> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{getBlockPreviewText(block)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-black text-[#092046]">
          <SectionBadge tone="advanced">고급 설정</SectionBadge>
          <span className="ml-2">상태, Word 원고, 문의 정보</span>
        </summary>
        <p className="mt-3 text-sm leading-6 text-slate-500">필요할 때만 수정합니다.</p>

        <div className="mt-5 rounded-lg border border-[#d8e8ff] bg-[#f7fbff] p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">선택</p>
            <h3 className="mt-1 text-lg font-black text-[#092046]">그래픽 효과</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              모바일 기사 화면에서 제목, 이미지, 버튼이 나타나는 방식을 선택합니다.
            </p>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div>
              <FieldLabel>그래픽 효과 기본값</FieldLabel>
              <select
                name="motionPreset"
                value={selectedMotionPreset}
                onChange={(event) => setSelectedMotionPreset(readArticleMotionPreset(event.currentTarget.value))}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              >
                {articleMotionPresetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="mt-3 grid gap-2">
                {articleMotionPresetOptions.map((option) => (
                  <p key={option.value} className="text-xs font-semibold leading-5 text-slate-600">
                    <span className="font-black text-[#092046]">{option.label}</span>: {option.description}
                  </p>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>효과 속도 기본값</FieldLabel>
              <select
                name="motionSpeed"
                value={selectedMotionSpeed}
                onChange={(event) => setSelectedMotionSpeed(readArticleMotionSpeed(event.currentTarget.value))}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              >
                {articleMotionSpeedOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="mt-3 grid gap-2">
                {articleMotionSpeedOptions.map((option) => (
                  <p key={option.value} className="text-xs font-semibold leading-5 text-slate-600">
                    <span className="font-black text-[#092046]">{option.label}</span>: {option.description}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">
            효과는 모바일 기사 화면과 작성자 모바일 미리보기에만 적용됩니다.
          </p>
          <details className="mt-4 rounded-lg border border-[#d8e8ff] bg-[#eef6ff] p-3">
            <summary className="cursor-pointer text-sm font-black text-[#092046]">
              세부 효과 설정
              <span className="ml-2 text-xs font-bold text-slate-500">요소별로 기본값을 덮어씁니다.</span>
            </summary>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <ElementMotionSettingRow
                effectName="titleMotionEffect"
                effectOptions={titleMotionEffectOptions}
                effectValue={titleMotionEffect}
                label="타이틀 효과"
                onEffectChange={setTitleMotionEffect}
                onSpeedChange={setTitleMotionSpeed}
                speedName="titleMotionSpeed"
                speedValue={titleMotionSpeed}
              />
              <ElementMotionSettingRow
                effectName="textBoxMotionEffect"
                effectOptions={textBoxMotionEffectOptions}
                effectValue={textBoxMotionEffect}
                label="텍스트 박스 효과"
                onEffectChange={setTextBoxMotionEffect}
                onSpeedChange={setTextBoxMotionSpeed}
                speedName="textBoxMotionSpeed"
                speedValue={textBoxMotionSpeed}
              />
              <ElementMotionSettingRow
                effectName="imageMotionEffect"
                effectOptions={imageMotionEffectOptions}
                effectValue={imageMotionEffect}
                label="이미지 효과"
                onEffectChange={setImageMotionEffect}
                onSpeedChange={setImageMotionSpeed}
                speedName="imageMotionSpeed"
                speedValue={imageMotionSpeed}
              />
              <ElementMotionSettingRow
                effectName="linkMotionEffect"
                effectOptions={linkMotionEffectOptions}
                effectValue={linkMotionEffect}
                label="URL 버튼 효과"
                onEffectChange={setLinkMotionEffect}
                onSpeedChange={setLinkMotionSpeed}
                speedName="linkMotionSpeed"
                speedValue={linkMotionSpeed}
              />
            </div>
          </details>
          <div className="mt-4">
            <ArticleMotionPreviewCard
              imageEffect={imageMotionEffect}
              imageSpeed={imageMotionSpeed}
              linkEffect={linkMotionEffect}
              linkSpeed={linkMotionSpeed}
              preset={selectedMotionPreset}
              speed={selectedMotionSpeed}
              summary={motionPreviewSummary}
              textBoxEffect={textBoxMotionEffect}
              textBoxSpeed={textBoxMotionSpeed}
              title={effectiveMobileTitle}
              titleEffect={titleMotionEffect}
              titleSpeed={titleMotionSpeed}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <FieldLabel>상태</FieldLabel>
            <select
              name="status"
              defaultValue={article?.status ?? "draft"}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
            >
              {articleStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-[#d8e8ff] bg-[#f7fbff] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Word 원고 가져오기</p>
                <h4 className="mt-1 text-base font-black text-[#092046]">.docx 원고를 모바일 기사 블록으로 변환</h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">제목과 문단 구조만 가져옵니다.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]">
                {isImportingWord ? "가져오는 중..." : "Word 원고 선택"}
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  disabled={isImportingWord}
                  onChange={(event) => {
                    void handleWordImport(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {wordImportMessage ? (
              <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-700">
                {wordImportMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">보조 설정</p>
          <h3 className="mt-1 text-lg font-black text-[#092046]">기사 공통 연락처</h3>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div>
              <FieldLabel>담당 부서 또는 담당자</FieldLabel>
              <input
                name="contactName"
                defaultValue={article?.contactName ?? ""}
                placeholder="예: 기획실 홍보팀"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div>
              <FieldLabel>전화번호</FieldLabel>
              <input
                name="contactPhone"
                defaultValue={article?.contactPhone ?? ""}
                placeholder="예: 061-000-0000"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
            </div>
          </div>
        </div>
      </details>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      {article ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-rose-700">위험 작업</p>
              <h3 className="mt-1 text-base font-black text-rose-900">기사 전체 삭제</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-rose-700">
                기사와 콘텐츠 블록만 삭제합니다. Storage 원본 이미지와 프로젝트 표지는 유지됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void deleteArticle();
              }}
              disabled={isDeletingArticle || isSaving}
              className="dd-btn dd-btn-danger shrink-0 px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeletingArticle ? "삭제 중" : "기사 삭제"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectSlug}/reading`)}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          새 기사 입력
        </button>
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectSlug}/publish`)}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          검수·발행으로 이동
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-[#092046] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "저장 중..." : article ? "기사 수정 저장" : "기사 신규 저장"}
        </button>
      </div>
    </form>
  );
}
