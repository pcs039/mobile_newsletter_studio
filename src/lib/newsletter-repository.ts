import { getSupabaseConfigStatus, getSupabaseRestEndpoint } from "@/lib/supabase-config";
import type { DashboardProject } from "@/types/newsletter";

type ProjectStatus = "draft" | "in_review" | "published" | "private" | "archived";
type PackageTier = "basic" | "standard" | "advanced" | "premium" | "retainer";
type ProductionMode = "template" | "hybrid" | "full_image" | "external_ebook";

type NewsletterProjectRow = {
  id: string;
  title: string;
  organization_name: string;
  assignee_name: string | null;
  issue_label: string | null;
  published_date: string | null;
  slug: string;
  description: string | null;
  primary_color: string;
  status: ProjectStatus;
  package_tier: PackageTier;
  production_mode: ProductionMode;
  estimated_hours: string | null;
  designer_hours_cap: string | null;
  pdf_original_path: string | null;
  pdf_original_file_name: string | null;
  pdf_original_uploaded_at: string | null;
  page_count: number;
  created_at: string;
  updated_at: string;
};

export type CreateNewsletterProjectInput = {
  title: string;
  issueLabel?: string;
  organizationName: string;
  assigneeName?: string;
  publishedDate: string;
  slug: string;
  description?: string;
  primaryColor: string;
  status: ProjectStatus;
  packageTier: PackageTier;
  productionMode: ProductionMode;
  estimatedHours?: string;
  designerHoursCap?: string;
};

export type UpdateNewsletterProjectInput = CreateNewsletterProjectInput & {
  projectId: string;
};

export type CreateNewsletterProjectResult =
  | {
      ok: true;
      project: Pick<NewsletterProjectRow, "id" | "slug" | "title">;
    }
  | {
      ok: false;
      status: "not_configured" | "request_failed" | "duplicate_slug";
      message: string;
      httpStatus?: number;
    };

export type UpdateNewsletterProjectResult =
  | {
      ok: true;
      project: Pick<NewsletterProjectRow, "id" | "slug" | "title">;
    }
  | {
      ok: false;
      status: "not_configured" | "request_failed" | "duplicate_slug" | "not_found";
      message: string;
      httpStatus?: number;
    };

export type ArchiveNewsletterProjectResult =
  | {
      ok: true;
      project: Pick<NewsletterProjectRow, "id" | "slug" | "title">;
    }
  | {
      ok: false;
      status: "not_configured" | "request_failed" | "not_found";
      message: string;
      httpStatus?: number;
    };

export type DashboardProjectsResult = {
  projects: DashboardProject[];
  source: "supabase" | "unconfigured" | "error";
  message: string;
};

export type ProjectWorkspaceInfo = {
  id: string;
  slug: string;
  title: string;
  organization: string;
  assigneeName: string;
  issue: string;
  description: string;
  primaryColor: string;
  status: string;
  publicUrl: string;
  ebookUrl: string;
  pageCount: number;
  updated: string;
};

export type ProjectWorkspaceResult =
  | {
      ok: true;
      project: ProjectWorkspaceInfo;
      source: "supabase";
      message: string;
    }
  | {
      ok: false;
      project: null;
      source: "unconfigured" | "error" | "not_found";
      message: string;
      httpStatus?: number;
    };

export type ProjectBasicInfo = {
  projectId: string;
  title: string;
  issueLabel: string;
  organizationName: string;
  assigneeName: string;
  publishedDate: string;
  slug: string;
  description: string;
  primaryColor: string;
  status: ProjectStatus;
  packageTier: PackageTier;
  productionMode: ProductionMode;
  estimatedHours: string;
  designerHoursCap: string;
};

export type ProjectBasicInfoResult =
  | {
      ok: true;
      project: ProjectBasicInfo;
      source: "supabase";
      message: string;
    }
  | {
      ok: false;
      project: null;
      source: "unconfigured" | "error" | "not_found";
      message: string;
      httpStatus?: number;
    };

type NewsletterPageRow = {
  id: string;
  page_number: number;
  title: string | null;
  image_path: string | null;
  image_status: string;
  updated_at: string;
};

type NewsletterAssetRow = {
  id: string;
  title: string;
  file_path: string;
  mime_type: string | null;
  source_type: string;
  rights_status: string | null;
  quality_status: string | null;
  usage_note: string | null;
  is_approved: boolean;
  updated_at: string;
};

type NewsletterAudioFileRow = {
  id: string;
  title: string;
  file_path: string;
  duration_seconds: number | null;
  script_status: string;
  pronunciation_note: string | null;
  updated_at: string;
};

type NewsletterDailyStatsRow = {
  project_id: string;
  stat_date: string;
  view_count: number;
};

type NewsletterDailyStatsUpdateRow = {
  id: string;
  view_count: number;
  mobile_count: number;
  pc_count: number;
  tablet_count: number;
  direct_count: number;
  referrer_count: number;
};

type ContentBlockType =
  | "paragraph"
  | "image"
  | "video_link"
  | "map_link"
  | "button_group"
  | "audio"
  | "overlay_notice";

type LinkActionType = "url" | "phone" | "map" | "video" | "internal_page" | "download";
type LinkDisplayStyle = "button" | "text_link" | "thumbnail_card" | "map_card";

type NewsletterArticleRow = {
  id: string;
  project_id: string;
  page_id: string | null;
  sort_order: number;
  title: string;
  summary: string | null;
  body: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
  representative_asset_id: string | null;
  audio_id: string | null;
  created_at: string;
  updated_at: string;
};

type NewsletterContentBlockRow = {
  id: string;
  project_id: string;
  article_id: string | null;
  block_type: ContentBlockType;
  title: string | null;
  body: string | null;
  asset_id: string | null;
  link_action_id: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  is_visible: boolean;
  updated_at: string;
};

type NewsletterLinkActionRow = {
  id: string;
  project_id: string;
  article_id: string | null;
  label: string;
  action_type: LinkActionType;
  target_value: string;
  display_style: LinkDisplayStyle;
  sort_order: number;
  is_visible: boolean;
  updated_at: string;
};

type ProjectViewStats = {
  today: number;
  yesterday: number;
  total: number;
};

export type ProjectPageImage = {
  id: string;
  pageNumber: number;
  title: string;
  imagePath: string | null;
  previewHref: string | null;
  status: string;
  updated: string;
};

export type ProjectPageImagesResult = {
  pages: ProjectPageImage[];
  source: "supabase" | "unconfigured" | "error" | "not_found";
  message: string;
};

export type ProjectOriginalPdf = {
  fileName: string;
  path: string;
  previewHref: string;
  uploadedAt: string;
};

export type ProjectOriginalPdfResult = {
  pdf: ProjectOriginalPdf | null;
  source: "supabase" | "unconfigured" | "error" | "not_found";
  message: string;
};

