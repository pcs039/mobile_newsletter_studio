export function getDefaultPageTitle(pageNumber: number) {
  return `${pageNumber}쪽`;
}

export function getCustomPageTitle(title: string | null | undefined, pageNumber: number) {
  const normalizedTitle = title?.trim() ?? "";
  const defaultTitle = getDefaultPageTitle(pageNumber);

  if (!normalizedTitle || normalizedTitle.replace(/\s+/g, "") === defaultTitle) {
    return "";
  }

  return normalizedTitle;
}

export function formatPageLabel(pageNumber: number, title?: string | null) {
  const pageLabel = getDefaultPageTitle(pageNumber);
  const customTitle = getCustomPageTitle(title, pageNumber);

  return customTitle ? `${pageLabel} · ${customTitle}` : pageLabel;
}
