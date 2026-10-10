import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getProjectContent } from "@/lib/newsletter-repository";
import { getProjectArticleComposition } from "@/lib/article-composition-repository";
import { buildCanvaPreview, canvaBlockOptions, canvaUuid, isBlockSource, canvaBlockKind, validateCanvaTemplate } from "@/lib/canva-template";
import { CanvaRepositoryError, deleteCanvaTemplate, getCanvaPrimaryImage, listCanvaTemplates, saveCanvaTemplate } from "@/lib/canva-template-repository";
export const dynamic = "force-dynamic";
function result(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
async function handle(request: Request) {
  const url = new URL(request.url);
  const payload = request.method === "GET" ? null : await request.json().catch(() => null);
  const projectSlug = request.method === "GET" ? url.searchParams.get("projectSlug") || "" : typeof payload?.projectSlug === "string" ? payload.projectSlug : "";
  const access = await requireProjectApiAccess({ projectSlug });
  if (!access.ok) return access.response;
  if (access.user.role !== "admin") return result({ ok: false, message: "관리자만 Canva 템플릿을 관리할 수 있습니다." }, 403);
  try {
    if (request.method === "GET") {
      const [templates, content] = await Promise.all([listCanvaTemplates(access.project.id), getProjectContent(access.project.slug)]);
      if (content.source !== "supabase") throw new CanvaRepositoryError(502, "기사 데이터를 불러오지 못했습니다.");
      const articleId = url.searchParams.get("articleId");
      if (articleId) {
        const article = content.articles.find(a => a.id === articleId);
        if (!article) throw new CanvaRepositoryError(404, "현재 프로젝트의 기사를 찾지 못했습니다.");
        const composition = await getProjectArticleComposition(access.project.id, articleId);
        const pattern = composition.data?.settings.productionPattern ?? "manual";
        return result({ ok: true, templates: templates.filter(t => t.isActive).sort((a, b) => { const rank = (value: string) => value === pattern ? 0 : value === "common" ? 1 : 2; return rank(a.productionPattern) - rank(b.productionPattern); }), pattern });
      }
      return result({ ok: true, templates, blocks: canvaBlockOptions(content.articles) });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new CanvaRepositoryError(400, "요청 형식을 확인해 주세요.");
    const allowed = request.method === "DELETE" ? ["projectSlug", "id"] : payload.action === "preview" ? ["projectSlug", "id", "articleId", "action"] : ["projectSlug", "id", "template"];
    if (Object.keys(payload).some(k => !allowed.includes(k))) throw new CanvaRepositoryError(400, "허용되지 않은 요청 항목입니다.");
    if (payload.id !== undefined && (typeof payload.id !== "string" || !canvaUuid.test(payload.id))) throw new CanvaRepositoryError(400, "템플릿 식별자를 확인해 주세요.");
    if (request.method === "DELETE") {
      if (!payload.id) throw new CanvaRepositoryError(400, "템플릿을 선택하세요.");
      await deleteCanvaTemplate(access.project.id, payload.id);
      return result({ ok: true });
    }
    if (payload.action === "preview") {
      if (request.method !== "POST" || !payload.id || typeof payload.articleId !== "string" || !canvaUuid.test(payload.articleId)) throw new CanvaRepositoryError(400, "기사와 템플릿을 선택하세요.");
      const templates = await listCanvaTemplates(access.project.id);
      const template = templates.find(t => t.id === payload.id && t.isActive);
      if (!template) throw new CanvaRepositoryError(404, "현재 프로젝트의 활성 템플릿을 찾지 못했습니다.");
      const content = await getProjectContent(access.project.slug);
      if (content.source !== "supabase") throw new CanvaRepositoryError(502, "기사 데이터를 불러오지 못했습니다.");
      const article = content.articles.find(a => a.id === payload.articleId);
      if (!article) throw new CanvaRepositoryError(404, "현재 프로젝트의 기사를 찾지 못했습니다.");
      return result({ ok: true, fields: buildCanvaPreview(template, article, access.project, await getCanvaPrimaryImage(access.project.id, article.id)) });
    }
    if ((request.method === "PATCH" && !payload.id) || (request.method === "POST" && payload.id)) throw new CanvaRepositoryError(400, "등록·수정 요청을 확인해 주세요.");
    let input;
    try { input = validateCanvaTemplate(payload.template); } catch (error) { throw new CanvaRepositoryError(400, error instanceof Error ? error.message : "매핑 형식을 확인해 주세요."); }
    if (input.fieldMappings.some(m => isBlockSource(m.source))) {
      const content = await getProjectContent(access.project.slug);
      if (content.source !== "supabase") throw new CanvaRepositoryError(502, "기사 블록을 확인하지 못했습니다.");
      const blocks = canvaBlockOptions(content.articles);
      if (input.fieldMappings.some(m => isBlockSource(m.source) && !blocks.some(b => b.id === m.blockId && b.kind === canvaBlockKind(m.source)))) throw new CanvaRepositoryError(400, "현재 프로젝트의 표시 가능한 정보박스·인용문을 선택하세요.");
    }
    return result({ ok: true, template: await saveCanvaTemplate(access.project.id, input, payload.id) }, request.method === "POST" ? 201 : 200);
  } catch (error) {
    return result({ ok: false, message: error instanceof CanvaRepositoryError ? error.message : "Canva 템플릿을 처리하지 못했습니다." }, error instanceof CanvaRepositoryError ? error.status : 502);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
