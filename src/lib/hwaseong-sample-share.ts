// These are authenticated navigation targets, NOT public sharing permission.
// A compatible, explicitly approved read-only entry must supply externalUrl.
export type SampleShareTarget = { title: string; entryHref: string; externalUrl?: string };

export function sampleShareTarget(slug: string, title: string, articleId?: string): SampleShareTarget {
  const query = new URLSearchParams({ ...(articleId ? { articleId } : {}), entry: "share" });
  return { title, entryHref: `/projects/${encodeURIComponent(slug)}/samples?${query}` };
}

type ShareBrowser = Pick<Navigator, "share" | "canShare" | "clipboard">;
export async function shareApprovedSampleLink(target: SampleShareTarget, browser: ShareBrowser): Promise<"shared" | "copied" | "cancelled"> {
  // Never fall back to exporting an authenticated sample, API, or admin URL.
  if (!target.externalUrl) throw new Error("SHARE_NOT_APPROVED");
  const url = new URL(target.externalUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || /^\/(?:projects|api|login)(?:\/|$)/i.test(url.pathname)
    || [...url.searchParams.keys()].some(k => !["project", "articleId", "entry"].includes(k))) throw new Error("SHARE_NOT_APPROVED");
  const data = { title: target.title, url: url.href };
  if (browser.share && (!browser.canShare || browser.canShare(data))) {
    try { await browser.share(data); return "shared"; }
    catch (error) { if (error instanceof Error && error.name === "AbortError") return "cancelled"; throw error; }
  }
  if (!browser.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE");
  await browser.clipboard.writeText(url.href);
  return "copied";
}
