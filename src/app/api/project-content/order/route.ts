import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { articleOrderRpc, ArticleOrderError } from "@/lib/article-order-server";
import { articleOrderUuid } from "@/lib/article-order";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

function failure(error: unknown) {
  return NextResponse.json({ ok: false, message: error instanceof ArticleOrderError ? error.message : "순서 저장 상태를 확인하지 못했습니다. 목록을 다시 확인해 주세요." }, { status: error instanceof ArticleOrderError ? error.status : 502, headers });
}

export async function GET(request: Request) {
  const access = await requireProjectApiAccess({ projectSlug: new URL(request.url).searchParams.get("projectSlug") ?? "" });
  if (!access.ok) return access.response;
  try {
    return NextResponse.json({ ok: true, ...await articleOrderRpc(access.project.id) }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try { requireImageSameOrigin(request); }
  catch { return NextResponse.json({ ok: false, message: "현재 사이트에서 순서를 저장해 주세요." }, { status: 403, headers }); }
  const input = await request.json().catch(() => null);
  if (!input || typeof input.projectSlug !== "string" || !Array.isArray(input.articleIds) || input.articleIds.length > 5000 || input.articleIds.some((id: unknown) => typeof id !== "string" || !articleOrderUuid.test(id)) || new Set(input.articleIds).size !== input.articleIds.length || typeof input.snapshot !== "string" || !/^[a-f0-9]{32}$/.test(input.snapshot)) {
    return NextResponse.json({ ok: false, message: "기사 순서 요청을 확인해 주세요." }, { status: 400, headers });
  }
  const access = await requireProjectApiAccess({ projectSlug: input.projectSlug });
  if (!access.ok) return access.response;
  try {
    return NextResponse.json({ ok: true, ...await articleOrderRpc(access.project.id, input.articleIds, input.snapshot) }, { headers });
  } catch (error) { return failure(error); }
}
