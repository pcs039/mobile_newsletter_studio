// Native form association keeps design-tab font inputs in the existing article save.
export function articleEditorFormId(articleId?: string | null) {
  return `article-editor-${articleId || "new"}`;
}
