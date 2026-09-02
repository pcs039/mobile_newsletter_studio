import { NextResponse } from "next/server";
import { uploadProjectFile, type ProjectFileUploadKind } from "@/lib/newsletter-file-storage";

export const dynamic = "force-dynamic";

const uploadKinds = ["pdf_original", "page_image", "asset_image", "audio_mp3"] as const;

function isUploadKind(value: FormDataEntryValue | null): value is ProjectFileUploadKind {
  return typeof value === "string" && uploadKinds.includes(value as ProjectFileUploadKind);
}

function asRequiredText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asPageNumber(value: FormDataEntryValue | null) {
  const pageNumber = typeof value === "string" ? Number(value) : 1;

  return Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      { ok: false, message: "업로드 요청 데이터를 확인하지 못했습니다." },
      { status: 400 },
    );
  }

  const projectSlug = asRequiredText(formData.get("projectSlug"));
  const kind = formData.get("kind");
  const file = formData.get("file");

  if (!projectSlug || !isUploadKind(kind) || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "프로젝트, 업로드 종류, 파일을 모두 확인해야 합니다." },
      { status: 400 },
    );
  }

  const result = await uploadProjectFile({
    file,
    kind,
    pageNumber: asPageNumber(formData.get("pageNumber")),
    projectSlug,
  });

  if (!result.ok) {
    return NextResponse.json(result, {
      status:
        result.status === "not_configured"
          ? 503
          : result.status === "project_not_found"
            ? 404
            : result.status === "invalid_file"
              ? 400
              : result.httpStatus ?? 500,
    });
  }

  return NextResponse.json(result, { status: 201 });
}
