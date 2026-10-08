import "server-only";

import { hashClientReviewToken, isClientReviewToken } from "@/lib/client-review";
import { getSupabaseConfigStatus, getSupabaseRestEndpoint } from "@/lib/supabase-config";

export type ClientReviewStatus = "pending" | "approved" | "changes_requested" | "revoked";
export type ClientReviewDecision = "approved" | "changes_requested";

export type ClientReview = {
  expiresAt: string;
  id: string;
  projectId: string;
  requestedAt: string;
  requestedBy: string | null;
  respondedAt: string | null;
  revokedAt: string | null;
  status: ClientReviewStatus;
};

export type ClientReviewAccess = {
  project: {
    id: string;
    organizationName: string;
    slug: string;
    status: string;
    title: string;
  };
  review: ClientReview;
};

export type ApprovedPublishProject = {
  id: string;
  publishedAt: string;
  slug: string;
  status: "published";
  title: string;
};

export type ClientReviewRepositoryStatus =
  | "ok"
  | "invalid_input"
  | "not_configured"
  | "migration_required"
  | "not_found"
  | "conflict"
  | "expired"
  | "revoked"
  | "approval_required"
  | "request_failed";

export type ClientReviewRepositoryResult<T> =
  | { data: T; message: string; status: "ok" }
  | { data: null; httpStatus?: number; message: string; status: Exclude<ClientReviewRepositoryStatus, "ok"> };

type ClientReviewRow = {
  expires_at: string;
  id: string;
  project_id: string;
  requested_at: string;
  requested_by: string | null;
  responded_at: string | null;
  revoked_at: string | null;
  status: string;
};

type ClientReviewRpcRow = {
  expires_at?: string;
  project_id?: string;
  published_at?: string;
  requested_at?: string;
  responded_at?: string;
  review_id?: string;
  revoked_count?: number;
  slug?: string;
  status?: string;
  title?: string;
};

type ClientReviewProjectRow = {
  id: string;
  organization_name: string;
  slug: string;
  status: string;
  title: string;
};

function getServiceRoleHeaders() {
  const config = getSupabaseConfigStatus();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!config.isConfigured || !config.hasServiceRoleKey || !key) return null;

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function isMigrationRequired(status: number, body: string) {
  return status === 404
    || body.includes("PGRST202")
    || body.includes("PGRST205")
    || body.includes("42P01")
    || body.includes("Could not find the table");
}

function isClientReviewStatus(value: string): value is ClientReviewStatus {
  return ["pending", "approved", "changes_requested", "revoked"].includes(value);
}

function mapReview(row: ClientReviewRow): ClientReview | null {
  if (!isClientReviewStatus(row.status)) return null;

  return {
    expiresAt: row.expires_at,
    id: row.id,
    projectId: row.project_id,
    requestedAt: row.requested_at,
    requestedBy: row.requested_by,
    respondedAt: row.responded_at,
    revokedAt: row.revoked_at,
    status: row.status,
  };
}

function parseRpcBody(body: string) {
  try {
    const parsed = JSON.parse(body || "null");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ClientReviewRpcRow)
      : null;
  } catch {
    return null;
  }
}

function mapRpcFailure(status: number, body: string): ClientReviewRepositoryResult<never> {
  if (isMigrationRequired(status, body)) {
    return {
      data: null,
      message: "기관 검토 Workflow를 위한 v1.29 migration 적용이 필요합니다.",
      status: "migration_required",
    };
  }
  if (body.includes("client_review_expired")) {
    return { data: null, message: "기관 검토 링크가 만료되었습니다.", status: "expired" };
  }
  if (body.includes("client_review_revoked")) {
    return { data: null, message: "기관 검토 링크가 취소되었습니다.", status: "revoked" };
  }
  if (body.includes("client_review_approval_required") || body.includes("client_review_project_not_ready")) {
    return {
      data: null,
      message: "기관 승인 완료 후 최종 발행할 수 있습니다.",
      status: "approval_required",
    };
  }
  if (body.includes("client_review_project_not_found") || body.includes("client_review_not_found")) {
    return { data: null, message: "기관 검토 정보를 찾지 못했습니다.", status: "not_found" };
  }
  if (body.includes("client_review_already_responded") || body.includes("client_review_project_archived")) {
    return { data: null, message: "현재 상태에서는 기관 검토 요청을 처리할 수 없습니다.", status: "conflict" };
  }
  if (body.includes("client_review_invalid_")) {
    return { data: null, message: "기관 검토 요청 값을 확인해 주세요.", status: "invalid_input" };
  }

  return {
    data: null,
    httpStatus: status,
    message: "기관 검토 요청을 처리하지 못했습니다.",
    status: "request_failed",
  };
}

