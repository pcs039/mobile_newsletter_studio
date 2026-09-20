import type { ArticlePublicInfoType, ArticleUrgency } from "@/lib/newsletter-repository";

export type ArticlePublicPresentation = {
  actionLinkClassName: string;
  contactLabelClassName: string;
  contactPanelClassName: string;
  isGeneral: boolean;
  mapLinkClassName: string;
  summaryClassName: string;
  summaryLabel: string;
  summaryLabelClassName: string;
  typeBadgeClassName: string;
  typeLabel: string;
  urgencyBadgeClassName: string;
  videoBlockClassName: string;
};

const defaultPresentation: ArticlePublicPresentation = {
  actionLinkClassName: "dd-btn dd-btn-primary block rounded-xl px-4 py-3 text-center text-sm font-black",
  contactLabelClassName: "text-xs font-black text-[#184a88]",
  contactPanelClassName: "mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700",
  isGeneral: true,
  mapLinkClassName: "block rounded-2xl border border-[#b8d7ff] bg-[#f4f8ff] px-4 py-4",
  summaryClassName: "mt-3 rounded-xl bg-[#f4f8ff] px-4 py-3 text-sm font-bold leading-6 text-[#092046]",
  summaryLabel: "",
  summaryLabelClassName: "text-xs font-black text-[#184a88]",
  typeBadgeClassName: "rounded-full border border-[#d8e8ff] bg-[#f4f8ff] px-3 py-1 text-xs font-black text-[#184a88]",
  typeLabel: "일반",
  urgencyBadgeClassName: "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-800",
  videoBlockClassName: "overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm",
};

