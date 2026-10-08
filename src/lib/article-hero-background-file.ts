import "server-only";
import { NextResponse } from "next/server";
import { getArticleHeroBackgroundReferences } from "@/lib/article-composition-repository";
import { getSupabaseStorageEndpoint } from "@/lib/supabase-config";

// Call only after checking public project visibility or the authenticated preview/review session.
export async function serveArticleHeroBackground(projectId: string, articleId: string, includeDraftArticles = false) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
  const failure = () => NextResponse.json({ ok: false, message: "배경판을 찾지 못했습니다." }, { status: 404, headers });
  const reference = (await getArticleHeroBackgroundReferences(projectId, [articleId], includeDraftArticles))[articleId];
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!reference || !key) return failure();
  const endpoint = getSupabaseStorageEndpoint(`/object/design-production-assets/${reference.path.split("/").map(encodeURIComponent).join("/")}`);
  if (!endpoint) return failure();
  try {
    const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    const type = response.headers.get("Content-Type")?.split(";")[0] ?? "";
    if (!response.ok || !response.body || !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(type)) return failure();
    return new NextResponse(response.body, { headers: { ...headers, "Content-Type": type, "Content-Disposition": "inline",
      ...(type === "image/svg+xml" ? { "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'" } : {}),
    } });
  } catch { return failure(); }
}
