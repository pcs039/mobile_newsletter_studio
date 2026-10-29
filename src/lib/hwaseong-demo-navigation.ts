// Only the existing demo session grants access; these URLs carry no authority.
export function sampleDemoHref(slug: string, href: string) {
  const source = new URL(href, "https://demo.invalid");
  const query = new URLSearchParams({ project: slug });
  for (const key of ["articleId", "view", "width", "interest", "display", "entry"]) {
    const value = source.searchParams.get(key); if (value) query.set(key, value);
  }
  return `/demo?${query}${source.hash}`;
}
export function canUseSampleDemoHistory(href: string, current: string, slug: string) {
  try {
    const next = new URL(href, current), previous = new URL(current);
    return next.origin === previous.origin && next.pathname === "/demo" && next.searchParams.getAll("project").length === 1 && next.searchParams.get("project") === slug;
  } catch { return false; }
}
