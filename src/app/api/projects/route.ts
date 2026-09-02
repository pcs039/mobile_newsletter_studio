import { NextResponse } from "next/server";
import {
  archiveNewsletterProject,
  createNewsletterProject,
  type CreateNewsletterProjectInput,
} from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

const projectStatuses = ["draft", "in_review", "published", "private", "archived"] as const;
const packageTiers = ["basic", "standard", "advanced", "premium", "retainer"] as const;
const productionModes = ["template", "hybrid", "full_image", "external_ebook"] as const;

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function asOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "요청 데이터를 확인하지 못했습니다." },
      { status: 400 },
    );
  }

  const title = asOptionalText(payload.title);
  const organizationName = asOptionalText(payload.organizationName);
  const publishedDate = asOptionalText(payload.publishedDate) || asOptionalText(payload.publishedMonth);
  const slug = normalizeSlug(asOptionalText(payload.slug));
  const primaryColor = asOptionalText(payload.primaryColor) || "#092046";

  if (!title || !organizationName || !publishedDate || !slug) {
    return NextResponse.json(
      { ok: false, message: "소식지명, 기관명, 발행일, 공개 주소 slug는 필수입니다." },
      { status: 400 },
    );
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
    return NextResponse.json(
      { ok: false, message: "대표 색상은 #092046 같은 6자리 HEX 코드로 입력하세요." },
      { status: 400 },
    );
  }

  if (
    !isOneOf(payload.status, projectStatuses) ||
    !isOneOf(payload.packageTier, packageTiers) ||
    !isOneOf(payload.productionMode, productionModes)
  ) {
    return NextResponse.json(
      { ok: false, message: "상품 옵션, 제작 방식 또는 상태 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const input: CreateNewsletterProjectInput = {
    title,
    organizationName,
    publishedDate,
    slug,
    description: asOptionalText(payload.description),
    primaryColor,
    status: payload.status,
    packageTier: payload.packageTier,
    productionMode: payload.productionMode,
    estimatedHours: asOptionalText(payload.estimatedHours),
    designerHoursCap: asOptionalText(payload.designerHoursCap),
  };

  const result = await createNewsletterProject(input);

  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.status === "not_configured" ? 503 : result.httpStatus ?? 500,
    });
  }

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();

  if (!projectId) {
    return NextResponse.json(
      { ok: false, message: "보관할 프로젝트 ID가 필요합니다." },
      { status: 400 },
    );
  }

  const result = await archiveNewsletterProject(projectId);

  if (!result.ok) {
    return NextResponse.json(result, {
      status:
        result.status === "not_configured"
          ? 503
          : result.status === "not_found"
            ? 404
            : result.httpStatus ?? 500,
    });
  }

  return NextResponse.json(result);
}
