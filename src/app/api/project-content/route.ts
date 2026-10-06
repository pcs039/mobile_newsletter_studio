import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import {
  deleteProjectArticleAtomic,
  upsertProjectArticle,
  type UpsertProjectArticleInput,
} from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

const allowedBlockTypes = new Set(["paragraph", "image", "video_link", "map_link", "button_group", "audio"]);

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: unknown) {
  const numberValue = typeof value === "string" || typeof value === "number" ? Number(value) : 0;

  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asPlainObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asContentSections(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section, index) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const sectionRecord = section as Record<string, unknown>;
      const title = asText(sectionRecord.title);
      const body = asText(sectionRecord.body);
      const textAlignment = asText(sectionRecord.textAlignment);

      if (!title && !body) {
        return null;
      }

      return {
        title,
        body,
        textAlignment,
        sortOrder: asOptionalNumber(sectionRecord.sortOrder) || (index + 1) * 10,
      };
    })
    .filter((section): section is { title: string; body: string; textAlignment: string; sortOrder: number } => section !== null);
}

function asContentBlocks(value: unknown): NonNullable<UpsertProjectArticleInput["contentBlocks"]> {
  if (!Array.isArray(value)) {
    return [];
  }

  const blocks: NonNullable<UpsertProjectArticleInput["contentBlocks"]> = [];

  value.forEach((block, index) => {
    if (!block || typeof block !== "object") {
      return;
    }

    const blockRecord = block as Record<string, unknown>;
    const type = asText(blockRecord.type);
    const title = asText(blockRecord.title);
    const body = asText(blockRecord.body);

    if (!allowedBlockTypes.has(type) || (!title && !body)) {
      return;
    }

    blocks.push({
      type: type as NonNullable<UpsertProjectArticleInput["contentBlocks"]>[number]["type"],
      title,
      body,
      textAlignment: asText(blockRecord.textAlignment),
      sortOrder: asOptionalNumber(blockRecord.sortOrder) || (index + 1) * 10,
    });
  });

  return blocks;
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
    audioSource: asText(payload.audioSource),
    articleTtsVoice: asText(payload.articleTtsVoice),
    pageId: asText(payload.pageId) || undefined,
    sourcePageNumber: asOptionalNumber(payload.sourcePageNumber),
    sortOrder: asOptionalNumber(payload.sortOrder),
    title: asText(payload.title),
    summary: asText(payload.summary),
    body: asText(payload.body),
    textAlignment: asText(payload.textAlignment),
    titleAlignment: asText(payload.titleAlignment),
    summaryAlignment: asText(payload.summaryAlignment),
    bodyAlignment: asText(payload.bodyAlignment),
    interestTags: asStringArray(payload.interestTags),
    articleType: asText(payload.articleType),
    institutionPriority: asOptionalNumber(payload.institutionPriority),
    urgency: asText(payload.urgency),
    publicationKind: asText(payload.publicationKind),
    validFrom: asText(payload.validFrom),
    validUntil: asText(payload.validUntil),
    publicInfo: asPlainObject(payload.publicInfo),
    surveyId: asText(payload.surveyId) || undefined,
    contentSections: asContentSections(payload.contentSections),
    contentBlocks: asContentBlocks(payload.contentBlocks),
    contactName: asText(payload.contactName),
    contactPhone: asText(payload.contactPhone),
    motionPreset: asText(payload.motionPreset),
    motionSpeed: asText(payload.motionSpeed),
    titleMotionEffect: asText(payload.titleMotionEffect),
    titleMotionSpeed: asText(payload.titleMotionSpeed),
    textBoxMotionEffect: asText(payload.textBoxMotionEffect),
    textBoxMotionSpeed: asText(payload.textBoxMotionSpeed),
    imageMotionEffect: asText(payload.imageMotionEffect),
    imageMotionSpeed: asText(payload.imageMotionSpeed),
    linkMotionEffect: asText(payload.linkMotionEffect),
    linkMotionSpeed: asText(payload.linkMotionSpeed),
    titleFontAssetId: asText(payload.titleFontAssetId),
    bodyFontAssetId: asText(payload.bodyFontAssetId),
    captionFontAssetId: asText(payload.captionFontAssetId),
    buttonFontAssetId: asText(payload.buttonFontAssetId),
    status: asText(payload.status),
    buttonLabel: asText(payload.buttonLabel),
    buttonTarget: asText(payload.buttonTarget),
    videoLabel: asText(payload.videoLabel),
    videoUrl: asText(payload.videoUrl),
    mapLabel: asText(payload.mapLabel),
    mapUrl: asText(payload.mapUrl),
    audioScript: asText(payload.audioScript),
  };

  const access = await requireProjectApiAccess({ projectSlug: input.projectSlug });

  if (!access.ok) {
    return access.response;
  }

  const result = await upsertProjectArticle(input);

  if (!result.ok) {
    return NextResponse.json(result, {
      status:
        result.status === "not_configured" || result.status === "migration_required"
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

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectSlug = asText(searchParams.get("projectSlug"));
  const articleId = asText(searchParams.get("articleId"));

  if (!projectSlug || !articleId) {
    return NextResponse.json({ ok: false, message: "삭제할 기사 정보를 확인하세요." }, { status: 400 });
  }

  const access = await requireProjectApiAccess({ projectSlug });

  if (!access.ok) {
    return access.response;
  }

  const projectId = access.project.id;

  if (!projectId) {
    return NextResponse.json({ ok: false, message: "프로젝트를 찾지 못했습니다." }, { status: 404 });
  }

  const result = await deleteProjectArticleAtomic(projectId, articleId);

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

  return NextResponse.json({
    ok: true,
    message: "기사를 삭제했습니다.",
    article: result.article,
  });
}
