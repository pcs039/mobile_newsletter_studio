import "server-only";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";
import { articleOrderUuid, type ArticleOrderState } from "@/lib/article-order";

export class ArticleOrderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function articleOrderRpc(projectId: string, ids?: string[], expected?: string): Promise<ArticleOrderState & { duplicate?: boolean }> {
  const endpoint = getSupabaseRestEndpoint("/rest/v1/rpc/reorder_newsletter_articles_atomic");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!endpoint || !key) throw new ArticleOrderError(503, "순서 저장 서버 설정을 확인해 주세요.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_project_id: projectId, p_ordered_article_ids: ids ?? null, p_expected_snapshot: expected ?? null }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (data?.code === "PGRST202") throw new ArticleOrderError(503, "순서 저장 준비 중입니다. DB 함수 적용이 필요합니다.");
    if (data?.code === "PT409") throw new ArticleOrderError(409, "기사 목록이 변경되었습니다. 새로 확인한 뒤 순서를 조정해 주세요.");
    throw new ArticleOrderError(data?.code === "PT404" ? 404 : response.status === 400 ? 400 : 502, "순서를 저장하지 못했습니다. 목록을 다시 확인해 주세요.");
  }
  const data = await response.json();
  if (!data || typeof data.snapshot !== "string" || !/^[a-f0-9]{32}$/.test(data.snapshot) || !Array.isArray(data.articles) || data.articles.some((row: ArticleOrderState["articles"][number]) => !row || !articleOrderUuid.test(row.id) || !Number.isInteger(row.sortOrder) || typeof row.updatedAt !== "string")) {
    throw new ArticleOrderError(502, "목록 응답을 확인하지 못했습니다.");
  }
  return data;
}