export type ProjectAssetFile = {
  id: string;
  title: string;
  filePath: string;
  previewHref: string;
  mimeType: string;
  source: string;
  rights: string;
  quality: string;
  usage: string;
  review: string;
  updated: string;
};

export type ProjectAssetFilesResult = {
  assets: ProjectAssetFile[];
  source: "supabase" | "unconfigured" | "error" | "not_found";
  message: string;
};

export type ProjectAudioFile = {
  id: string;
  title: string;
  filePath: string;
  previewHref: string;
  duration: string;
  scriptStatus: string;
  note: string;
  updated: string;
};

export type ProjectAudioFilesResult = {
  files: ProjectAudioFile[];
  source: "supabase" | "unconfigured" | "error" | "not_found";
  message: string;
};

export type ProjectContentBlock = {
  id: string;
  type: ContentBlockType;
  title: string;
  body: string;
  assetId: string | null;
  linkActionId: string | null;
  sortOrder: number;
  isVisible: boolean;
};

export type ProjectLinkAction = {
  id: string;
  label: string;
  actionType: LinkActionType;
  targetValue: string;
  displayStyle: LinkDisplayStyle;
  sortOrder: number;
  isVisible: boolean;
};

export type ProjectContentArticle = {
  id: string;
  pageId: string | null;
  pageNumber: number | null;
  sortOrder: number;
  title: string;
  summary: string;
  body: string;
  contactName: string;
  contactPhone: string;
  status: string;
  updated: string;
  blocks: ProjectContentBlock[];
  links: ProjectLinkAction[];
};

export type ProjectContentResult = {
  articles: ProjectContentArticle[];
  source: "supabase" | "unconfigured" | "error" | "not_found";
  message: string;
};

export type UpsertProjectArticleInput = {
  projectSlug: string;
  articleId?: string;
  pageId?: string;
  sortOrder?: number;
  title: string;
  summary?: string;
  body?: string;
  contentSections?: Array<{
    title?: string;
    body?: string;
    sortOrder?: number;
  }>;
  contentBlocks?: Array<{
    type: Extract<ContentBlockType, "paragraph" | "image" | "video_link" | "map_link" | "button_group" | "audio">;
    title?: string;
    body?: string;
    sortOrder?: number;
    assetId?: string | null;
  }>;
  contactName?: string;
  contactPhone?: string;
  status?: string;
  buttonLabel?: string;
  buttonTarget?: string;
  videoLabel?: string;
  videoUrl?: string;
  mapLabel?: string;
  mapUrl?: string;
  audioScript?: string;
};

export type UpsertProjectArticleResult =
  | {
      ok: true;
      article: Pick<ProjectContentArticle, "id" | "title">;
    }
  | {
      ok: false;
      status: "not_configured" | "not_found" | "request_failed" | "invalid_input";
      message: string;
      httpStatus?: number;
    };

export type RecordNewsletterViewInput = {
  slug: string;
  viewMode: "reading" | "ebook";
  routePath?: string;
  referrer?: string | null;
  userAgent?: string | null;
};

export type RecordNewsletterViewResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      status: "not_configured" | "not_found" | "request_failed";
      message: string;
      httpStatus?: number;
    };

const projectSelectColumns = [
  "id",
  "title",
  "organization_name",
  "assignee_name",
  "issue_label",
  "published_date",
  "slug",
  "description",
  "primary_color",
  "status",
  "package_tier",
  "production_mode",
  "estimated_hours",
  "designer_hours_cap",
  "pdf_original_path",
  "pdf_original_file_name",
  "pdf_original_uploaded_at",
  "page_count",
  "created_at",
  "updated_at",
].join(",");

const statusLabels: Record<ProjectStatus, string> = {
  draft: "제작 중",
  in_review: "검수 중",
  published: "발행 완료",
  private: "비공개",
  archived: "삭제됨",
};

const packageTierLabels: Record<PackageTier, string> = {
  basic: "기본형",
  standard: "표준형",
  advanced: "고급형",
  premium: "프리미엄",
  retainer: "월간 운영형",
};

const productionModeLabels: Record<ProductionMode, string> = {
  template: "템플릿 중심",
  hybrid: "템플릿+이미지 혼합",
  full_image: "전체 이미지형",
  external_ebook: "외부 e-book 연동",
};

const pageImageStatusLabels: Record<string, string> = {
  not_uploaded: "미등록",
  uploaded: "업로드 완료",
  in_review: "검수 중",
  approved: "검수 완료",
  replace_needed: "교체 필요",
};

const assetSourceLabels: Record<string, string> = {
  institution_original: "기관 제공",
  designer_created: "디자이너 제작",
  ai_generated: "AI 생성",
  pdf_extract: "PDF 발췌",
};

const audioScriptStatusLabels: Record<string, string> = {
  unchecked: "대본 검수 대기",
  approved: "대본 확인 완료",
  needs_revision: "대본 수정 필요",
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(value))
    .replace(/\s/g, "");
}

function formatCompactDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
  const timeKey = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));

  return `${dateKey.slice(2)} ${timeKey}`;
}

function makeIssueLabel(input: CreateNewsletterProjectInput) {
  return input.issueLabel?.trim() || null;
}

function normalizePublishedDate(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  if (/^\d{4}-\d{2}$/.test(date)) {
    return `${date}-01`;
  }

  return null;
}

function formatDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function makeWorkload(project: NewsletterProjectRow) {
  const estimated = project.estimated_hours ? `예상 ${project.estimated_hours}` : "예상 미정";
  const designer = project.designer_hours_cap ? `디자인 ${project.designer_hours_cap}` : "디자인 상한 미정";

  return `${estimated} · ${designer}`;
}

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds < 1) {
    return "-";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function makeStoragePreviewHref(bucket: string, path: string | null) {
  if (!path) {
    return null;
  }

  return `/api/project-files/preview?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
}

function formatKoreanDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getStatsDateKeys() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return {
    today: formatKoreanDateKey(today),
    yesterday: formatKoreanDateKey(yesterday),
  };
}

function makeEmptyStats(): ProjectViewStats {
  return {
    today: 0,
    yesterday: 0,
    total: 0,
  };
}

function detectDeviceType(userAgent: string | null | undefined) {
  const normalized = userAgent?.toLowerCase() ?? "";

  if (/ipad|tablet/.test(normalized)) {
    return "tablet";
  }

  if (/mobi|iphone|android/.test(normalized)) {
    return "mobile";
  }

  return "pc";
}

function getReferrerDomain(referrer: string | null | undefined) {
  if (!referrer) {
    return null;
  }

  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function mapProjectRowToDashboardProject(
  project: NewsletterProjectRow,
  stats: ProjectViewStats = makeEmptyStats(),
): DashboardProject {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    organization: project.organization_name,
    assigneeName: project.assignee_name?.trim() || "담당자 미지정",
    issue: project.issue_label ?? formatDate(project.published_date),
    status: statusLabels[project.status],
    pages: `${project.page_count}쪽`,
    reading: project.status === "published" ? "발행 완료" : "편집 대기",
    audio: "대기",
    packageTier: packageTierLabels[project.package_tier],
    productionMode: productionModeLabels[project.production_mode],
    workload: makeWorkload(project),
    updated: formatCompactDateTime(project.updated_at),
    views: {
      today: formatCount(stats.today),
      yesterday: formatCount(stats.yesterday),
      total: formatCount(stats.total),
    },
    actions: {
      editHref: `/projects/${project.slug}/pages`,
      previewHref: `/newsletters/${project.slug}?preview=admin`,
      analyticsHref: "#analytics-preview",
      duplicateHref: `/projects/new?copyFrom=${project.slug}`,
      archiveHref: "#archive-policy",
    },
  };
}

async function getProjectRowBySlug(slug: string, headers: Record<string, string>) {
  const encodedSlug = encodeURIComponent(slug);
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=${projectSelectColumns}&slug=eq.${encodedSlug}&deleted_at=is.null&limit=1`,
  );

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as NewsletterProjectRow[];

  return rows[0] ?? null;
}

