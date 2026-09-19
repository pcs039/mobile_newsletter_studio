export type EbookSource = "internal" | "external";

export function normalizeEbookSource(value: unknown): EbookSource {
  return value === "external" ? "external" : "internal";
}

export function getValidExternalEbookUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string") {
    return null;
  }

  const value = rawUrl.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