async function callRpc(
  functionName: string,
  payload: Record<string, unknown>,
): Promise<ClientReviewRepositoryResult<ClientReviewRpcRow>> {
  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint(`/rest/v1/rpc/${functionName}`);

  if (!headers || !endpoint) {
    return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = await response.text();

    if (!response.ok) return mapRpcFailure(response.status, body);

    const data = parseRpcBody(body);
    return data
      ? { data, message: "기관 검토 요청을 처리했습니다.", status: "ok" }
      : { data: null, message: "기관 검토 처리 결과를 확인하지 못했습니다.", status: "request_failed" };
  } catch (error) {
    console.error("Client review RPC request failed", functionName, error);
    return { data: null, message: "기관 검토 요청 중 네트워크 오류가 발생했습니다.", status: "request_failed" };
  }
}

export async function requestClientReview(input: {
  expiresAt: string;
  projectId: string;
  requestedBy: string;
  tokenHash: string;
}): Promise<ClientReviewRepositoryResult<ClientReview>> {
  const result = await callRpc("request_client_review_atomic", {
    p_expires_at: input.expiresAt,
    p_project_id: input.projectId,
    p_requested_by: input.requestedBy,
    p_token_hash: input.tokenHash,
  });

  if (result.status !== "ok") return result;

  const row = result.data;
  if (!row.review_id || !row.project_id || row.status !== "pending" || !row.expires_at || !row.requested_at) {
    return { data: null, message: "생성된 기관 검토 정보를 확인하지 못했습니다.", status: "request_failed" };
  }

  return {
    data: {
      expiresAt: row.expires_at,
      id: row.review_id,
      projectId: row.project_id,
      requestedAt: row.requested_at,
      requestedBy: input.requestedBy,
      respondedAt: null,
      revokedAt: null,
      status: "pending",
    },
    message: "기관 검토 링크를 생성했습니다.",
    status: "ok",
  };
}

export async function respondClientReview(
  token: string,
  decision: ClientReviewDecision,
): Promise<ClientReviewRepositoryResult<ClientReviewDecision>> {
  if (!isClientReviewToken(token)) {
    return { data: null, message: "기관 검토 링크를 확인해 주세요.", status: "invalid_input" };
  }

  const result = await callRpc("respond_client_review_atomic", {
    p_decision: decision,
    p_token_hash: hashClientReviewToken(token),
  });
  if (result.status !== "ok") return result;

  return result.data.status === decision
    ? { data: decision, message: decision === "approved" ? "기관 승인을 저장했습니다." : "수정 요청을 저장했습니다.", status: "ok" }
    : { data: null, message: "기관 검토 응답 결과를 확인하지 못했습니다.", status: "request_failed" };
}

export async function revokeClientReview(projectId: string): Promise<ClientReviewRepositoryResult<number>> {
  const result = await callRpc("revoke_client_review_atomic", { p_project_id: projectId });
  if (result.status !== "ok") return result;

  return typeof result.data.revoked_count === "number"
    ? { data: result.data.revoked_count, message: "대기 중인 기관 검토 링크를 취소했습니다.", status: "ok" }
    : { data: null, message: "기관 검토 취소 결과를 확인하지 못했습니다.", status: "request_failed" };
}

export async function publishProjectIfClientApproved(
  projectId: string,
): Promise<ClientReviewRepositoryResult<ApprovedPublishProject>> {
  const result = await callRpc("publish_project_if_client_approved_atomic", { p_project_id: projectId });
  if (result.status !== "ok") return result;

  const row = result.data;
  if (!row.project_id || !row.slug || !row.title || row.status !== "published" || !row.published_at) {
    return { data: null, message: "최종 발행 결과를 확인하지 못했습니다.", status: "request_failed" };
  }

  return {
    data: {
      id: row.project_id,
      publishedAt: row.published_at,
      slug: row.slug,
      status: "published",
      title: row.title,
    },
    message: "기관 승인 확인 후 최종 발행했습니다.",
    status: "ok",
  };
}

