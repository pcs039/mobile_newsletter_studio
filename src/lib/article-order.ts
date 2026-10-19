export type ArticleOrderState = {
  snapshot: string;
  articles: Array<{ id: string; sortOrder: number; updatedAt: string }>;
};

export function moveArticle(ids: string[], id: string, target: string) {
  const from = ids.indexOf(id);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function sameArticleOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export const articleOrderUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Base placement is editorial state. A content/asset save must never change it.
// Legacy duplicate sort_order values use immutable IDs, never updated_at.
export const articleBaseOrderQuery = "sort_order.asc,id.asc";
export function compareArticleBaseOrder(
  left: { id: string; sortOrder: number },
  right: { id: string; sortOrder: number },
) {
  return left.sortOrder - right.sortOrder || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}
