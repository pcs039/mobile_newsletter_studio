import "server-only";

import { getSupabaseConfigStatus, getSupabaseRestEndpoint } from "@/lib/supabase-config";
import {
  isDesignProcessingJobStatus,
  isDesignProcessingOperation,
  isDesignProcessingProvider,
  type DesignProcessingJobSummary,
} from "@/lib/design-processing/types";

type DesignProcessingJobRow = {
  completed_at: string | null;
  created_at: string;
  error_code: string | null;
  error_message: string | null;
  external_job_id: string | null;
  id: string;
  input_asset_id: string | null;
  operation: string;
  provider: string;
  started_at: string | null;
  status: string;
  status_url: string | null;
  updated_at: string;
};

export type DesignProcessingRepositoryStatus =
  | "ok"
  | "not_configured"
  | "migration_required"
  | "not_found"
  | "request_failed";

export type DesignProcessingRepositoryResult<T> = {
  data: T;
  message: string;
  status: DesignProcessingRepositoryStatus;
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
  return status === 404 || body.includes("PGRST205") || body.includes("42P01") || body.includes("Could not find the table");
}

function mapJob(row: DesignProcessingJobRow): DesignProcessingJobSummary | null {
  if (
    !isDesignProcessingProvider(row.provider) ||
    !isDesignProcessingOperation(row.operation) ||
    !isDesignProcessingJobStatus(row.status)
  ) {
    return null;
  }

  return {
    completedAt: row.completed_at ?? "",
    createdAt: row.created_at,
    errorCode: row.error_code ?? "",
    errorMessage: row.error_message ?? "",
    externalJobId: row.external_job_id ?? "",
    hasStatusUrl: Boolean(row.status_url),
    id: row.id,
    inputAssetId: row.input_asset_id ?? "",
    operation: row.operation,
    provider: row.provider,
    startedAt: row.started_at ?? "",
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export async function listDesignProcessingJobs(
  projectId: string,
  limit = 20,
): Promise<DesignProcessingRepositoryResult<DesignProcessingJobSummary[]>> {
  const headers = getServiceRoleHeaders();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_design_processing_jobs?select=id,input_asset_id,provider,operation,status,external_job_id,status_url,error_code,error_message,created_at,started_at,completed_at,updated_at&project_id=eq.${encodeURIComponent(
      projectId,
    )}&order=created_at.desc&limit=${safeLimit}`,
  );

  if (!headers || !endpoint) {
    return { data: [], message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, { headers, cache: "no-store" });

    if (!response.ok) {
      const body = await response.text();
      console.error("Design processing job list failed", response.status, body);
      return isMigrationRequired(response.status, body)
        ? { data: [], message: "디자인 처리 작업을 위한 v1.24 migration 적용이 필요합니다.", status: "migration_required" }
        : { data: [], message: "디자인 처리 작업을 불러오지 못했습니다.", status: "request_failed" };
    }

    const rows = (await response.json().catch(() => [])) as DesignProcessingJobRow[];
    return {
      data: rows.flatMap((row) => {
        const job = mapJob(row);
        return job ? [job] : [];
      }),
      message: "디자인 처리 작업을 불러왔습니다.",
      status: "ok",
    };
  } catch (error) {
    console.error("Design processing job list request failed", error);
    return { data: [], message: "디자인 처리 작업 조회 중 오류가 발생했습니다.", status: "request_failed" };
  }
}

export async function validateDesignProcessingInputAsset(projectId: string, inputAssetId: string) {
  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_design_assets?select=id&id=eq.${encodeURIComponent(inputAssetId)}&project_id=eq.${encodeURIComponent(
      projectId,
    )}&asset_type=eq.source_design&limit=1`,
  );

  if (!headers || !endpoint) {
    return { data: false, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" } as const;
  }

  try {
    const response = await fetch(endpoint, { headers, cache: "no-store" });
    if (!response.ok) {
      return { data: false, message: "디자인 원본을 확인하지 못했습니다.", status: "request_failed" } as const;
    }

    const rows = (await response.json().catch(() => [])) as Array<{ id: string }>;
    return rows[0]?.id
      ? { data: true, message: "디자인 원본을 확인했습니다.", status: "ok" } as const
      : { data: false, message: "현재 프로젝트의 디자인 원본을 찾지 못했습니다.", status: "not_found" } as const;
  } catch (error) {
    console.error("Design processing input validation request failed", error);
    return { data: false, message: "디자인 원본 확인 중 오류가 발생했습니다.", status: "request_failed" } as const;
  }
}
