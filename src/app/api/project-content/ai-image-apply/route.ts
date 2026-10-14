import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";
import { requireStagingE2E } from "@/lib/staging-environment";
import { ImageGenerationError } from "@/lib/article-image-generation";
import { CanvaConnectError } from "@/lib/canva-connect-contract";
import { aiImageArticleRpc, getAiImageApplyState } from "@/lib/ai-image-article-server";
export const runtime = "nodejs";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  try {
    requireStagingE2E(request);
    requireImageSameOrigin(request);
    if (Number(request.headers.get("content-length")) > 5000) throw new ImageGenerationError(413, "요청이 너무 큽니다.");
    const p = await request.json();
    if (!p || Object.keys(p).some(k => !["projectSlug", "articleId", "action", "role", "assetId", "expected", "generationKey", "confirmedStale"].includes(k)) ||
      typeof p.projectSlug !== "string" || !uuid.test(p.articleId ?? "") || !["state", "apply", "revoke"].includes(p.action) ||
      (p.action !== "state" && (!uuid.test(p.assetId ?? "") || !["hero", "body"].includes(p.role) || !/^[a-f0-9]{32}$/.test(p.expected ?? "")))) {
      throw new ImageGenerationError(400, "현재 기사와 적용 자산을 확인하세요.");
    }
    const access = await requireProjectApiAccess({ projectSlug: p.projectSlug });
    if (!access.ok) return access.response;
    if (access.user.role !== "admin") throw new ImageGenerationError(403, "관리자만 기사 이미지를 적용할 수 있습니다.");
    const state = await getAiImageApplyState(access.project.id, access.project.slug, p.articleId, [access.project.primaryColor]);
    if (p.action === "state") return json({ ok: true, ...state });
    const candidate = state.candidates.find(a => a.id === p.assetId);
    if (p.action === "apply") {
      if (state.conflict) throw new ImageGenerationError(409, "현재 Canva 전체 디자인 또는 이미지형 기사가 적용되어 있습니다. 먼저 해당 적용을 해제하세요.");
      if (!candidate || candidate.approvalStatus !== "approved") throw new ImageGenerationError(403, "자산 관리에서 먼저 이 이미지의 승인을 확인하세요.");
      if (p.generationKey !== candidate.generationKey || (candidate.stale && p.confirmedStale !== true)) {
        throw new ImageGenerationError(409, "기사 내용이 변경되었습니다. 적용 전 다시 확인하세요.");
      }
    } else if (!state.connections.some(c => c.role === p.role && c.assetId === p.assetId)) {
      throw new ImageGenerationError(409, "현재 연결된 이미지가 아닙니다. 적용 상태를 다시 확인하세요.");
    }
    // p.expected comes from the displayed state, never the newly read snapshot.
    // The RPC validates it after locking, including races after this read.
    const applied = await aiImageArticleRpc(access.project.id, p.articleId, p.action, p.role, p.assetId,
      p.expected, candidate?.generationKey, candidate?.variantIndex);
    return json({ ok: true, ...applied, state: await getAiImageApplyState(access.project.id, access.project.slug, p.articleId, [access.project.primaryColor]) });
  } catch (error) {
    const known = error instanceof ImageGenerationError || error instanceof CanvaConnectError;
    return json({ ok: false, message: known ? error.message : "이미지 적용 상태를 확인하지 못했습니다. 현재 상태를 다시 확인하세요." }, known ? error.status : 502);
  }
}
