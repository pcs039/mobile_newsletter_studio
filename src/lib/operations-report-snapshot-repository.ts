import type { AnalyticsPeriod } from "@/lib/article-analytics-types";
import type { AiEvidenceCatalogItem, AiOperationsCommentary } from "@/lib/ai-operations-commentary";
import {
  isOperationsReportSnapshotPayload,
  type OperationsReportSnapshotDetail,
  type OperationsReportSnapshotPayload,
  type OperationsReportSnapshotSummary,
} from "@/lib/operations-report-snapshot";
import { getSupabaseConfigStatus, getSupabaseRestEndpoint } from "@/lib/supabase-config";

type SnapshotRow = {
  ai_commentary: unknown;
  created_at: string;
  created_by: string;
  evidence_catalog: unknown;
  id: string;
  period: AnalyticsPeriod;
  period_end_date: string | null;
  period_label: string;
  period_start_date: string | null;
  project_id: string;
  schema_version: number;
  snapshot_payload: unknown;
  snapshot_title: string | null;
};

export type SnapshotRepositoryStatus = "ok" | "not_configured" | "migration_required" | "not_found" | "request_failed";

export type SnapshotRepositoryResult<T> = {
  data: T;
  message: string;
  status: SnapshotRepositoryStatus;
};

type CreateSnapshotInput = {
  aiCommentary: AiOperationsCommentary | null;
  createdBy: string;
  evidenceCatalog: AiEvidenceCatalogItem[];
  payload: OperationsReportSnapshotPayload;
  projectId: string;
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
    || body.includes("PGRST205")
    || body.includes("42P01")
    || body.includes("Could not find the table");
}

function isAiCommentary(value: unknown): value is AiOperationsCommentary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.headline === "string"
    && typeof record.summary === "string"
    && Array.isArray(record.observations)
    && Array.isArray(record.cautions)
    && Array.isArray(record.nextActions);
}

function getEvidenceCatalog(value: unknown): AiEvidenceCatalogItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    return typeof record.id === "string" && typeof record.label === "string"
      ? [{ id: record.id, label: record.label }]
      : [];
  });
}

function mapSummary(row: SnapshotRow): OperationsReportSnapshotSummary {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by,
    hasAiCommentary: isAiCommentary(row.ai_commentary),
    id: row.id,
    period: row.period,
    periodEnd: row.period_end_date,
    periodLabel: row.period_label,
    periodStart: row.period_start_date,
    schemaVersion: row.schema_version,
    title: row.snapshot_title?.trim() || `${row.period_label} 운영 리포트`,
  };
}

export async function createOperationsReportSnapshot(
  input: CreateSnapshotInput,
): Promise<SnapshotRepositoryResult<OperationsReportSnapshotSummary | null>> {
  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_operations_report_snapshots");

  if (!headers || !endpoint) {
    return { data: null, message: "Supabase 서버 저장 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        ai_commentary: input.aiCommentary,
        created_by: input.createdBy,
        evidence_catalog: input.aiCommentary ? input.evidenceCatalog : null,
        period: input.payload.periodRange.period,
        period_end_date: input.payload.periodRange.endDate,
        period_label: input.payload.periodRange.label,
        period_start_date: input.payload.periodRange.startDate,
        project_id: input.projectId,
        schema_version: input.payload.version,
        snapshot_payload: input.payload,
        snapshot_title: input.title,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Operations report snapshot insert failed", response.status, body);
      return isMigrationRequired(response.status, body)
        ? { data: null, message: "운영 리포트 저장을 위한 v1.20 migration 적용이 필요합니다.", status: "migration_required" }
        : { data: null, message: "운영 리포트 스냅샷을 저장하지 못했습니다.", status: "request_failed" };
    }

    const rows = (await response.json()) as SnapshotRow[];
    const row = rows[0];
    return row
      ? { data: mapSummary(row), message: "현재 운영 리포트를 저장했습니다.", status: "ok" }
      : { data: null, message: "저장된 운영 리포트를 확인하지 못했습니다.", status: "request_failed" };
  } catch (error) {
    console.error("Operations report snapshot insert request failed", error);
    return { data: null, message: "운영 리포트 스냅샷 저장 중 오류가 발생했습니다.", status: "request_failed" };
  }
}

export async function listOperationsReportSnapshots(
  projectId: string,
  limit = 10,
): Promise<SnapshotRepositoryResult<OperationsReportSnapshotSummary[]>> {
  const headers = getServiceRoleHeaders();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_operations_report_snapshots?select=id,period,period_label,period_start_date,period_end_date,snapshot_title,ai_commentary,created_by,created_at,schema_version&project_id=eq.${encodeURIComponent(projectId)}&order=created_at.desc&limit=${safeLimit}`,
  );

  if (!headers || !endpoint) {
    return { data: [], message: "Supabase 서버 저장 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, { headers, cache: "no-store" });
    if (!response.ok) {
      const body = await response.text();
      console.error("Operations report snapshot list failed", response.status, body);
      return isMigrationRequired(response.status, body)
        ? { data: [], message: "운영 리포트 저장을 위한 v1.20 migration 적용이 필요합니다.", status: "migration_required" }
        : { data: [], message: "저장된 운영 리포트 목록을 불러오지 못했습니다.", status: "request_failed" };
    }

    const rows = (await response.json()) as SnapshotRow[];
    return { data: rows.map(mapSummary), message: "저장된 운영 리포트를 불러왔습니다.", status: "ok" };
  } catch (error) {
    console.error("Operations report snapshot list request failed", error);
    return { data: [], message: "저장된 운영 리포트 목록 조회 중 오류가 발생했습니다.", status: "request_failed" };
  }
}

export async function getOperationsReportSnapshot(
  projectId: string,
  snapshotId: string,
): Promise<SnapshotRepositoryResult<OperationsReportSnapshotDetail | null>> {
  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_operations_report_snapshots?select=*&project_id=eq.${encodeURIComponent(projectId)}&id=eq.${encodeURIComponent(snapshotId)}&limit=1`,
  );

  if (!headers || !endpoint) {
    return { data: null, message: "Supabase 서버 저장 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, { headers, cache: "no-store" });
    if (!response.ok) {
      const body = await response.text();
      console.error("Operations report snapshot detail failed", response.status, body);
      return isMigrationRequired(response.status, body)
        ? { data: null, message: "운영 리포트 저장을 위한 v1.20 migration 적용이 필요합니다.", status: "migration_required" }
        : { data: null, message: "저장된 운영 리포트를 불러오지 못했습니다.", status: "request_failed" };
    }

    const rows = (await response.json()) as SnapshotRow[];
    const row = rows[0];
    if (!row) return { data: null, message: "저장된 운영 리포트를 찾지 못했습니다.", status: "not_found" };
    if (!isOperationsReportSnapshotPayload(row.snapshot_payload)) {
      return { data: null, message: "저장된 운영 리포트 형식을 확인하지 못했습니다.", status: "request_failed" };
    }

    return {
      data: {
        ...mapSummary(row),
        aiCommentary: isAiCommentary(row.ai_commentary) ? row.ai_commentary : null,
        evidenceCatalog: getEvidenceCatalog(row.evidence_catalog),
        payload: row.snapshot_payload,
      },
      message: "저장된 운영 리포트를 불러왔습니다.",
      status: "ok",
    };
  } catch (error) {
    console.error("Operations report snapshot detail request failed", error);
    return { data: null, message: "저장된 운영 리포트 조회 중 오류가 발생했습니다.", status: "request_failed" };
  }
}
