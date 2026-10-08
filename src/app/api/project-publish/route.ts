import { NextResponse } from "next/server";
import { publishProjectIfClientApproved } from "@/lib/client-review-repository";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getAbsoluteSiteUrl, getCanonicalSiteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const projectId = asText(payload?.projectId);

  if (!projectId) {
    return NextResponse.json(
      { ok: false, message: "발행할 프로젝트 ID가 필요합니다." },
      { status: 400 },
    );
  }

  const access = await requireProjectApiAccess({ projectId });

  if (!access.ok) {
    return access.response;
  }

  const result = await publishProjectIfClientApproved(access.project.id);

  if (result.status !== "ok") {
    return NextResponse.json({ ok: false, message: result.message }, {
      status:
        result.status === "not_configured" || result.status === "migration_required"
          ? 503
          : result.status === "not_found"
            ? 404
            : result.status === "approval_required" || result.status === "conflict"
              ? 409
              : result.httpStatus ?? 500,
    });
  }

  const requestOrigin = new URL(request.url).origin;
  const origin = getCanonicalSiteOrigin(requestOrigin);
  const publicUrl = `/newsletters/${result.data.slug}`;
  const ebookUrl = `/newsletters/${result.data.slug}/ebook`;

  return NextResponse.json({
    ok: true,
    ebookUrl,
    ebookUrlAbsolute: getAbsoluteSiteUrl(ebookUrl, origin),
    project: result.data,
    publicUrl,
    publicUrlAbsolute: getAbsoluteSiteUrl(publicUrl, origin),
    publishedAt: result.data.publishedAt,
  });
}
