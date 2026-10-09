// Browser-memory only: preserves a confirmed save across the new article form's navigation/remount.
// It is not a recommendation store or proof of authorization; the server always rechecks access.
let saved: { projectSlug: string; articleId: string } | null = null;
const listeners = new Set<() => void>();
export function subscribeArticleSave(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getSavedArticleId(projectSlug: string, articleId?: string) {
  return saved?.projectSlug === projectSlug && saved.articleId === articleId ? articleId : null;
}
export function rememberArticleSave(projectSlug: string, articleId: string) {
  saved = { projectSlug, articleId };
  listeners.forEach(listener => listener());
}
export function clearArticleSave() {
  saved = null;
  listeners.forEach(listener => listener());
}
