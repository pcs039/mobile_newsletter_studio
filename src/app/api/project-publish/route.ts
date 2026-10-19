import { NextResponse } from "next/server";
import { publishProjectIfClientApproved } from "@/lib/client-review-repository";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";
import { prepareProjectPublication, transitionProjectPublication, PublicationError, publicationHeaders } from "@/lib/project-publication";
import { getAbsoluteSiteUrl, getCanonicalSiteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { requireImageSameOrigin(request); } catch { return NextResponse.json({ ok: false, message: "현재 관리자 화면에서 요청하세요." }, { status: 403 }); }
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const projectId = typeof payload?.projectId === "string" ? payload.projectId.trim() : "";
  if (!projectId) return NextResponse.json({ ok: false, message: "프로젝트 ID가 필요합니다." }, { status: 400 });
  const access = await requireProjectApiAccess({ projectId });
  if (!access.ok) return access.response;
  try {
    if (payload?.action === "prepare") return NextResponse.json({ ok: true, preparation: await prepareProjectPublication(access.project.id) }, { headers: publicationHeaders });
    const origin = getCanonicalSiteOrigin(new URL(request.url).origin);
    let project: { slug: string; publishedAt: string | null; status: string };
    let extra = {};
    // Old clients never gain direct-publish rights by omitting a mode or key.
    if (!payload?.action && payload?.mode === undefined) {
      const result = await publishProjectIfClientApproved(access.project.id, { project: access.project, user: access.user });
      if (result.status !== "ok") return NextResponse.json({ ok: false, message: result.message }, { status: ["approval_required", "conflict"].includes(result.status) ? 409 : ["not_configured", "migration_required"].includes(result.status) ? 503 : result.status === "not_found" ? 404 : result.httpStatus ?? 502, headers: publicationHeaders });
      project = result.data;
    } else {
      if (!["publish", "unpublish"].includes(String(payload?.action)) || !["author_direct", "client_review"].includes(String(payload?.mode))) throw new PublicationError(400, "발행 방식을 확인하세요.");
      const receipt = await transitionProjectPublication(access.project, access.user, { requestKey: payload?.requestKey, action: payload?.action, mode: payload?.mode, revision: payload?.revision, confirmed: payload?.confirmed });
      project = { slug: receipt.slug, publishedAt: receipt.published_at, status: receipt.current_status };
      extra = { receipt, duplicate: receipt.duplicate };
    }
    const publicUrl = `/newsletters/${project.slug}`, ebookUrl = `${publicUrl}/ebook`;
    return NextResponse.json({ ok: true, ...extra, project, publishedAt: project.publishedAt, publicUrl, ebookUrl, publicUrlAbsolute: getAbsoluteSiteUrl(publicUrl, origin), ebookUrlAbsolute: getAbsoluteSiteUrl(ebookUrl, origin) }, { headers: publicationHeaders });
  } catch (error) {
    return NextResponse.json({ ok: false, uncertain: error instanceof PublicationError && error.uncertain, message: error instanceof PublicationError ? error.message : "발행 상태를 확인하지 못했습니다." }, { status: error instanceof PublicationError ? error.status : 503, headers: publicationHeaders });
  }
}
