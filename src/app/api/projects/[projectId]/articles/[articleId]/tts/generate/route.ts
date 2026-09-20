import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { articleTtsVoices, generateArticleTtsAudio } from "@/lib/article-tts-audio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ArticleTtsGenerateRouteProps = {
  params: Promise<{
    articleId: string;
    projectId: string;
  }>;
};

type GenerateRequest = {
  force?: boolean;
  voice?: string;
};

export async function POST(request: Request, { params }: ArticleTtsGenerateRouteProps) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { articleId, projectId } = await params;
  const body = (await request.json().catch(() => ({}))) as GenerateRequest;
  const voice = body.voice?.trim() || null;

  if (voice && !articleTtsVoices.includes(voice as (typeof articleTtsVoices)[number])) {
    return NextResponse.json(
      { ok: false, error: "TTS_INVALID_VOICE", message: "지원하지 않는 AI 음성입니다." },
      { status: 400 },
    );
  }

  const result = await generateArticleTtsAudio(projectId, articleId, voice, body.force === true);

  if (!result.ok) {
    return NextResponse.json(result, { status: result.httpStatus ?? 500 });
  }

  return NextResponse.json(result);
}
