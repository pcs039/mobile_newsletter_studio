function normalizeSiteOrigin(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, "") ?? "";

  if (!trimmed) {
    return "";
  }

  const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return "";
  }
}

export function getCanonicalSiteOrigin(fallbackOrigin = "") {
  return (
    normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeSiteOrigin(process.env.SITE_URL) ||
    normalizeSiteOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeSiteOrigin(fallbackOrigin)
  );
}

export function getAbsoluteSiteUrl(pathOrUrl: string, fallbackOrigin = "") {
  if (/^https?:\/\//.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const origin = getCanonicalSiteOrigin(fallbackOrigin);
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;

  return origin ? `${origin}${path}` : path;
}

export function getRequestOriginFromHeaders(headers: Headers) {
  const host = headers.get("x-forwarded-host") || headers.get("host") || "";

  if (!host) {
    return "";
  }

  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}
