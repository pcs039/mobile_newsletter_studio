import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/app-auth";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";
import { completeFontUpload, FontBatchError, prepareFontUpload } from "@/lib/font-batch-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
  try {
    const user = await requireApiUser();
    if (!user) return reply({ ok: false, message: "로그인이 필요합니다." }, 401);
    if (user.role !== "admin") return reply({ ok: false, message: "관리자만 폰트를 등록할 수 있습니다." }, 403);
    requireImageSameOrigin(request);
    const raw = await request.text();
    if (raw.length > 8000) return reply({ ok: false, message: "요청 크기를 확인하세요." }, 400);
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input)) return reply({ ok: false, message: "요청을 확인하세요." }, 400);
    if (input.action === "prepare") return reply(await prepareFontUpload(input, user.id));
    if (input.action === "complete" && typeof input.token === "string") return reply(await completeFontUpload(input.token, user.id));
    return reply({ ok: false, message: "등록 요청을 확인하세요." }, 400);
  } catch (error) {
    const status = error instanceof FontBatchError ? error.status : error && typeof error === "object" && "status" in error && error.status === 403 ? 403 : error instanceof SyntaxError ? 400 : 502;
    return reply({ ok: false, message: error instanceof FontBatchError ? error.message : status === 403 ? "현재 관리자 화면에서 다시 요청하세요." : "등록 결과를 확인하지 못했습니다. 같은 파일로 다시 확인하세요." }, status);
  }
}
