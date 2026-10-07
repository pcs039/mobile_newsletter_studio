import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import {
  listDesignProcessingJobs,
  validateDesignProcessingInputAsset,
} from "@/lib/design-processing/repository";
import {
  isDesignProcessingOperation,
  isDesignProcessingProvider,
} from "@/lib/design-processing/types";
import { providerSupportsDesignProcessingOperation } from "@/lib/design-processing/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

function getProjectInput(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim() ?? "";
  const projectSlug = searchParams.get("projectSlug")?.trim() ?? "";
  const access = await requireProjectApiAccess({ projectId, projectSlug });

  if (!access.ok) return access.response;

  const result = await listDesignProcessingJobs(access.project.id);
  if (result.status !== "ok") {
    return errorResponse(
      result.status === "migration_required"
        ? "DESIGN_PROCESSING_MIGRATION_REQUIRED"
        : "DESIGN_PROCESSING_JOB_LIST_FAILED",
      result.message,
      result.status === "not_configured" || result.status === "migration_required" ? 503 : 500,
    );
  }

  return NextResponse.json({ ok: true, jobs: result.data });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const projectId = getProjectInput(body?.projectId);
  const projectSlug = getProjectInput(body?.projectSlug);
  const inputAssetId = getProjectInput(body?.inputAssetId);
  const provider = body?.provider;
  const operation = body?.operation;
  const access = await requireProjectApiAccess({ projectId, projectSlug });

  if (!access.ok) return access.response;
  if (!inputAssetId) {
    return errorResponse("DESIGN_PROCESSING_INPUT_REQUIRED", "디자인 처리에 사용할 원본을 선택해 주세요.", 400);
  }
  if (!isDesignProcessingProvider(provider)) {
    return errorResponse("DESIGN_PROCESSING_PROVIDER_INVALID", "지원하는 디자인 처리 도구를 확인해 주세요.", 400);
  }
  if (!isDesignProcessingOperation(operation) || !providerSupportsDesignProcessingOperation(provider, operation)) {
    return errorResponse("DESIGN_PROCESSING_OPERATION_INVALID", "선택한 도구에서 지원하는 작업을 확인해 주세요.", 400);
  }

  const inputAsset = await validateDesignProcessingInputAsset(access.project.id, inputAssetId);
  if (inputAsset.status !== "ok" || !inputAsset.data) {
    return errorResponse(
      inputAsset.status === "not_configured"
        ? "DESIGN_PROCESSING_NOT_CONFIGURED"
        : "DESIGN_PROCESSING_INPUT_INVALID",
      inputAsset.message,
      inputAsset.status === "not_configured" ? 503 : inputAsset.status === "not_found" ? 400 : 500,
    );
  }

  return errorResponse(
    "DESIGN_PROCESSING_EXECUTION_UNAVAILABLE",
    "외부 디자인 도구 연동은 준비 중입니다. 현재 단계에서는 처리 작업을 실행하거나 저장하지 않습니다.",
    501,
  );
}
