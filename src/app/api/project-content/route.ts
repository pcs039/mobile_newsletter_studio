import { NextResponse } from "next/server";
import { upsertProjectArticle, type UpsertProjectArticleInput } from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: unknown) {
  const numberValue = typeof value === "string" || typeof value === "number" ? Number(value) : 0;

  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : 0;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "기사 저장 요청 데이터를 확인하지 못했습니다." },
      { status: 400 },
    );
  }

  const input: UpsertProjectArticleInput = {
    projectSlug: asText(payload.projectSlug),
    articleId: asText(payload.articleId) || undefined,
    pageId: asText(payload.pageId) || undefined,
    sortOrder: asOptionalNumber(payload.sortOrder),
    title: asText(payload.title),
    summary: asText(payload.summary),
    body: asText(payload.body),
    contactName: asText(payload.contactName),
    contactPhone: asText(payload.contactPhone),
    status: asText(payload.status),
    buttonLabel: asText(payload.buttonLabel),
    buttonTarget: asText(payload.buttonTarget),
    videoLabel: asText(payload.videoLabel),
    videoUrl: asText(payload.videoUrl),
    mapLabel: asText(payload.mapLabel),
    mapUrl: asText(payload.mapUrl),
    audioScript: asText(payload.audioScript),
  };

  const result = await upsertProjectArticle(input);

  if (!result.ok) {
    return NextResponse.json(result, {
      status:
        result.status === "not_configured"
          ? 503
          : result.status === "not_found"
            ? 404
            : result.status === "invalid_input"
              ? 400
              : result.httpStatus ?? 500,
    });
  }

  return NextResponse.json(result, { status: input.articleId ? 200 : 201 });
}
