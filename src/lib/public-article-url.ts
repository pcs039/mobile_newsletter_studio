const unclearLinkLabels = new Set(["", "자세히 보기", "URL", "url", "http", "https://"]);

export function getValidArticleUrl(rawUrl?: string | null) {
  const value = rawUrl?.trim();

  if (!value || /\s/.test(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    const hostnameParts = url.hostname.split(".");

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    if (!url.hostname || !url.hostname.includes(".")) {
      return null;
    }

    if (hostnameParts.some((part) => !part || part === "xn--" || part.endsWith("-"))) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function getArticleLinkButtonLabel(rawLabel?: string | null) {
  const label = rawLabel?.trim() ?? "";

  return unclearLinkLabels.has(label) ? "관련 링크 보기" : label;
}