async function getProjectViewStatsByProjectId(
  projectIds: string[],
  headers: Record<string, string>,
): Promise<Map<string, ProjectViewStats> | null> {
  if (projectIds.length === 0) {
    return new Map();
  }

  const idFilter = encodeURIComponent(`in.(${projectIds.join(",")})`);
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_daily_stats?select=project_id,stat_date,view_count&project_id=${idFilter}&order=stat_date.desc&limit=5000`,
  );

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as NewsletterDailyStatsRow[];
  const dateKeys = getStatsDateKeys();
  const statsByProjectId = new Map<string, ProjectViewStats>();

  for (const projectId of projectIds) {
    statsByProjectId.set(projectId, makeEmptyStats());
  }

  for (const row of rows) {
    const current = statsByProjectId.get(row.project_id) ?? makeEmptyStats();
    const viewCount = Number(row.view_count) || 0;

    current.total += viewCount;

    if (row.stat_date === dateKeys.today) {
      current.today += viewCount;
    }

    if (row.stat_date === dateKeys.yesterday) {
      current.yesterday += viewCount;
    }

    statsByProjectId.set(row.project_id, current);
  }

  return statsByProjectId;
}

async function insertViewEvent(
  projectId: string,
  input: RecordNewsletterViewInput,
  deviceType: string,
  referrerDomain: string | null,
  headers: Record<string, string>,
) {
  const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_view_events");

  if (!endpoint) {
    return;
  }

  await fetch(endpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      project_id: projectId,
      route_path: input.routePath || `/newsletters/${input.slug}`,
      view_mode: input.viewMode,
      device_type: deviceType,
      referrer_domain: referrerDomain,
    }),
    cache: "no-store",
  }).catch(() => null);
}

async function incrementDailyStats(
  projectId: string,
  deviceType: string,
  referrerDomain: string | null,
  headers: Record<string, string>,
) {
  const statDate = formatKoreanDateKey(new Date());
  const encodedProjectId = encodeURIComponent(projectId);
  const statsEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_daily_stats?select=id,view_count,mobile_count,pc_count,tablet_count,direct_count,referrer_count&project_id=eq.${encodedProjectId}&stat_date=eq.${statDate}&limit=1`,
  );

  if (!statsEndpoint) {
    return false;
  }

  const response = await fetch(statsEndpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  const rows = (await response.json()) as NewsletterDailyStatsUpdateRow[];
  const current = rows[0];
  const deviceField =
    deviceType === "mobile" ? "mobile_count" : deviceType === "tablet" ? "tablet_count" : "pc_count";
  const sourceField = referrerDomain ? "referrer_count" : "direct_count";

  if (!current) {
    const createEndpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_daily_stats");

    if (!createEndpoint) {
      return false;
    }

    const createResponse = await fetch(createEndpoint, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        project_id: projectId,
        stat_date: statDate,
        view_count: 1,
        mobile_count: deviceField === "mobile_count" ? 1 : 0,
        pc_count: deviceField === "pc_count" ? 1 : 0,
        tablet_count: deviceField === "tablet_count" ? 1 : 0,
        direct_count: sourceField === "direct_count" ? 1 : 0,
        referrer_count: sourceField === "referrer_count" ? 1 : 0,
      }),
      cache: "no-store",
    });

    return createResponse.ok;
  }

  const updateEndpoint = getSupabaseRestEndpoint(`/rest/v1/newsletter_daily_stats?id=eq.${current.id}`);

  if (!updateEndpoint) {
    return false;
  }

  const updateResponse = await fetch(updateEndpoint, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      view_count: current.view_count + 1,
      mobile_count: current.mobile_count + (deviceField === "mobile_count" ? 1 : 0),
      pc_count: current.pc_count + (deviceField === "pc_count" ? 1 : 0),
      tablet_count: current.tablet_count + (deviceField === "tablet_count" ? 1 : 0),
      direct_count: current.direct_count + (sourceField === "direct_count" ? 1 : 0),
      referrer_count: current.referrer_count + (sourceField === "referrer_count" ? 1 : 0),
    }),
    cache: "no-store",
  });

  return updateResponse.ok;
}

function mapProjectRowToWorkspaceInfo(project: NewsletterProjectRow): ProjectWorkspaceInfo {
  const issue = project.issue_label ?? formatDate(project.published_date);

  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    organization: project.organization_name,
    assigneeName: project.assignee_name?.trim() || "담당자 미지정",
    issue,
    description: project.description || "등록된 프로젝트 설명이 없습니다.",
    primaryColor: project.primary_color || "#092046",
    status: statusLabels[project.status],
    publicUrl: `/newsletters/${project.slug}`,
    ebookUrl: `/newsletters/${project.slug}/ebook`,
    pageCount: project.page_count,
    updated: formatCompactDateTime(project.updated_at),
  };
}

function mapProjectRowToBasicInfo(project: NewsletterProjectRow): ProjectBasicInfo {
  return {
    projectId: project.slug,
    title: project.title,
    issueLabel: project.issue_label || "",
    organizationName: project.organization_name,
    assigneeName: project.assignee_name?.trim() || "",
    publishedDate: formatDateInput(project.published_date),
    slug: project.slug,
    description: project.description || "",
    primaryColor: project.primary_color || "#092046",
    status: project.status,
    packageTier: project.package_tier,
    productionMode: project.production_mode,
    estimatedHours: project.estimated_hours || "",
    designerHoursCap: project.designer_hours_cap || "",
  };
}

function mapPageRowToProjectPageImage(page: NewsletterPageRow): ProjectPageImage {
  return {
    id: page.id,
    pageNumber: page.page_number,
    title: page.title || `${page.page_number}쪽`,
    imagePath: page.image_path,
    previewHref: makeStoragePreviewHref("page-images", page.image_path),
    status: pageImageStatusLabels[page.image_status] ?? page.image_status,
    updated: formatCompactDateTime(page.updated_at),
  };
}

