import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getProjectContent } from "@/lib/newsletter-repository";
import { extractResponseOutputText } from "@/lib/article-ai-draft";
import { articleAiRequestTimeoutMs, requestArticleAiResponse } from "@/lib/article-ai-provider";
import { buildPatternRecommendationInput, parsePatternRecommendation, patternRecommendationInstruction, patternRecommendationSchema } from "@/lib/article-pattern-recommendation";

import { buildDesignConceptInput, designConceptInstruction, designConceptSchema, fallbackDesignConcepts, parseDesignConcepts } from "@/lib/article-design-concept";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Best-effort per-process protection. Provider 429 is also handled; no persistent recommendation history.
const requests = new Map<string, number>();
function result(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (input?.mode !== undefined && input.mode !== "concepts") return result({ ok: false, message: "분석 요청을 확인해 주세요." }, 400);
  const projectSlug = typeof input?.projectSlug === "string" ? input.projectSlug.trim() : "";
  const articleId = typeof input?.articleId === "string" ? input.articleId.trim() : "";
  const access = await requireProjectApiAccess({ projectSlug });
  if (!access.ok) return access.response;
  const content = await getProjectContent(access.project.slug);
  const article = content.articles.find(a => a.id === articleId);
  if (!article) return result({ ok: false, message: "현재 프로젝트의 기사를 찾지 못했습니다." }, 404);
  const concepts = input?.mode === "concepts";
  const fallback = () => result({ ok: true, concepts: fallbackDesignConcepts(article), fallback: true });
  const source = concepts ? buildDesignConceptInput(article) : buildPatternRecommendationInput(article);
  const meaningfulText = source.replace(/\[(제목|요약|본문|문단|정보|인용)\]/g, "").trim();
  if (concepts && (article.title + article.summary + article.body).trim().length < 40) return fallback();
  if (!concepts && meaningfulText.length < 40) return result({ ok: true, recommendation: { pattern: "manual", confidence: 0, reason: "기사 정보가 부족해 직접 구성을 추천합니다. 내용을 저장한 뒤 다시 분석할 수 있습니다." } });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey && concepts) return fallback();
  if (!apiKey) return result({ ok: false, message: "기존 AI 작성 도우미 API가 설정되지 않았습니다. 수동으로 패턴을 선택해 주세요." }, 503);
  const now = Date.now(), key = `${access.user.id}:${access.project.id}:${article.id}`;
  for (const [id, until] of requests) if (until <= now) requests.delete(id);
  if (concepts && (requests.has(key) || requests.size >= 500)) return fallback();
  if (requests.has(key) || requests.size >= 500) return result({ ok: false, message: "분석 요청이 진행 중이거나 너무 빠릅니다. 잠시 후 다시 시도해 주세요." }, 429);
  requests.set(key, now + articleAiRequestTimeoutMs + 5000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), articleAiRequestTimeoutMs);
  try {
    const response = await requestArticleAiResponse(apiKey, {
      instructions: concepts ? designConceptInstruction : patternRecommendationInstruction, input: source, max_output_tokens: concepts ? 2400 : 800,
      text: { format: { type: "json_schema", name: concepts ? "article_design_concepts" : "article_pattern_recommendation", strict: true, schema: concepts ? designConceptSchema : patternRecommendationSchema } },
    }, controller.signal);
    if (!response.ok && concepts) return fallback();
    if (!response.ok) return result({ ok: false, message: "AI 추천에 실패했습니다. 수동으로 패턴을 선택하거나 잠시 후 다시 시도해 주세요." }, response.status === 429 ? 429 : 502);
    const output = extractResponseOutputText(await response.json().catch(() => null));
    if (concepts) {
      const choices = parseDesignConcepts(output);
      return choices ? result({ ok: true, concepts: choices, fallback: false }) : fallback();
    }
    const recommendation = parsePatternRecommendation(output);
    if (!recommendation) return result({ ok: false, message: "AI 추천 결과가 올바르지 않습니다. 수동으로 패턴을 선택해 주세요." }, 502);
    return result({ ok: true, recommendation });
  } catch {
    if (concepts) return fallback();
    return result({ ok: false, message: "AI 분석을 완료하지 못했습니다. 기존 수동 패턴 선택은 계속 사용할 수 있습니다." }, controller.signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
    requests.set(key, Date.now() + 10_000);
  }
}
