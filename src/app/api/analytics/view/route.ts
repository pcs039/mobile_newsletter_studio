import { NextResponse } from "next/server";
import { recordNewsletterView, type RecordNewsletterViewInput } from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

function asOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUtmValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().toLowerCase();

  if (!normalized || /^[a-z][a-z\d+.-]*:\/\//i.test(normalized)) {
    return null;
  }

  return normalized.slice(0, 100);
}

function isViewMode(value: unknown): value is RecordNewsletterViewInput["viewMode"] {
  return value === "reading" || value === "ebook";
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "접속 통계 요청 데이터를 확인하지 못했습니다." },
      { status: 400 },
    );
  }

  const slug = asOptionalText(payload.slug);
  const routePath = asOptionalText(payload.routePath);
  const viewMode = payload.viewMode;
  const hasExplicitReferrer = Object.prototype.hasOwnProperty.call(payload, "referrer");
  const referrer = hasExplicitReferrer ? asOptionalText(payload.referrer) : request.headers.get("referer");

  if (!slug || !isViewMode(viewMode)) {
    return NextResponse.json(
      { ok: false, message: "프로젝트 주소와 보기 유형이 필요합니다." },
      { status: 400 },
    );
  }

  const result = await recordNewsletterView({
    slug,
    viewMode,
    routePath,
    referrer,
    currentOrigin: request.headers.get("origin") ?? new URL(request.url).origin,
    utmSource: normalizeUtmValue(payload.utmSource),
    utmMedium: normalizeUtmValue(payload.utmMedium),
    utmCampaign: normalizeUtmValue(payload.utmCampaign),
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json(result, {
      status:
        result.status === "not_configured" || result.status === "migration_required"
          ? 503
          : result.status === "not_found"
            ? 404
            : result.httpStatus ?? 500,
    });
  }

  return NextResponse.json(result, { status: 201 });
}