function mapProjectRowToOriginalPdf(project: NewsletterProjectRow): ProjectOriginalPdf | null {
  if (!project.pdf_original_path) {
    return null;
  }

  return {
    fileName: project.pdf_original_file_name || "PDF 원본",
    path: project.pdf_original_path,
    previewHref: makeStoragePreviewHref("pdf-originals", project.pdf_original_path) ?? "",
    uploadedAt: formatCompactDateTime(project.pdf_original_uploaded_at),
  };
}

function mapAssetRowToProjectAssetFile(asset: NewsletterAssetRow): ProjectAssetFile {
  return {
    id: asset.id,
    title: asset.title,
    filePath: asset.file_path,
    previewHref: makeStoragePreviewHref("mobile-assets", asset.file_path) ?? "",
    mimeType: asset.mime_type || "image/*",
    source: assetSourceLabels[asset.source_type] ?? asset.source_type,
    rights: asset.rights_status || "권리 확인 필요",
    quality: asset.quality_status || "검수 대기",
    usage: asset.usage_note || "사용 위치 미지정",
    review: asset.is_approved ? "검수 완료" : "검수 대기",
    updated: formatCompactDateTime(asset.updated_at),
  };
}

function mapAudioRowToProjectAudioFile(file: NewsletterAudioFileRow): ProjectAudioFile {
  return {
    id: file.id,
    title: file.title,
    filePath: file.file_path,
    previewHref: makeStoragePreviewHref("audio-files", file.file_path) ?? "",
    duration: formatDuration(file.duration_seconds),
    scriptStatus: audioScriptStatusLabels[file.script_status] ?? file.script_status,
    note: file.pronunciation_note || "검수 메모 없음",
    updated: formatCompactDateTime(file.updated_at),
  };
}

function mapContentBlockRowToProjectBlock(block: NewsletterContentBlockRow): ProjectContentBlock {
  return {
    id: block.id,
    type: block.block_type,
    title: block.title || "",
    body: block.body || "",
    assetId: block.asset_id,
    linkActionId: block.link_action_id,
    sortOrder: block.sort_order,
    isVisible: block.is_visible,
  };
}

function mapLinkActionRowToProjectLink(action: NewsletterLinkActionRow): ProjectLinkAction {
  return {
    id: action.id,
    label: action.label,
    actionType: action.action_type,
    targetValue: action.target_value,
    displayStyle: action.display_style,
    sortOrder: action.sort_order,
    isVisible: action.is_visible,
  };
}

function mapArticleRowToProjectContentArticle(
  article: NewsletterArticleRow,
  blocks: NewsletterContentBlockRow[],
  links: NewsletterLinkActionRow[],
  pageNumberById: Map<string, number>,
): ProjectContentArticle {
  return {
    id: article.id,
    pageId: article.page_id,
    pageNumber: article.page_id ? pageNumberById.get(article.page_id) ?? null : null,
    sortOrder: article.sort_order,
    title: article.title,
    summary: article.summary || "",
    body: article.body || "",
    contactName: article.contact_name || "",
    contactPhone: article.contact_phone || "",
    status: article.status,
    updated: formatCompactDateTime(article.updated_at),
    blocks: blocks.map(mapContentBlockRowToProjectBlock),
    links: links.map(mapLinkActionRowToProjectLink),
  };
}

function cleanText(value: string | undefined) {
  return value?.trim() ?? "";
}

function nullableText(value: string | undefined) {
  const cleaned = cleanText(value);

  return cleaned.length > 0 ? cleaned : null;
}

function normalizeArticleStatus(value: string | undefined) {
  const allowed = ["draft", "editing", "review", "approved", "published", "needs_revision"];
  const cleaned = cleanText(value);

  return allowed.includes(cleaned) ? cleaned : "draft";
}

function normalizeArticleSortOrder(value: number | undefined) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function normalizeContentSections(sections: UpsertProjectArticleInput["contentSections"]) {
  return (sections ?? [])
    .map((section, index) => ({
      title: nullableText(section.title),
      body: nullableText(section.body),
      sortOrder: normalizeArticleSortOrder(section.sortOrder) || (index + 1) * 10,
    }))
    .filter((section) => section.title || section.body);
}

function normalizeContentBlocks(blocks: UpsertProjectArticleInput["contentBlocks"]) {
  return (blocks ?? [])
    .map((block, index) => ({
      type: block.type,
      title: nullableText(block.title),
      body: nullableText(block.body),
      sortOrder: normalizeArticleSortOrder(block.sortOrder) || (index + 1) * 10,
      assetId: block.assetId || null,
    }))
    .filter((block) => {
      if (block.type === "paragraph") {
        return block.title || block.body;
      }

      if (block.type === "audio") {
        return block.body;
      }

      return block.body;
    });
}

function detectLinkActionType(value: string, fallback: LinkActionType): LinkActionType {
  const normalized = value.trim().toLowerCase();

  if (/^tel:/.test(normalized) || /^[0-9-]{7,}$/.test(normalized)) {
    return "phone";
  }

  return fallback;
}

function makeArticleIdFilter(articleIds: string[]) {
  return encodeURIComponent(`in.(${articleIds.join(",")})`);
}

