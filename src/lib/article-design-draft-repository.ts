import "server-only";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";
import type { ArticleDesignDraft, DraftSnapshot } from "@/lib/article-design-draft";

async function rpc(projectId: string, articleId: string, extra: Record<string, unknown>) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = getSupabaseRestEndpoint("/rest/v1/rpc/apply_newsletter_article_design_draft_atomic");
  if (!key || !url) return { ok: false as const, status: 503, message: "서버 설정을 확인해 주세요." };
  try {
    const response = await fetch(url, { method: "POST", cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_project_id: projectId, p_article_id: articleId, ...extra }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false as const, status: body?.code === "PT409" ? 409 : body?.code === "P0002" ? 404 : body?.code === "PGRST202" ? 503 : 400,
      message: body?.code === "PT409" ? "기사 또는 디자인이 변경되었습니다. 초안을 다시 만들어 주세요." : body?.code === "PGRST202" ? "디자인 초안 저장 기능의 migration 적용이 필요합니다." : "초안을 적용하지 못했습니다. 기존 디자인은 그대로 유지됩니다." };
    return { ok: true as const, data: body };
  } catch { return { ok: false as const, status: 502, message: "저장 결과를 확인하지 못했습니다. 새로고침 후 현재 디자인을 확인해 주세요." }; }
}
export async function getDraftSnapshot(projectId: string, articleId: string) {
  const result = await rpc(projectId, articleId, { p_action: "snapshot" });
  return result.ok ? { ok: true as const, data: result.data as DraftSnapshot } : result;
}
export async function applyDesignDraft(projectId: string, articleId: string, draft: ArticleDesignDraft) {
  return rpc(projectId, articleId, { p_action: "apply", p_expected: draft.snapshot, p_pattern: draft.pattern,
    p_text_design: draft.textDesign, p_placements: draft.placements.map(({ assetId, slot }) => ({ assetId, slot })) });
}
export async function getReadyVisibleDraftAssets(projectId: string): Promise<Record<string, string[]> | null> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = getSupabaseRestEndpoint(`/rest/v1/newsletter_article_composition_assets?${new URLSearchParams({
    select: "asset_id,slot,newsletter_article_compositions!inner(project_id,status)",
    "newsletter_article_compositions.project_id": `eq.${projectId}`, "newsletter_article_compositions.status": "eq.ready",
    is_visible: "eq.true", slot: "in.(hero_background,hero_illustration)", limit: "1000",
  })}`);
  if (!key || !url) return null;
  try {
    const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!response.ok) return null;
    const rows = await response.json() as Array<{ asset_id: string; slot: string }>;
    const result: Record<string, string[]> = {};
    for (const row of rows) (result[row.asset_id] ??= []).push(row.slot);
    return result;
  } catch { return null; }
}
