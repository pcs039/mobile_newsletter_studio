import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getProjectContent, getProjectDesignAssets } from "@/lib/newsletter-repository";
import { getProjectArticleComposition } from "@/lib/article-composition-repository";
import { buildDraftForProject } from "@/lib/article-design-draft";
import { applyDesignDraft, getDraftSnapshot, getReadyVisibleDraftAssets } from "@/lib/article-design-draft-repository";
import { isArticleProductionPattern } from "@/lib/article-production-pattern";
import { createHash } from "node:crypto";
import { getCanonicalSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function result(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  // This endpoint is never consumed by public/review renderers.
  const origins = new Set([new URL(request.url).origin]);
  // Trusted server configuration only; never accept a client-supplied forwarded host.
  if (process.env.VERCEL === "1") {
    const canonical = getCanonicalSiteOrigin();
    if (canonical) origins.add(canonical);
    for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL])
      if (host && /^[a-z0-9-]+\.vercel\.app$/.test(host)) origins.add(`https://${host}`);
    if (process.env.VERCEL_ENV === "preview" && process.env.CANVA_REDIRECT_URI) {
      try { const configured = new URL(process.env.CANVA_REDIRECT_URI); if (configured.protocol === "https:") origins.add(configured.origin); } catch { /* Invalid configuration is not trusted. */ }
    }
  }
  if (!origins.has(request.headers.get("origin") ?? "")) return result({ ok: false, message: "요청 주소를 확인해 주세요." }, 403);
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload || !["prepare", "apply"].includes(String(payload.action)) || !isArticleProductionPattern(payload.pattern) ||
    typeof payload.projectSlug !== "string" || typeof payload.articleId !== "string") return result({ ok: false, message: "초안 요청을 확인해 주세요." }, 400);
  const access = await requireProjectApiAccess({ projectSlug: payload.projectSlug });
  if (!access.ok) return access.response;
  const snapshot = await getDraftSnapshot(access.project.id, payload.articleId);
  if (!snapshot.ok) return result({ ok: false, message: snapshot.message }, snapshot.status);
  const [content, assets, readyVisible] = await Promise.all([getProjectContent(access.project.slug),
    getProjectDesignAssets(access.project.slug), getReadyVisibleDraftAssets(access.project.id)]);
  const article = content.articles.find(a => a.id === payload.articleId);
  if (!article) return result({ ok: false, message: "현재 프로젝트의 기사를 찾지 못했습니다." }, 404);
  if (!assets.ok || !readyVisible) return result({ ok: false, message: "자산 목록을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503);
  const after = await getDraftSnapshot(access.project.id, article.id);
  if (!after.ok) return result({ ok: false, message: after.message }, after.status);
  if (fingerprint(after.data) !== fingerprint(snapshot.data)) return result({ ok: false, message: "기사 또는 디자인이 변경되었습니다. 다시 시도해 주세요." }, 409);
  const draft = buildDraftForProject(access.project.id, article, payload.pattern, assets.assets, readyVisible, snapshot.data);
  // A client sends only the fingerprint it confirmed, never arbitrary settings or asset IDs.
  const confirmation = fingerprint(draft);
  if (payload.action === "prepare") return result({ ok: true, draft: { pattern: draft.pattern, changes: draft.changes, preserved: draft.preserved,
    placements: draft.placements, confirmation } });
  if (typeof payload.confirmation !== "string" || payload.confirmation !== confirmation) return result({ ok: false, message: "변경 예정 항목이 달라졌습니다. 초안을 다시 만들어 주세요." }, 409);
  const applied = await applyDesignDraft(access.project.id, article.id, draft);
  if (!applied.ok) return result({ ok: false, message: applied.message }, applied.status);
  const composition = await getProjectArticleComposition(access.project.id, article.id);
  if (composition.status !== "ok") return result({ ok: false, message: "새로고침 후 저장된 디자인을 확인해 주세요." }, 502);
  return result({ ok: true, composition: composition.data, message: draft.pattern === "manual" ? "현재 디자인을 유지했습니다." : "디자인 초안을 적용했습니다. 모바일 화면을 확인해 주세요." });
}