function getRequestHeaders(useServiceRole = false) {
  const config = getSupabaseConfigStatus();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = useServiceRole ? serviceRoleKey : serviceRoleKey || config.anonKey;

  if (!key) {
    return null;
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function getDashboardProjects(): Promise<DashboardProjectsResult> {
  const config = getSupabaseConfigStatus();
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=${projectSelectColumns}&deleted_at=is.null&order=updated_at.desc&limit=20`,
  );
  const headers = getRequestHeaders();

  if (!config.isConfigured || !endpoint || !headers) {
    return {
      projects: [],
      source: "unconfigured",
      message: "Supabase 환경변수 설정 후 실제 프로젝트 데이터를 표시합니다.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        projects: [],
        source: "error",
        message: "Supabase 조회에 실패했습니다. 연결 상태와 권한을 확인하세요.",
      };
    }

    const rows = (await response.json()) as NewsletterProjectRow[];

    if (rows.length === 0) {
      return {
        projects: [],
        source: "supabase" as const,
        message: "Supabase에 등록된 프로젝트가 아직 없습니다.",
      };
    }

    const statsByProjectId = await getProjectViewStatsByProjectId(
      rows.map((project) => project.id),
      headers,
    );

    return {
      projects: rows.map((project) => mapProjectRowToDashboardProject(project, statsByProjectId?.get(project.id))),
      source: "supabase" as const,
      message: statsByProjectId
        ? "Supabase 프로젝트와 접속 통계 데이터를 표시합니다."
        : "Supabase 프로젝트 데이터를 표시합니다. 접속 통계 테이블 권한은 확인이 필요합니다.",
    };
  } catch {
    return {
      projects: [],
      source: "error",
      message: "Supabase 요청 중 오류가 발생했습니다. 연결 상태를 확인하세요.",
    };
  }
}

export async function recordNewsletterView(input: RecordNewsletterViewInput): Promise<RecordNewsletterViewResult> {
  const config = getSupabaseConfigStatus();
  const headers = getRequestHeaders(true);
  const slug = input.slug.trim();

  if (!config.isConfigured || !headers || !config.hasServiceRoleKey) {
    return {
      ok: false,
      status: "not_configured",
      message: "Supabase 환경변수와 서버 저장 키 설정 후 접속 통계를 기록합니다.",
    };
  }

  if (!slug) {
    return {
      ok: false,
      status: "not_found",
      message: "접속 통계를 기록할 프로젝트 주소가 필요합니다.",
    };
  }

  try {
    const project = await getProjectRowBySlug(slug, headers);

    if (!project) {
      return {
        ok: false,
        status: "not_found",
        message: "접속 통계를 기록할 프로젝트를 찾지 못했습니다.",
        httpStatus: 404,
      };
    }

    const deviceType = detectDeviceType(input.userAgent);
    const referrerDomain = getReferrerDomain(input.referrer);

    await insertViewEvent(project.id, input, deviceType, referrerDomain, headers);

    const updated = await incrementDailyStats(project.id, deviceType, referrerDomain, headers);

    if (!updated) {
      return {
        ok: false,
        status: "request_failed",
        message: "접속 통계 일별 집계 저장에 실패했습니다.",
      };
    }

    return {
      ok: true,
      message: "접속 통계를 기록했습니다.",
    };
  } catch {
    return {
      ok: false,
      status: "request_failed",
      message: "접속 통계 기록 중 오류가 발생했습니다.",
    };
  }
}

export async function getEditableProjects(): Promise<DashboardProjectsResult> {
  const dashboardData = await getDashboardProjects();

  return {
    ...dashboardData,
    projects: dashboardData.projects.filter(
      (project) => project.status !== "발행 완료" && project.status !== "삭제됨",
    ),
    message:
      dashboardData.source === "supabase"
        ? "작성과 수정이 필요한 프로젝트만 표시합니다."
        : dashboardData.message,
  };
}

export async function getProjectWorkspace(projectSlug: string): Promise<ProjectWorkspaceResult> {
  const config = getSupabaseConfigStatus();
  const encodedSlug = encodeURIComponent(projectSlug);
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=${projectSelectColumns}&slug=eq.${encodedSlug}&deleted_at=is.null&limit=1`,
  );
  const headers = getRequestHeaders();

  if (!config.isConfigured || !endpoint || !headers) {
    return {
      ok: false,
      project: null,
      source: "unconfigured",
      message: "Supabase 환경변수 설정 후 실제 프로젝트 정보를 표시합니다.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        project: null,
        source: "error",
        message: "Supabase 프로젝트 조회에 실패했습니다.",
        httpStatus: response.status,
      };
    }

    const rows = (await response.json()) as NewsletterProjectRow[];
    const project = rows[0];

    if (!project) {
      return {
        ok: false,
        project: null,
        source: "not_found",
        message: "해당 slug의 프로젝트를 찾지 못했습니다.",
        httpStatus: 404,
      };
    }

    return {
      ok: true,
      project: mapProjectRowToWorkspaceInfo(project),
      source: "supabase",
      message: "Supabase 프로젝트 정보를 표시합니다.",
    };
  } catch {
    return {
      ok: false,
      project: null,
      source: "error",
      message: "Supabase 프로젝트 조회 중 오류가 발생했습니다.",
    };
  }
}

export async function getProjectBasicInfo(projectSlug: string): Promise<ProjectBasicInfoResult> {
  const config = getSupabaseConfigStatus();
  const headers = getRequestHeaders();

  if (!config.isConfigured || !headers) {
    return {
      ok: false,
      project: null,
      source: "unconfigured",
      message: "Supabase 환경변수 설정 후 프로젝트 기본 정보를 수정할 수 있습니다.",
    };
  }

  try {
    const project = await getProjectRowBySlug(projectSlug, headers);

    if (!project) {
      return {
        ok: false,
        project: null,
        source: "not_found",
        message: "수정할 프로젝트를 찾지 못했습니다.",
        httpStatus: 404,
      };
    }

    return {
      ok: true,
      project: mapProjectRowToBasicInfo(project),
      source: "supabase",
      message: "프로젝트 기본 정보를 수정합니다.",
    };
  } catch {
    return {
      ok: false,
      project: null,
      source: "error",
      message: "프로젝트 기본 정보 조회 중 오류가 발생했습니다.",
    };
  }
}

export async function getProjectPageImages(projectSlug: string): Promise<ProjectPageImagesResult> {
  const workspace = await getProjectWorkspace(projectSlug);

  if (!workspace.ok) {
    return {
      pages: [],
      source: workspace.source,
      message: workspace.message,
    };
  }

  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_pages?select=id,page_number,title,image_path,image_status,updated_at&project_id=eq.${encodeURIComponent(
      workspace.project.id,
    )}&order=page_number.asc`,
  );
  const headers = getRequestHeaders();

  if (!endpoint || !headers) {
    return {
      pages: [],
      source: "unconfigured",
      message: "Supabase 환경변수 설정 후 페이지 이미지 목록을 표시합니다.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        pages: [],
        source: "error",
        message: "페이지 이미지 목록 조회에 실패했습니다.",
      };
    }

    const rows = (await response.json()) as NewsletterPageRow[];

    return {
      pages: rows.map(mapPageRowToProjectPageImage),
      source: "supabase",
      message: rows.length > 0 ? "등록된 페이지 이미지를 표시합니다." : "등록된 페이지 이미지가 아직 없습니다.",
    };
  } catch {
    return {
      pages: [],
      source: "error",
      message: "페이지 이미지 목록 조회 중 오류가 발생했습니다.",
    };
  }
}

export async function getProjectOriginalPdf(projectSlug: string): Promise<ProjectOriginalPdfResult> {
  const config = getSupabaseConfigStatus();
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=${projectSelectColumns}&slug=eq.${encodeURIComponent(
      projectSlug,
    )}&deleted_at=is.null&limit=1`,
  );
  const headers = getRequestHeaders(true);

  if (!config.isConfigured || !endpoint || !headers) {
    return {
      pdf: null,
      source: "unconfigured",
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 PDF 원본 등록 현황을 표시합니다.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        pdf: null,
        source: "error",
        message: "PDF 원본 등록 현황 조회에 실패했습니다.",
      };
    }

    const rows = (await response.json()) as NewsletterProjectRow[];
    const project = rows[0];

    if (!project) {
      return {
        pdf: null,
        source: "not_found",
        message: "해당 slug의 프로젝트를 찾지 못했습니다.",
      };
    }

    const pdf = mapProjectRowToOriginalPdf(project);

    return {
      pdf,
      source: "supabase",
      message: pdf ? "등록된 PDF 원본을 표시합니다." : "PDF 원본이 아직 등록되지 않았습니다.",
    };
  } catch {
    return {
      pdf: null,
      source: "error",
      message: "PDF 원본 등록 현황 조회 중 오류가 발생했습니다.",
    };
  }
}

