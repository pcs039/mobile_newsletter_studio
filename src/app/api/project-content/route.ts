import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { upsertProjectArticle, type UpsertProjectArticleInput } from "@/lib/newsletter-repository";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

const allowedBlockTypes = new Set(["paragraph", "image", "video_link", "map_link", "button_group", "audio"]);

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: unknown) {
  const numberValue = typeof value === "string" || typeof value === "number" ? Number(value) : 0;

  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function getServiceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    return null;
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function findProjectId(projectSlug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id&slug=eq.${encodeURIComponent(projectSlug)}&deleted_at=is.null&limit=1`,
  );

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json().catch(() => [])) as Array<{ id: string }>;

  return rows[0]?.id ?? null;
}

async function normalizeArticleSortOrder(projectId: string, headers: Record<string, string>) {
  const listEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_articles?select=id,sort_order,created_at&project_id=eq.${encodeURIComponent(
      projectId,
    )}&order=sort_order.asc,created_at.asc`,
  );

  if (!listEndpoint) {
    return false;
  }

  const listResponse = await fetch(listEndpoint, {
    headers,
    cache: "no-store",
  });

  if (!listResponse.ok) {
    return false;
  }

  const rows = (await listResponse.json().catch(() => [])) as Array<{
    id: string;
    sort_order: number | null;
  }>;

  await Promise.all(
    rows.map((article, index) => {
      const endpoint = getSupabaseRestEndpoint(`/rest/v1/newsletter_articles?id=eq.${encodeURIComponent(article.id)}`);

      if (!endpoint) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return fetch(endpoint, {
        method: "PATCH",
        headers: {
          ...headers,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ sort_order: (index + 1) * 10 }),
        cache: "no-store",
      });
    }),
  );

  return true;
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
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

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
    sourcePageNumber: asOptionalNumber(payload.sourcePageNumber),
    sortOrder: asOptionalNumber(payload.sortOrder),
    title: asText(payload.title),
    displayTitle: asText(payload.displayTitle),
    summary: asText(payload.summary),
    body: asText(payload.body),
    textAlignment: asText(payload.textAlignment),
    titleAlignment: asText(payload.titleAlignment),
    summaryAlignment: asText(payload.summaryAlignment),
    bodyAlignment: asText(payload.bodyAlignment),
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

export async function DELETE(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { searchParams } = new URL(request.url);
  const projectSlug = asText(searchParams.get("projectSlug"));
  const articleId = asText(searchParams.get("articleId"));
  const headers = getServiceHeaders();

  if (!projectSlug || !articleId) {
    return NextResponse.json({ ok: false, message: "삭제할 기사 정보를 확인하세요." }, { status: 400 });
  }

  if (!headers) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 기사 삭제를 사용할 수 있습니다." },
      { status: 503 },
    );
  }

  const projectId = await findProjectId(projectSlug, headers);

  if (!projectId) {
    return NextResponse.json({ ok: false, message: "프로젝트를 찾지 못했습니다." }, { status: 404 });
  }

  const encodedProjectId = encodeURIComponent(projectId);
  const encodedArticleId = encodeURIComponent(articleId);
  const articleEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_articles?id=eq.${encodedArticleId}&project_id=eq.${encodedProjectId}&select=id,title,audio_id`,
  );

  if (!articleEndpoint) {
    return NextResponse.json({ ok: false, message: "Supabase URL 설정을 확인하세요." }, { status: 503 });
  }

  const articleResponse = await fetch(articleEndpoint, {
    headers,
    cache: "no-store",
  });

  if (!articleResponse.ok) {
    return NextResponse.json({ ok: false, message: "삭제할 기사 정보를 확인하지 못했습니다." }, { status: 500 });
  }

  const articleRows = (await articleResponse.json().catch(() => [])) as Array<{
    id: string;
    title: string | null;
    audio_id: string | null;
  }>;
  const article = articleRows[0] ?? null;

  if (!article) {
    return NextResponse.json({ ok: false, message: "삭제할 기사를 찾지 못했습니다." }, { status: 404 });
  }

  const writeHeaders = {
    ...headers,
    Prefer: "return=minimal",
  };
  const blocksEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_content_blocks?article_id=eq.${encodedArticleId}&project_id=eq.${encodedProjectId}`,
  );
  const linksEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_link_actions?article_id=eq.${encodedArticleId}&project_id=eq.${encodedProjectId}`,
  );
  const audioEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_audio_files?article_id=eq.${encodedArticleId}&project_id=eq.${encodedProjectId}`,
  );
  const deleteArticleEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_articles?id=eq.${encodedArticleId}&project_id=eq.${encodedProjectId}`,
  );

  if (!blocksEndpoint || !linksEndpoint || !audioEndpoint || !deleteArticleEndpoint) {
    return NextResponse.json({ ok: false, message: "Supabase URL 설정을 확인하세요." }, { status: 503 });
  }

  const [blocksResponse, linksResponse, audioResponse] = await Promise.all([
    fetch(blocksEndpoint, {
      method: "DELETE",
      headers: writeHeaders,
      cache: "no-store",
    }),
    fetch(linksEndpoint, {
      method: "DELETE",
      headers: writeHeaders,
      cache: "no-store",
    }),
    fetch(audioEndpoint, {
      method: "PATCH",
      headers: writeHeaders,
      body: JSON.stringify({ article_id: null }),
      cache: "no-store",
    }),
  ]);

  if (!blocksResponse.ok || !linksResponse.ok || !audioResponse.ok) {
    return NextResponse.json({ ok: false, message: "기사 연결 데이터를 정리하지 못했습니다." }, { status: 500 });
  }

  const deleteArticleResponse = await fetch(deleteArticleEndpoint, {
    method: "DELETE",
    headers: writeHeaders,
    cache: "no-store",
  });

  if (!deleteArticleResponse.ok) {
    return NextResponse.json({ ok: false, message: "기사를 삭제하지 못했습니다." }, { status: 500 });
  }

  await normalizeArticleSortOrder(projectId, headers);

  return NextResponse.json({
    ok: true,
    message: "기사를 삭제했습니다.",
    article: {
      id: article.id,
      title: article.title ?? "",
    },
  });
}
