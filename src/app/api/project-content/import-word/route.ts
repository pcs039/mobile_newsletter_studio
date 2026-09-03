import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { importWordDocument } from "@/lib/word-document-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxWordFileSize = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "Word 파일을 선택해 주세요." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ ok: false, message: ".docx 형식의 Word 파일만 가져올 수 있습니다." }, { status: 400 });
  }

  if (file.size > maxWordFileSize) {
    return NextResponse.json({ ok: false, message: "Word 파일은 8MB 이하만 가져올 수 있습니다." }, { status: 400 });
  }

  try {
    const imported = importWordDocument(Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ ok: true, imported });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Word 원고를 읽는 중 오류가 발생했습니다.",
      },
      { status: 400 },
    );
  }
}
