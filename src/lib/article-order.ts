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
