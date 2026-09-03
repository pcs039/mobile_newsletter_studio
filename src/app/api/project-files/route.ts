import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import {
  completeSignedProjectFileUpload,
  deleteProjectFile,
  prepareSignedProjectFileUpload,
  uploadProjectFile,
  type ProjectFileUploadKind,
} from "@/lib/newsletter-file-storage";

export const dynamic = "force-dynamic";

const uploadKinds = ["pdf_original", "page_image", "asset_image", "audio_mp3"] as const;

function isUploadKind(value: FormDataEntryValue | null): value is ProjectFileUploadKind {
  return typeof value === "string" && uploadKinds.includes(value as ProjectFileUploadKind);
}

function asRequiredText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asRequiredJsonText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asPageNumber(value: FormDataEntryValue | null | unknown) {
  const pageNumber = typeof value === "string" || typeof value === "number" ? Number(value) : 1;

  return Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
}

function isJsonUploadKind(value: unknown): value is ProjectFileUploadKind {
  return typeof value === "string" && uploadKinds.includes(value as ProjectFileUploadKind);
}

function getErrorStatus(status: string, httpStatus?: number) {
  return status === "not_configured"
    ? 503
    : status === "project_not_found" || status === "not_found"
      ? 404
      : status === "invalid_file"
        ? 400
        : httpStatus ?? 500;
}

export async function DELETE(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const projectSlug = searchParams.get("projectSlug")?.trim() ?? "";
  const path = searchParams.get("path")?.trim() ?? "";
  const recordId = searchParams.get("recordId")?.trim() || undefined;

  if (!isJsonUploadKind(kind) || !projectSlug || !path) {
    return NextResponse.json(
      { ok: false, message: "삭제할 프로젝트, 파일 종류, 파일 경로를 확인해야 합니다." },
      { status: 400 },
    );
  }

  const result = await deleteProjectFile({
    kind,
    path,
    projectSlug,
    recordId,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | {
          action?: string;
          bucket?: string;
          fileName?: string;
          kind?: string;
          mimeType?: string;
          pageNumber?: number;
          path?: string;
          projectSlug?: string;
          size?: number;
        }
      | null;

    if (!body || !body.action || !isJsonUploadKind(body.kind)) {
      return NextResponse.json(
        { ok: false, message: "업로드 요청 정보를 확인하지 못했습니다." },
        { status: 400 },
      );
    }

    const projectSlug = asRequiredJsonText(body.projectSlug);
    const fileName = asRequiredJsonText(body.fileName);
    const mimeType = asRequiredJsonText(body.mimeType);
    const size = Number(body.size);

    if (!projectSlug || !fileName || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json(
        { ok: false, message: "프로젝트, 파일명, 파일 크기를 모두 확인해야 합니다." },
        { status: 400 },
      );
    }

    if (body.action === "prepare") {
      const result = await prepareSignedProjectFileUpload({
        fileName,
        kind: body.kind,
        mimeType,
        pageNumber: asPageNumber(body.pageNumber),
        projectSlug,
        size,
      });

      if (!result.ok) {
        return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
      }

      return NextResponse.json(result);
    }

    if (body.action === "complete") {
      const bucket = asRequiredJsonText(body.bucket);
      const path = asRequiredJsonText(body.path);

      if (!bucket || !path) {
        return NextResponse.json(
          { ok: false, message: "업로드 완료 기록에 필요한 Storage 정보를 확인해야 합니다." },
          { status: 400 },
        );
      }

      const result = await completeSignedProjectFileUpload({
        bucket,
        fileName,
        kind: body.kind,
        mimeType,
        pageNumber: asPageNumber(body.pageNumber),
        path,
        projectSlug,
        size,
      });

      if (!result.ok) {
        return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
      }

      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ ok: false, message: "지원하지 않는 업로드 작업입니다." }, { status: 400 });
  }

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
    return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
  }

  return NextResponse.json(result, { status: 201 });
}
