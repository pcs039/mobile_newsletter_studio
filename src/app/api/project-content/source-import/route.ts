import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import type { ArticleSourceImportFailure, ArticleSourceImportSuccess, ArticleSourceKind } from "@/lib/article-source-import-types";
import { extractPdfSourceText, PdfSourceTextError } from "@/lib/pdf-source-text";
import { extractWordSourceDocument } from "@/lib/word-document-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxAiSourceLength = 30_000;
const maxFileSizes: Record<ArticleSourceKind, number> = {
  docx: 8 * 1024 * 1024,
  pdf: 15 * 1024 * 1024,
};
const allowedMimeTypes: Record<ArticleSourceKind, Set<string>> = {
  docx: new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
  pdf: new Set(["application/pdf"]),
};

function errorResponse(error: string, message: string, status = 400) {
  return NextResponse.json<ArticleSourceImportFailure>({ ok: false, error, message }, { status });
}

function getSourceKind(fileName: string): ArticleSourceKind | null {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".pdf")) return "pdf";
  if (lowerName.endsWith(".docx")) return "docx";
  return null;
}

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return errorResponse("SOURCE_FILE_REQUIRED", "PDF 또는 Word(.docx) 파일을 선택해 주세요.");
  }

  const kind = getSourceKind(file.name);

  if (!kind || (file.type && !allowedMimeTypes[kind].has(file.type.toLowerCase()))) {
    return errorResponse("SOURCE_FILE_UNSUPPORTED", "PDF 또는 Word(.docx) 파일만 가져올 수 있습니다.");
  }

  if (file.size > maxFileSizes[kind]) {
    return errorResponse(
      "SOURCE_FILE_TOO_LARGE",
      kind === "pdf" ? "PDF 파일은 15MB 이하만 가져올 수 있습니다." : "Word 파일은 8MB 이하만 가져올 수 있습니다.",
    );
  }

  if (file.size === 0) {
    return errorResponse("SOURCE_FILE_EMPTY", "파일이 비어 있습니다. 다른 파일을 선택해 주세요.");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const wordDocument = kind === "docx" ? extractWordSourceDocument(buffer) : null;
    const fullSourceText = wordDocument?.sourceText ?? (await extractPdfSourceText(buffer));
    const originalCharCount = fullSourceText.length;
    const sourceText = fullSourceText.slice(0, maxAiSourceLength);
    const response: ArticleSourceImportSuccess = {
      ok: true,
      source: {
        fileName: file.name,
        kind,
        originalCharCount,
        sourceText,
        truncated: originalCharCount > maxAiSourceLength,
        usedCharCount: sourceText.length,
      },
      ...(wordDocument ? { wordArticle: wordDocument.article } : {}),
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof PdfSourceTextError) {
      return errorResponse(error.code, error.message);
    }

    return errorResponse(
      kind === "docx" ? "WORD_READ_FAILED" : "SOURCE_IMPORT_FAILED",
      kind === "docx"
        ? "Word 내용을 읽지 못했습니다. 파일 손상 여부를 확인해 주세요."
        : "원자료를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}