export async function getLatestClientReview(
  projectId: string,
): Promise<ClientReviewRepositoryResult<ClientReview | null>> {
  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_client_reviews?select=id,project_id,status,expires_at,requested_by,requested_at,responded_at,revoked_at&project_id=eq.${encodeURIComponent(
      projectId,
    )}&order=requested_at.desc,created_at.desc,id.desc&limit=1`,
  );

  if (!headers || !endpoint) {
    return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, { headers, cache: "no-store" });
    const body = await response.text();

    if (!response.ok) return mapRpcFailure(response.status, body);

    const rows = JSON.parse(body || "[]") as ClientReviewRow[];
    if (!rows[0]) return { data: null, message: "기관 검토 요청이 없습니다.", status: "ok" };

    const review = mapReview(rows[0]);
    return review
      ? { data: review, message: "최근 기관 검토 상태를 불러왔습니다.", status: "ok" }
      : { data: null, message: "기관 검토 상태 형식을 확인하지 못했습니다.", status: "request_failed" };
  } catch (error) {
    console.error("Latest client review lookup failed", error);
    return { data: null, message: "기관 검토 상태 조회 중 오류가 발생했습니다.", status: "request_failed" };
  }
}

export async function getClientReviewAccess(
  token: string,
  expectedProjectSlug?: string,
): Promise<ClientReviewRepositoryResult<ClientReviewAccess>> {
  if (!isClientReviewToken(token)) {
    return { data: null, message: "기관 검토 링크를 확인해 주세요.", status: "invalid_input" };
  }

  const headers = getServiceRoleHeaders();
  const tokenHash = hashClientReviewToken(token);
  const reviewEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_client_reviews?select=id,project_id,status,expires_at,requested_by,requested_at,responded_at,revoked_at&token_hash=eq.${tokenHash}&limit=1`,
  );

  if (!headers || !reviewEndpoint) {
    return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const reviewResponse = await fetch(reviewEndpoint, { headers, cache: "no-store" });
    const reviewBody = await reviewResponse.text();

    if (!reviewResponse.ok) return mapRpcFailure(reviewResponse.status, reviewBody);

    const reviewRows = JSON.parse(reviewBody || "[]") as ClientReviewRow[];
    const review = reviewRows[0] ? mapReview(reviewRows[0]) : null;
    if (!review) return { data: null, message: "기관 검토 링크를 찾지 못했습니다.", status: "not_found" };
    if (review.status === "revoked" || review.revokedAt) {
      return { data: null, message: "기관 검토 링크가 취소되었습니다.", status: "revoked" };
    }
    if (new Date(review.expiresAt).getTime() <= Date.now()) {
      return { data: null, message: "기관 검토 링크가 만료되었습니다.", status: "expired" };
    }

    const projectEndpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_projects?select=id,slug,title,organization_name,status&id=eq.${encodeURIComponent(
        review.projectId,
      )}&deleted_at=is.null&limit=1`,
    );
    if (!projectEndpoint) {
      return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
    }

    const projectResponse = await fetch(projectEndpoint, { headers, cache: "no-store" });
    const projectBody = await projectResponse.text();
    if (!projectResponse.ok) return mapRpcFailure(projectResponse.status, projectBody);

    const projectRows = JSON.parse(projectBody || "[]") as ClientReviewProjectRow[];
    const project = projectRows[0];
    if (!project || (expectedProjectSlug && project.slug !== expectedProjectSlug)) {
      return { data: null, message: "이 프로젝트의 기관 검토 링크가 아닙니다.", status: "not_found" };
    }

    return {
      data: {
        project: {
          id: project.id,
          organizationName: project.organization_name,
          slug: project.slug,
          status: project.status,
          title: project.title,
        },
        review,
      },
      message: "기관 검토 세션을 확인했습니다.",
      status: "ok",
    };
  } catch (error) {
    console.error("Client review access lookup failed", error);
    return { data: null, message: "기관 검토 링크 확인 중 오류가 발생했습니다.", status: "request_failed" };
  }
}
