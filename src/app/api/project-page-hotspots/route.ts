import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import {
  createProjectPageHotspotLink,
  deleteProjectPageHotspotLink,
  type CreateProjectPageHotspotLinkInput,
} from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

const allowedLinkTypes = ["url", "phone", "map", "video"] as const;

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: unknown) {
  const numberValue = typeof value === "string" || typeof value === "number" ? Number(value) : undefined;

  return typeof numberValue === "number" && Number.isFinite(numberValue) ? numberValue : undefined;
}

function asLinkType(value: unknown): CreateProjectPageHotspotLinkInput["type"] {
  return allowedLinkTypes.includes(value as CreateProjectPageHotspotLinkInput["type"])
    ? (value as CreateProjectPageHotspotLinkInput["type"])
    : "url";
}

function getErrorStatus(status: string, httpStatus?: number) {
  return status === "not_configured"
    ? 503
    : status === "not_found"
      ? 404
      : status === "invalid_input"
        ? 400
        : httpStatus ?? 500;
}

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json({ ok: false, message: "이미지 클릭 영역 저장 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const result = await createProjectPageHotspotLink({
    projectSlug: asText(payload.projectSlug),
    pageId: asText(payload.pageId),
    label: asText(payload.label),
    type: asLinkType(payload.type),
    targetValue: asText(payload.targetValue),
    xPercent: asOptionalNumber(payload.xPercent),
    yPercent: asOptionalNumber(payload.yPercent),
    widthPercent: asOptionalNumber(payload.widthPercent),
    heightPercent: asOptionalNumber(payload.heightPercent),
    sortOrder: asOptionalNumber(payload.sortOrder),
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
  }

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { searchParams } = new URL(request.url);
  const result = await deleteProjectPageHotspotLink({
    projectSlug: searchParams.get("projectSlug") ?? "",
    linkId: searchParams.get("linkId") ?? "",
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
  }

  return NextResponse.json(result);
}