export async function getProjectAssetFiles(projectSlug: string): Promise<ProjectAssetFilesResult> {
  const workspace = await getProjectWorkspace(projectSlug);

  if (!workspace.ok) {
    return {
      assets: [],
      source: workspace.source,
      message: workspace.message,
    };
  }

  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_assets?select=id,title,file_path,mime_type,source_type,rights_status,quality_status,usage_note,is_approved,updated_at&project_id=eq.${encodeURIComponent(
      workspace.project.id,
    )}&order=updated_at.desc&limit=100`,
  );
  const headers = getRequestHeaders(true);

  if (!endpoint || !headers) {
    return {
      assets: [],
      source: "unconfigured",
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 이미지 자산 목록을 표시합니다.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        assets: [],
        source: "error",
        message: "이미지 자산 목록 조회에 실패했습니다.",
      };
    }

    const rows = (await response.json()) as NewsletterAssetRow[];

    return {
      assets: rows.map(mapAssetRowToProjectAssetFile),
      source: "supabase",
      message: rows.length > 0 ? "Supabase에 등록된 이미지 자산을 표시합니다." : "등록된 이미지 자산이 아직 없습니다.",
    };
  } catch {
    return {
      assets: [],
      source: "error",
      message: "이미지 자산 목록 조회 중 오류가 발생했습니다.",
    };
  }
}

export async function getProjectAudioFiles(projectSlug: string): Promise<ProjectAudioFilesResult> {
  const workspace = await getProjectWorkspace(projectSlug);

  if (!workspace.ok) {
    return {
      files: [],
      source: workspace.source,
      message: workspace.message,
    };
  }

  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_audio_files?select=id,title,file_path,duration_seconds,script_status,pronunciation_note,updated_at&project_id=eq.${encodeURIComponent(
      workspace.project.id,
    )}&order=updated_at.desc&limit=100`,
  );
  const headers = getRequestHeaders(true);

  if (!endpoint || !headers) {
    return {
      files: [],
      source: "unconfigured",
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 MP3 목록과 재생기를 표시합니다.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        files: [],
        source: "error",
        message: "MP3 파일 목록 조회에 실패했습니다.",
      };
    }

    const rows = (await response.json()) as NewsletterAudioFileRow[];

    return {
      files: rows.map(mapAudioRowToProjectAudioFile),
      source: "supabase",
      message: rows.length > 0 ? "Supabase에 등록된 MP3 파일을 표시합니다." : "등록된 MP3 파일이 아직 없습니다.",
    };
  } catch {
    return {
      files: [],
      source: "error",
      message: "MP3 파일 목록 조회 중 오류가 발생했습니다.",
    };
  }
}

async function fetchArticleBlocks(articleIds: string[], headers: Record<string, string>) {
  if (articleIds.length === 0) {
    return [];
  }

  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_content_blocks?select=id,project_id,article_id,block_type,title,body,asset_id,link_action_id,sort_order,metadata,is_visible,updated_at&article_id=${makeArticleIdFilter(
      articleIds,
    )}&order=sort_order.asc`,
  );

  if (!endpoint) {
    return [];
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as NewsletterContentBlockRow[];
}

async function fetchArticleLinks(articleIds: string[], headers: Record<string, string>) {
  if (articleIds.length === 0) {
    return [];
  }

  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_link_actions?select=id,project_id,article_id,label,action_type,target_value,display_style,sort_order,is_visible,updated_at&article_id=${makeArticleIdFilter(
      articleIds,
    )}&order=sort_order.asc`,
  );

  if (!endpoint) {
    return [];
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as NewsletterLinkActionRow[];
}

async function fetchProjectPageNumbers(projectId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_pages?select=id,page_number&project_id=eq.${encodeURIComponent(projectId)}&order=page_number.asc`,
  );

  if (!endpoint) {
    return new Map<string, number>();
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return new Map<string, number>();
  }

  const rows = (await response.json()) as Array<{ id: string; page_number: number }>;

  return new Map(rows.map((row) => [row.id, row.page_number]));
}

export async function getProjectContent(projectSlug: string): Promise<ProjectContentResult> {
  const workspace = await getProjectWorkspace(projectSlug);

  if (!workspace.ok) {
    return {
      articles: [],
      source: workspace.source,
      message: workspace.message,
    };
  }

  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_articles?select=id,project_id,page_id,sort_order,title,summary,body,contact_name,contact_phone,status,representative_asset_id,audio_id,created_at,updated_at&project_id=eq.${encodeURIComponent(
      workspace.project.id,
    )}&order=sort_order.asc&order=updated_at.desc`,
  );
  const headers = getRequestHeaders(true);

  if (!endpoint || !headers) {
    return {
      articles: [],
      source: "unconfigured",
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 기사 작성 데이터를 표시합니다.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        articles: [],
        source: "error",
        message: "기사 작성 데이터 조회에 실패했습니다.",
      };
    }

    const articleRows = (await response.json()) as NewsletterArticleRow[];
    const articleIds = articleRows.map((article) => article.id);
    const [blockRows, linkRows, pageNumberById] = await Promise.all([
      fetchArticleBlocks(articleIds, headers),
      fetchArticleLinks(articleIds, headers),
      fetchProjectPageNumbers(workspace.project.id, headers),
    ]);

    return {
      articles: articleRows.map((article) =>
        mapArticleRowToProjectContentArticle(
          article,
          blockRows.filter((block) => block.article_id === article.id),
          linkRows.filter((link) => link.article_id === article.id),
          pageNumberById,
        ),
      ),
      source: "supabase",
      message:
        articleRows.length > 0
          ? "Supabase에 저장된 모바일 기사 작성 데이터를 표시합니다."
          : "등록된 모바일 기사 작성 데이터가 아직 없습니다.",
    };
  } catch {
    return {
      articles: [],
      source: "error",
      message: "기사 작성 데이터 조회 중 오류가 발생했습니다.",
    };
  }
}

async function insertArticleLinkAction(
  projectId: string,
  articleId: string,
  action: {
    label: string;
    actionType: LinkActionType;
    targetValue: string;
    displayStyle: LinkDisplayStyle;
    sortOrder: number;
  },
  headers: Record<string, string>,
) {
  const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_link_actions?select=id");

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      project_id: projectId,
      article_id: articleId,
      label: action.label,
      action_type: action.actionType,
      target_value: action.targetValue,
      display_style: action.displayStyle,
      sort_order: action.sortOrder,
      is_visible: true,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as Array<{ id: string }>;

  return rows[0]?.id ?? null;
}

