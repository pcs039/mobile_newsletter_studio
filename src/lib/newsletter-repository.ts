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

function makeIssueLabel(input: CreateNewsletterProjectInput) {
  if (!input.publishedDate) {
    return null;
  }

  const [year, month, day] = input.publishedDate.split("-");
  const monthNumber = Number(month);
  const dayNumber = Number(day);

  if (!year || !monthNumber) {
    return input.publishedDate;
  }

  if (dayNumber) {
    return `${year}년 ${monthNumber}월 ${dayNumber}일`;
  }

  return `${year}년 ${monthNumber}월`;
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
    updated: formatDate(project.updated_at),
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
    updated: formatDate(project.updated_at),
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
    updated: formatDate(page.updated_at),
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
    uploadedAt: formatDate(project.pdf_original_uploaded_at),
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
    updated: formatDate(asset.updated_at),
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
    updated: formatDate(file.updated_at),
  };
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
