import "server-only";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";
import { validateCanvaTemplate, type CanvaTemplate, type CanvaTemplateInput } from "@/lib/canva-template";

export class CanvaRepositoryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function rows<T>(table: string, query: Record<string, string>, method = "GET", body?: unknown): Promise<T[]> {
  const endpoint = getSupabaseRestEndpoint(`/rest/v1/${table}?${new URLSearchParams(query)}`);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!endpoint || !key) throw new CanvaRepositoryError(503, "서버 설정을 확인해 주세요.");
  const response = await fetch(endpoint, { method, cache: "no-store", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 404 || ["42P01", "PGRST205"].includes(data?.code)) throw new CanvaRepositoryError(503, "Canva 템플릿을 사용하려면 v1.33 schema 적용이 필요합니다.");
    throw new CanvaRepositoryError(502, "Canva 템플릿 데이터를 처리하지 못했습니다.");
  }
  return response.json();
}
type Row = { id: string; name: string; external_id: string; template_type: string; production_pattern: string; purpose: string; is_active: boolean; field_mappings: unknown };
const columns = "id,name,external_id,template_type,production_pattern,purpose,is_active,field_mappings";
function map(row: Row): CanvaTemplate {
  return { id: row.id, ...validateCanvaTemplate({ name: row.name, externalId: row.external_id, templateType: row.template_type, productionPattern: row.production_pattern, purpose: row.purpose, isActive: row.is_active, fieldMappings: row.field_mappings }) };
}
export async function listCanvaTemplates(projectId: string): Promise<CanvaTemplate[]> {
  return (await rows<Row>("newsletter_project_canva_templates", { select: columns, project_id: `eq.${projectId}`, order: "created_at.desc" })).map(map);
}
export async function saveCanvaTemplate(projectId: string, input: CanvaTemplateInput, id?: string): Promise<CanvaTemplate> {
  const result = await rows<Row>("newsletter_project_canva_templates", { select: columns, ...(id ? { project_id: `eq.${projectId}`, id: `eq.${id}` } : {}) }, id ? "PATCH" : "POST", {
    ...(id ? {} : { project_id: projectId }), name: input.name, external_id: input.externalId, template_type: input.templateType,
    production_pattern: input.productionPattern, purpose: input.purpose, is_active: input.isActive, field_mappings: input.fieldMappings,
  });
  if (!result[0]) throw new CanvaRepositoryError(404, "현재 프로젝트의 템플릿을 찾지 못했습니다.");
  return map(result[0]);
}
export async function deleteCanvaTemplate(projectId: string, id: string) {
  const result = await rows<{ id: string }>("newsletter_project_canva_templates", { select: "id", project_id: `eq.${projectId}`, id: `eq.${id}` }, "DELETE");
  if (!result[0]) throw new CanvaRepositoryError(404, "현재 프로젝트의 템플릿을 찾지 못했습니다.");
}
// Return an ID only, after verifying both the article and its referenced image belong to this project.
export async function getCanvaPrimaryImage(projectId: string, articleId: string): Promise<string | null> {
  const articles = await rows<{ representative_asset_id: string | null }>("newsletter_articles", { select: "representative_asset_id", project_id: `eq.${projectId}`, id: `eq.${articleId}`, limit: "1" });
  const id = articles[0]?.representative_asset_id;
  if (!id) return null;
  const assets = await rows<{ id: string }>("newsletter_assets", { select: "id", project_id: `eq.${projectId}`, id: `eq.${id}`, mime_type: "in.(image/png,image/jpeg,image/webp,image/svg+xml)", limit: "1" });
  return assets[0]?.id ?? null;
}
