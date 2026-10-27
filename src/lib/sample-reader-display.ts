export type SampleDisplay = "mobile" | "ebook";
export function sampleDisplay(query: Pick<URLSearchParams, "getAll"> | null): SampleDisplay | undefined {
  const values = query?.getAll("display") ?? [];
  return values.length === 1 && (values[0] === "mobile" || values[0] === "ebook") ? values[0] : undefined;
}
export function withSampleDisplay(href: string, display: SampleDisplay | undefined) {
  const url = new URL(href, "https://sample.invalid");
  if (display) url.searchParams.set("display", display);
  return url.pathname + url.search + url.hash;
}
export function ebookKeyboardDirection(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "defaultPrevented">, interactive: boolean) {
  if (interactive || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  return event.key === "ArrowLeft" ? "previous" : event.key === "ArrowRight" ? "next" : null;
}
