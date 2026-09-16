import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { updateNewsletterProjectStatus } from "@/lib/newsletter-repository";
import { getAbsoluteSiteUrl, getCanonicalSiteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const projectId = asText(payload?.projectId);

  if (!projectId) {
    return NextResponse.json(
      { ok: false, message: "발행할 프로젝트 ID가 필요합니다." },
      { status: 400 },
    );
  }

  const result = await updateNewsletterProjectStatus(projectId, "published");

  if (!result.ok) {
    return NextResponse.json(result, {
      status:
        result.status === "not_configured"
          ? 503
          : result.status === "not_found"
            ? 404
            : result.httpStatus ?? 500,
    });
  }

  const requestOrigin = new URL(request.url).origin;
  const origin = getCanonicalSiteOrigin(requestOrigin);
  const publicUrl = `/newsletters/${result.project.slug}`;
  const ebookUrl = `/newsletters/${result.project.slug}/ebook`;
  const publishedAt = new Date().toISOString();

  return NextResponse.json({
    ok: true,
    ebookUrl,
    ebookUrlAbsolute: getAbsoluteSiteUrl(ebookUrl, origin),
    project: result.project,
    publicUrl,
    publicUrlAbsolute: getAbsoluteSiteUrl(publicUrl, origin),
    publishedAt,
  });
}