const presentationByType: Record<ArticlePublicInfoType, ArticlePublicPresentation> = {
  general: defaultPresentation,
  welfare_health: {
    ...defaultPresentation,
    contactPanelClassName: "mt-5 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm leading-6 text-slate-700",
    isGeneral: false,
    summaryClassName: "mt-3 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm font-bold leading-6 text-[#092046]",
    summaryLabel: "복지·건강 핵심안내",
    summaryLabelClassName: "text-xs font-black text-teal-700",
    typeBadgeClassName: "rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-black text-teal-700",
    typeLabel: "복지·건강",
  },
  application_recruitment: {
    ...defaultPresentation,
    actionLinkClassName:
      "dd-btn dd-btn-primary block rounded-xl border border-[#092046] bg-[#092046] px-4 py-3 text-center text-sm font-black text-white shadow-md shadow-blue-950/15",
    contactPanelClassName: "mt-5 rounded-xl border border-[#b8d7ff] bg-[#f4f8ff] px-4 py-3 text-sm leading-6 text-slate-700",
    isGeneral: false,
    summaryClassName: "mt-3 rounded-xl border border-[#b8d7ff] bg-[#f4f8ff] px-4 py-3 text-sm font-bold leading-6 text-[#092046]",
    summaryLabel: "신청 핵심정보",
    typeBadgeClassName: "rounded-full border border-[#b8d7ff] bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]",
    typeLabel: "신청·모집",
  },
  event_festival: {
    ...defaultPresentation,
    actionLinkClassName:
      "dd-btn dd-btn-primary block rounded-xl border border-[#2f73b7] bg-[#184a88] px-4 py-3 text-center text-sm font-black text-white shadow-sm",
    isGeneral: false,
    mapLinkClassName: "block rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 shadow-sm shadow-sky-950/5",
    summaryClassName: "mt-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-bold leading-6 text-[#092046]",
    summaryLabel: "행사 핵심정보",
    typeBadgeClassName: "rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black text-[#184a88]",
    typeLabel: "축제·행사",
    videoBlockClassName: "overflow-hidden rounded-2xl border border-sky-200 bg-slate-950 text-white shadow-sm",
  },
  tourism_place: {
    ...defaultPresentation,
    isGeneral: false,
    mapLinkClassName: "block rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-4 shadow-sm shadow-teal-950/5",
    summaryClassName: "mt-3 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm font-bold leading-6 text-[#092046]",
    summaryLabel: "방문 핵심정보",
    summaryLabelClassName: "text-xs font-black text-teal-700",
    typeBadgeClassName: "rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-black text-teal-700",
    typeLabel: "관광·장소",
  },
  life_civil: {
    ...defaultPresentation,
    contactPanelClassName: "mt-5 rounded-xl border border-[#b8d7ff] bg-[#f8fbff] px-4 py-3 text-sm leading-6 text-slate-700",
    isGeneral: false,
    mapLinkClassName: "block rounded-2xl border border-[#b8d7ff] bg-[#f8fbff] px-4 py-4",
    summaryClassName: "mt-3 rounded-xl border border-[#d8e8ff] bg-[#f8fbff] px-4 py-3 text-sm font-bold leading-6 text-[#092046]",
    summaryLabel: "생활·민원 핵심정보",
    typeBadgeClassName: "rounded-full border border-[#d8e8ff] bg-white px-3 py-1 text-xs font-black text-[#184a88]",
    typeLabel: "생활·민원",
  },
  government_major: {
    ...defaultPresentation,
    isGeneral: false,
    summaryClassName: "mt-3 rounded-xl border border-[#092046]/15 bg-[#f4f8ff] px-4 py-3 text-sm font-bold leading-6 text-[#092046]",
    summaryLabel: "주요 내용",
    typeBadgeClassName: "rounded-full border border-[#092046]/20 bg-[#092046] px-3 py-1 text-xs font-black text-white",
    typeLabel: "시정·군정 주요소식",
  },
  local_news: {
    ...defaultPresentation,
    isGeneral: false,
    summaryClassName: "mt-3 rounded-xl border border-[#d8e8ff] bg-[#f8fbff] px-4 py-3 text-sm font-bold leading-6 text-[#092046]",
    summaryLabel: "우리동네 핵심정보",
    typeBadgeClassName: "rounded-full border border-[#d8e8ff] bg-[#f8fbff] px-3 py-1 text-xs font-black text-[#184a88]",
    typeLabel: "읍면동·지역소식",
  },
  emergency: {
    ...defaultPresentation,
    actionLinkClassName:
      "dd-btn dd-btn-primary block rounded-xl border border-amber-500 bg-amber-500 px-4 py-3 text-center text-sm font-black text-slate-950 shadow-sm",
    contactLabelClassName: "text-xs font-black text-amber-800",
    contactPanelClassName: "mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-slate-800",
    isGeneral: false,
    mapLinkClassName: "block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm shadow-amber-950/5",
    summaryClassName: "mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-slate-900",
    summaryLabel: "긴급 안내",
    summaryLabelClassName: "text-xs font-black text-amber-800",
    typeBadgeClassName: "rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-black text-amber-900",
    typeLabel: "긴급·안전",
  },
};

function parseTime(value: string | null | undefined) {
  const cleaned = value?.trim() ?? "";

  if (!cleaned) {
    return null;
  }

  const parsed = Date.parse(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

export function isArticleUrgencyCurrentlyRelevant({
  validFrom,
  validUntil,
}: {
  validFrom?: string | null;
  validUntil?: string | null;
}) {
  const now = Date.now();
  const startsAt = parseTime(validFrom);
  const endsAt = parseTime(validUntil);

  if (startsAt !== null && now < startsAt) {
    return false;
  }

  if (endsAt !== null && now > endsAt) {
    return false;
  }

  return true;
}

export function getArticlePublicPresentation(articleType: string | null | undefined) {
  return presentationByType[articleType as ArticlePublicInfoType] ?? defaultPresentation;
}

export function getArticleUrgencyLabel(urgency: string | null | undefined): string {
  const normalized = urgency as ArticleUrgency;

  if (normalized === "urgent") {
    return "긴급";
  }

  if (normalized === "time_sensitive") {
    return "시한성 정보";
  }

  return "";
}
