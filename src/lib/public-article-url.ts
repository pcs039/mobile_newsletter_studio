const unclearLinkLabels = new Set(["", "URL", "url", "http", "https://"]);

type ArticleActionType = "url" | "phone" | "map" | "video" | "internal_page" | "download";
type ValidArticleActionHref = {
  actionType: "url" | "phone";
  href: string;
};

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

export function getValidArticlePhoneHref(rawPhone?: string | null) {
  let value = rawPhone?.trim() ?? "";

  if (!value || /^(javascript|data|vbscript):/i.test(value)) {
    return null;
  }

  if (/^tel:/i.test(value)) {
    value = value.replace(/^tel:/i, "").trim();
  }

  if (!value || /[a-z]/i.test(value)) {
    return null;
  }

  const normalized = value.replace(/[\s().-]/g, "");

  if (!/^\+?\d+$/.test(normalized)) {
    return null;
  }

  const digitCount = normalized.replace(/\D/g, "").length;

  if (digitCount < 7 || digitCount > 15) {
    return null;
  }

  return `tel:${normalized}`;
}

export function getValidArticleActionHref(
  rawTarget?: string | null,
  actionType?: ArticleActionType | string | null,
): ValidArticleActionHref | null {
  if (actionType === "phone") {
    const phoneHref = getValidArticlePhoneHref(rawTarget);

    return phoneHref ? { actionType: "phone", href: phoneHref } : null;
  }

  const webHref = getValidArticleUrl(rawTarget);

  if (webHref) {
    return { actionType: "url", href: webHref };
  }

  const phoneHref = getValidArticlePhoneHref(rawTarget);

  return phoneHref ? { actionType: "phone", href: phoneHref } : null;
}

export function getArticleLinkButtonLabel(rawLabel?: string | null, actionType?: ValidArticleActionHref["actionType"]) {
  if (actionType === "phone") {
    return "전화 연결";
  }

  const label = rawLabel?.trim() ?? "";

  return unclearLinkLabels.has(label) ? "자세히 보기" : label;
}