async function replaceArticleBlocks(
  projectId: string,
  articleId: string,
  input: UpsertProjectArticleInput,
  headers: Record<string, string>,
) {
  const encodedArticleId = encodeURIComponent(articleId);
  const blocksEndpoint = getSupabaseRestEndpoint(`/rest/v1/newsletter_content_blocks?article_id=eq.${encodedArticleId}`);
  const linksEndpoint = getSupabaseRestEndpoint(`/rest/v1/newsletter_link_actions?article_id=eq.${encodedArticleId}`);

  if (!blocksEndpoint || !linksEndpoint) {
    return false;
  }

  const [deleteBlocksResponse, deleteLinksResponse] = await Promise.all([
    fetch(blocksEndpoint, {
      method: "DELETE",
      headers,
      cache: "no-store",
    }),
    fetch(linksEndpoint, {
      method: "DELETE",
      headers,
      cache: "no-store",
    }),
  ]);

  if (!deleteBlocksResponse.ok || !deleteLinksResponse.ok) {
    return false;
  }

  const blocks: Array<{
    block_type: ContentBlockType;
    title: string | null;
    body: string | null;
    asset_id?: string | null;
    link_action_id?: string | null;
    sort_order: number;
    metadata?: Record<string, unknown>;
  }> = [];
  const contentBlocks = normalizeContentBlocks(input.contentBlocks);

  if (contentBlocks.length > 0) {
    for (const block of contentBlocks) {
      let linkActionId: string | null = null;

      if (block.type === "button_group" && block.body) {
        linkActionId = await insertArticleLinkAction(
          projectId,
          articleId,
          {
            label: block.title || "바로가기",
            actionType: detectLinkActionType(block.body, "url"),
            targetValue: block.body,
            displayStyle: "button",
            sortOrder: block.sortOrder,
          },
          headers,
        );
      }

      if (block.type === "video_link" && block.body) {
        linkActionId = await insertArticleLinkAction(
          projectId,
          articleId,
          {
            label: block.title || "영상 보기",
            actionType: "video",
            targetValue: block.body,
            displayStyle: "thumbnail_card",
            sortOrder: block.sortOrder,
          },
          headers,
        );
      }

      if (block.type === "map_link" && block.body) {
        linkActionId = await insertArticleLinkAction(
          projectId,
          articleId,
          {
            label: block.title || "지도 보기",
            actionType: "map",
            targetValue: block.body,
            displayStyle: "map_card",
            sortOrder: block.sortOrder,
          },
          headers,
        );
      }

      if ((block.type === "button_group" || block.type === "video_link" || block.type === "map_link") && !linkActionId) {
        return false;
      }

      blocks.push({
        block_type: block.type,
        title: block.title,
        body: block.body,
        asset_id: block.assetId,
        link_action_id: linkActionId,
        sort_order: block.sortOrder,
      });
    }
  } else {
    const contentSections = normalizeContentSections(input.contentSections);

    if (contentSections.length > 0) {
      contentSections.forEach((section, index) => {
        blocks.push({
          block_type: "paragraph",
          title: section.title,
          body: section.body,
          sort_order: section.sortOrder || (index + 1) * 10,
        });
      });
    } else if (cleanText(input.body)) {
      blocks.push({
        block_type: "paragraph",
        title: null,
        body: cleanText(input.body),
        sort_order: 10,
      });
    }

    const buttonTarget = cleanText(input.buttonTarget);
    const videoUrl = cleanText(input.videoUrl);
    const mapUrl = cleanText(input.mapUrl);

    if (buttonTarget && cleanText(input.buttonLabel)) {
      const linkActionId = await insertArticleLinkAction(
        projectId,
        articleId,
        {
          label: cleanText(input.buttonLabel),
          actionType: detectLinkActionType(buttonTarget, "url"),
          targetValue: buttonTarget,
          displayStyle: "button",
          sortOrder: 20,
        },
        headers,
      );

      if (!linkActionId) {
        return false;
      }

      blocks.push({
        block_type: "button_group",
        title: cleanText(input.buttonLabel),
        body: buttonTarget,
        link_action_id: linkActionId,
        sort_order: 20,
      });
    }

    if (videoUrl) {
      const linkActionId = await insertArticleLinkAction(
        projectId,
        articleId,
        {
          label: cleanText(input.videoLabel) || "영상 보기",
          actionType: "video",
          targetValue: videoUrl,
          displayStyle: "thumbnail_card",
          sortOrder: 30,
        },
        headers,
      );

      if (!linkActionId) {
        return false;
      }

      blocks.push({
        block_type: "video_link",
        title: cleanText(input.videoLabel) || "영상 보기",
        body: videoUrl,
        link_action_id: linkActionId,
        sort_order: 30,
      });
    }

    if (mapUrl) {
      const linkActionId = await insertArticleLinkAction(
        projectId,
        articleId,
        {
          label: cleanText(input.mapLabel) || "지도 보기",
          actionType: "map",
          targetValue: mapUrl,
          displayStyle: "map_card",
          sortOrder: 40,
        },
        headers,
      );

      if (!linkActionId) {
        return false;
      }

      blocks.push({
        block_type: "map_link",
        title: cleanText(input.mapLabel) || "지도 보기",
        body: mapUrl,
        link_action_id: linkActionId,
        sort_order: 40,
      });
    }

    if (cleanText(input.audioScript)) {
      blocks.push({
        block_type: "audio",
        title: "음성 대본",
        body: cleanText(input.audioScript),
        sort_order: 50,
      });
    }
  }

  if (blocks.length === 0) {
    return true;
  }

  const createBlocksEndpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_content_blocks");

  if (!createBlocksEndpoint) {
    return false;
  }

  const createBlocksResponse = await fetch(createBlocksEndpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(
      blocks.map((block) => ({
        project_id: projectId,
        article_id: articleId,
        block_type: block.block_type,
        title: block.title,
        body: block.body,
        asset_id: block.asset_id ?? null,
        link_action_id: block.link_action_id ?? null,
        sort_order: block.sort_order,
        metadata: block.metadata ?? {},
        is_visible: true,
      })),
    ),
    cache: "no-store",
  });

  return createBlocksResponse.ok;
}

