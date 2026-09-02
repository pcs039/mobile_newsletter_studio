import { dashboardProjects } from "@/lib/newsletter-data";
import { getSupabaseConfigStatus, getSupabaseRestEndpoint } from "@/lib/supabase-config";
import type { DashboardProject } from "@/types/newsletter";

type ProjectStatus = "draft" | "in_review" | "published" | "private" | "archived";
type PackageTier = "basic" | "standard" | "advanced" | "premium" | "retainer";
type ProductionMode = "template" | "hybrid" | "full_image" | "external_ebook";

type NewsletterProjectRow = {
  id: string;
  title: string;
  organization_name: string;
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
  page_count: number;
  created_at: string;
  updated_at: string;
};

export type CreateNewsletterProjectInput = {
  title: string;
  organizationName: string;
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

const projectSelectColumns = [
  "id",
  "title",
  "organization_name",
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

function mapProjectRowToDashboardProject(project: NewsletterProjectRow): DashboardProject {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    organization: project.organization_name,
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
      today: "0",
      yesterday: "0",
      total: "0",
    },
    actions: {
      editHref: `/projects/${project.slug}/pages`,
      previewHref: `/newsletters/${project.slug}`,
      analyticsHref: "#analytics-preview",
      duplicateHref: `/projects/new?copyFrom=${project.slug}`,
      archiveHref: "#archive-policy",
    },
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

export async function getDashboardProjects() {
  const config = getSupabaseConfigStatus();
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=${projectSelectColumns}&deleted_at=is.null&order=updated_at.desc&limit=20`,
  );
  const headers = getRequestHeaders();

  if (!config.isConfigured || !endpoint || !headers) {
    return {
      projects: dashboardProjects,
      source: "sample" as const,
      message: "Supabase 환경변수가 없어 샘플 데이터를 표시합니다.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        projects: dashboardProjects,
        source: "sample" as const,
        message: "Supabase 조회에 실패해 샘플 데이터를 표시합니다.",
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

    return {
      projects: rows.map(mapProjectRowToDashboardProject),
      source: "supabase" as const,
      message: "Supabase 프로젝트 데이터를 표시합니다.",
    };
  } catch {
    return {
      projects: dashboardProjects,
      source: "sample" as const,
      message: "Supabase 요청 중 오류가 발생해 샘플 데이터를 표시합니다.",
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
