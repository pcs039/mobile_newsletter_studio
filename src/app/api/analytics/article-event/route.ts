import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { articleEventTypes, type ArticleEventType } from "@/lib/article-analytics-types";
import {
  recordArticleEvent,
  type RecordArticleEventInput,
} from "@/lib/article-analytics-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const eventTypes = new Set<ArticleEventType>(articleEventTypes);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function asOptionalUuid(value: unknown) {
  const text = asText(value, 64);
  return text && uuidPattern.test(text) ? text : undefined;
}

function hashSessionId(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json({ ok: false, message: "기사 반응 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const slug = asText(payload.slug, 160);
  const articleId = asOptionalUuid(payload.articleId);
  const eventType = asText(payload.eventType, 32) as ArticleEventType;
  const linkActionId = asOptionalUuid(payload.linkActionId);
  const surveyId = asOptionalUuid(payload.surveyId);
  const sessionId = asText(payload.sessionId, 200);
  const routePath = asText(payload.routePath, 500);

  if (!slug || !articleId || !eventTypes.has(eventType)) {
    return NextResponse.json({ ok: false, message: "프로젝트, 기사, 이벤트 유형을 확인해 주세요." }, { status: 400 });
  }

  if (payload.linkActionId && !linkActionId) {
    return NextResponse.json({ ok: false, message: "행동 버튼 식별자가 올바르지 않습니다." }, { status: 400 });
  }

  if (payload.surveyId && !surveyId) {
    return NextResponse.json({ ok: false, message: "참여 콘텐츠 식별자가 올바르지 않습니다." }, { status: 400 });
  }

  const input: RecordArticleEventInput = {
    slug,
    articleId,
    eventType,
    linkActionId,
    surveyId,
    sessionHash: sessionId ? hashSessionId(sessionId) : undefined,
    routePath,
    userAgent: request.headers.get("user-agent"),
  };
  const result = await recordArticleEvent(input);

  if (!result.ok) {
    return NextResponse.json(result, {
      status:
        result.status === "not_found"
          ? 404
          : result.status === "invalid_reference"
            ? 400
            : result.status === "not_configured" || result.status === "migration_required"
              ? 503
              : result.httpStatus ?? 500,
    });
  }

  return NextResponse.json(result, { status: result.deduped ? 200 : 201 });
}
