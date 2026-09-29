import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { loadArticleAiPhotoAssets } from "@/lib/article-ai-photo-assets";
import {
  articleAiDraftJsonSchema,
  articleAiSystemInstruction,
  extractResponseOutputText,
  sanitizeArticleAiDraft,
} from "@/lib/article-ai-draft";
import type { ArticleAiPhotoAssetInput } from "@/lib/article-ai-draft-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const maxSourceLength = 30_000;
const requestTimeoutMs = 55_000;

function getArticleAiModel() {
  return process.env.OPENAI_ARTICLE_MODEL?.trim() || "gpt-5.6-terra";
}

function errorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const input = (await request.json().catch(() => null)) as {
    photoAssets?: ArticleAiPhotoAssetInput[];
    projectSlug?: unknown;
    sourceText?: unknown;
  } | null;
  const sourceText = typeof input?.sourceText === "string" ? input.sourceText.trim() : "";
  const projectSlug = typeof input?.projectSlug === "string" ? input.projectSlug.trim() : "";

  if (!sourceText) {
    return errorResponse("AI_WRITING_SOURCE_REQUIRED", "원자료를 먼저 입력해 주세요.", 400);
  }

  if (sourceText.length > maxSourceLength) {
    return errorResponse("AI_WRITING_SOURCE_TOO_LONG", "원자료는 30,000자 이하로 입력해 주세요.", 400);
  }

  const hasPhotoAssets = Array.isArray(input?.photoAssets) && input.photoAssets.length > 0;

  if (hasPhotoAssets && !projectSlug) {
    return errorResponse("AI_PHOTO_PROJECT_REQUIRED", "사진 소재가 속한 프로젝트를 확인해 주세요.", 400);
  }

  const photoResult = await loadArticleAiPhotoAssets({
    photoAssets: input?.photoAssets,
    projectSlug,
  });

  if (!photoResult.ok) {
    return errorResponse(photoResult.error, photoResult.message, photoResult.status);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return errorResponse(
      "AI_WRITING_PROVIDER_NOT_CONFIGURED",
      "AI 작성 도우미 API가 설정되지 않았습니다.",
      503,
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const promptText = `다음 원자료를 모바일 공공정보 기사 초안으로 구조화해 주세요. 원자료 밖의 사실은 추가하지 마세요. 사진은 사실 생성이 아니라 사진 활용 제안에만 사용하세요.\n\n[원자료]\n${sourceText}`;
    const responseInput = photoResult.photos.length > 0
      ? [
          {
            role: "user",
            content: [
              { type: "input_text", text: promptText },
              ...photoResult.photos.flatMap((photo) => [
                {
                  type: "input_text",
                  text: `[사진 ${photo.sourceId} · ${photo.fileName}]`,
                },
                {
                  type: "input_image",
                  image_url: photo.dataUrl,
                  detail: "auto",
                },
              ]),
            ],
          },
        ]
      : promptText;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getArticleAiModel(),
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 5000,
        instructions: articleAiSystemInstruction,
        input: responseInput,
        text: {
          format: {
            type: "json_schema",
            name: "public_article_draft",
            description: "원자료에 근거한 공공기관 모바일 기사 초안",
            strict: true,
            schema: articleAiDraftJsonSchema,
          },
        },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return errorResponse(
          "AI_WRITING_RATE_LIMITED",
          "AI 초안 생성 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
          429,
        );
      }

      if (photoResult.photos.length > 0) {
        return errorResponse(
          "AI_PHOTO_ANALYSIS_FAILED",
          "사진 분석에 실패했습니다. 설정된 AI 모델의 이미지 입력 지원 여부를 확인하거나 사진 없이 다시 시도해 주세요.",
          502,
        );
      }

      return errorResponse("AI_WRITING_PROVIDER_FAILED", "AI 초안 생성에 실패했습니다.", 502);
    }

    const providerResponse = (await response.json().catch(() => null)) as unknown;
    const outputText = extractResponseOutputText(providerResponse);

    if (!outputText) {
      return errorResponse("AI_WRITING_INVALID_RESPONSE", "AI 초안 생성에 실패했습니다.", 502);
    }

    const parsed = JSON.parse(outputText) as unknown;
    const draft = sanitizeArticleAiDraft(
      parsed,
      sourceText,
      new Set(photoResult.photos.map((photo) => photo.sourceId)),
    );

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("AI_WRITING_TIMEOUT", "AI 초안 생성 시간이 초과되었습니다. 다시 시도해 주세요.", 504);
    }

    return errorResponse("AI_WRITING_FAILED", "AI 초안 생성에 실패했습니다.", 500);
  } finally {
    clearTimeout(timeoutId);
  }
}
