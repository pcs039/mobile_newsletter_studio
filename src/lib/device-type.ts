export type PublicDeviceType = "mobile" | "tablet" | "pc";

export function detectDeviceType(userAgent: string | null | undefined): PublicDeviceType {
  const normalized = userAgent?.toLowerCase() ?? "";

  if (/ipad|tablet/.test(normalized)) {
    return "tablet";
  }

  if (/mobi|iphone|android/.test(normalized)) {
    return "mobile";
  }

  return "pc";
}