export async function upsertProjectArticle(
  input: UpsertProjectArticleInput,
): Promise<UpsertProjectArticleResult> {
  const headers = getRequestHeaders(true);

  if (!headers) {
    return {
      ok: false,
      status: "not_configured",
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 기사 저장을 사용할 수 있습니다.",
    };
  }

  const title = cleanText(input.title);
  const projectSlug = cleanText(input.projectSlug);

  if (!projectSlug || !title) {
    return {
      ok: false,
      status: "invalid_input",
      message: "프로젝트와 기사 제목은 필수입니다.",
    };
  }

  try {
    const project = await getProjectRowBySlug(projectSlug, headers);

    if (!project) {
      return {
        ok: false,
        status: "not_found",
        message: "기사 저장 대상 프로젝트를 찾지 못했습니다.",
        httpStatus: 404,
      };
    }

    const articleBody = {
      project_id: project.id,
      page_id: nullableText(input.pageId),
      sort_order: normalizeArticleSortOrder(input.sortOrder),
      title,
      summary: nullableText(input.summary),
      body: nullableText(input.body),
      contact_name: nullableText(input.contactName),
      contact_phone: nullableText(input.contactPhone),
      status: normalizeArticleStatus(input.status),
    };

    const articleId = cleanText(input.articleId);
    const endpoint = articleId
      ? getSupabaseRestEndpoint(
          `/rest/v1/newsletter_articles?id=eq.${encodeURIComponent(
            articleId,
          )}&project_id=eq.${encodeURIComponent(project.id)}&select=id,title`,
        )
      : getSupabaseRestEndpoint("/rest/v1/newsletter_articles?select=id,title");

    if (!endpoint) {
      return {
        ok: false,
        status: "not_configured",
        message: "Supabase REST API 주소를 확인하지 못했습니다.",
      };
    }

    const response = await fetch(endpoint, {
      method: articleId ? "PATCH" : "POST",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify(articleBody),
      cache: "no-store",
    });
    const responseText = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: "request_failed",
        message: responseText || "기사 저장 요청에 실패했습니다.",
        httpStatus: response.status,
      };
    }

    const rows = JSON.parse(responseText || "[]") as Array<Pick<ProjectContentArticle, "id" | "title">>;
    const savedArticle = rows[0];

    if (!savedArticle) {
      return {
        ok: false,
        status: "not_found",
        message: "저장할 기사를 찾지 못했습니다.",
        httpStatus: 404,
      };
    }

    const blocksSaved = await replaceArticleBlocks(project.id, savedArticle.id, input, headers);

    if (!blocksSaved) {
      return {
        ok: false,
        status: "request_failed",
        message: "기사는 저장됐지만 콘텐츠 블록 저장에 실패했습니다.",
      };
    }

    return {
      ok: true,
      article: savedArticle,
    };
  } catch {
    return {
      ok: false,
      status: "request_failed",
      message: "기사 저장 중 오류가 발생했습니다.",
    };
  }
}

export async function createNewsletterProject(
  input: CreateNewsletterProjectInput,
): Promise<CreateNewsletterProjectResult> {
  const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_projects?select=id,slug,title");
  const headers = getRequestHeaders(true);

  if (!endpoint || !headers) {
    return {
      ok: false,
      status: "not_configured",
      message: "SUPABASE_SERVICE_ROLE_KEY가 설정되어야 프로젝트 저장을 사용할 수 있습니다.",
    };
  }

  const body = {
    title: input.title,
    organization_name: input.organizationName,
    assignee_name: input.assigneeName || null,
    issue_label: makeIssueLabel(input),
    published_date: normalizePublishedDate(input.publishedDate),
    slug: input.slug,
    description: input.description || null,
    primary_color: input.primaryColor || "#092046",
    status: input.status,
    package_tier: input.packageTier,
    production_mode: input.productionMode,
    estimated_hours: input.estimatedHours || null,
    designer_hours_cap: input.designerHoursCap || null,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status === 409 ? "duplicate_slug" : "request_failed",
        message:
          response.status === 409
            ? "이미 사용 중인 공개 주소 slug입니다. 다른 slug를 입력하세요."
            : responseText || "Supabase 프로젝트 저장 요청에 실패했습니다.",
        httpStatus: response.status,
      };
    }

    const rows = JSON.parse(responseText || "[]") as Array<Pick<NewsletterProjectRow, "id" | "slug" | "title">>;

    if (!rows[0]) {
      return {
        ok: false,
        status: "request_failed",
        message: "프로젝트가 저장됐지만 응답 데이터를 확인하지 못했습니다.",
      };
    }

    return {
      ok: true,
      project: rows[0],
    };
  } catch {
    return {
      ok: false,
      status: "request_failed",
      message: "Supabase 저장 요청 중 오류가 발생했습니다.",
    };
  }
}

export async function updateNewsletterProject(
  input: UpdateNewsletterProjectInput,
): Promise<UpdateNewsletterProjectResult> {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?slug=eq.${encodeURIComponent(input.projectId)}&deleted_at=is.null&select=id,slug,title`,
  );
  const headers = getRequestHeaders(true);

  if (!endpoint || !headers) {
    return {
      ok: false,
      status: "not_configured",
      message: "SUPABASE_SERVICE_ROLE_KEY가 설정되어야 프로젝트 기본 정보 수정을 사용할 수 있습니다.",
    };
  }

  const body = {
    title: input.title,
    organization_name: input.organizationName,
    assignee_name: input.assigneeName || null,
    issue_label: makeIssueLabel(input),
    published_date: normalizePublishedDate(input.publishedDate),
    slug: input.slug,
    description: input.description || null,
    primary_color: input.primaryColor || "#092046",
    status: input.status,
    package_tier: input.packageTier,
    production_mode: input.productionMode,
    estimated_hours: input.estimatedHours || null,
    designer_hours_cap: input.designerHoursCap || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status === 409 ? "duplicate_slug" : "request_failed",
        message:
          response.status === 409
            ? "이미 사용 중인 공개 주소 slug입니다. 다른 slug를 입력하세요."
            : responseText || "Supabase 프로젝트 기본 정보 수정 요청에 실패했습니다.",
        httpStatus: response.status,
      };
    }

    const rows = JSON.parse(responseText || "[]") as Array<Pick<NewsletterProjectRow, "id" | "slug" | "title">>;

    if (!rows[0]) {
      return {
        ok: false,
        status: "not_found",
        message: "수정할 프로젝트를 찾지 못했습니다.",
        httpStatus: 404,
      };
    }

    return {
      ok: true,
      project: rows[0],
    };
  } catch {
    return {
      ok: false,
      status: "request_failed",
      message: "Supabase 기본 정보 수정 요청 중 오류가 발생했습니다.",
    };
  }
}

export async function archiveNewsletterProject(projectId: string): Promise<ArchiveNewsletterProjectResult> {
  const encodedProjectId = encodeURIComponent(projectId);
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?id=eq.${encodedProjectId}&select=id,slug,title`,
  );
  const headers = getRequestHeaders(true);

  if (!endpoint || !headers) {
    return {
      ok: false,
      status: "not_configured",
      message: "SUPABASE_SERVICE_ROLE_KEY가 설정되어야 프로젝트 삭제를 사용할 수 있습니다.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "archived",
        archived_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: "request_failed",
        message: responseText || "Supabase 프로젝트 삭제 요청에 실패했습니다.",
        httpStatus: response.status,
      };
    }

    const rows = JSON.parse(responseText || "[]") as Array<Pick<NewsletterProjectRow, "id" | "slug" | "title">>;

    if (!rows[0]) {
      return {
        ok: false,
        status: "not_found",
        message: "삭제할 프로젝트를 찾지 못했습니다.",
        httpStatus: 404,
      };
    }

    return {
      ok: true,
      project: rows[0],
    };
  } catch {
    return {
      ok: false,
      status: "request_failed",
      message: "Supabase 삭제 요청 중 오류가 발생했습니다.",
    };
  }
}
