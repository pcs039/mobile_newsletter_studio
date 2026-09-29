import { extractText, getDocumentProxy } from "unpdf";

const minimumMeaningfulCharacterCount = 30;

export class PdfSourceTextError extends Error {
  code: "PDF_READ_FAILED" | "PDF_TEXT_NOT_FOUND";

  constructor(code: PdfSourceTextError["code"], message: string) {
    super(message);
    this.name = "PdfSourceTextError";
    this.code = code;
  }
}

function normalizePageText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export async function extractPdfSourceText(buffer: Buffer) {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;

  try {
    if (buffer.subarray(0, 5).toString("utf8") !== "%PDF-") {
      throw new PdfSourceTextError("PDF_READ_FAILED", "PDF 파일 형식을 확인하지 못했습니다.");
    }

    pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: false });
    const sourceText = result.text.map(normalizePageText).filter(Boolean).join("\n\n").trim();
    const meaningfulCharacterCount = sourceText.replace(/[^\p{L}\p{N}]/gu, "").length;

    if (meaningfulCharacterCount < minimumMeaningfulCharacterCount) {
      throw new PdfSourceTextError(
        "PDF_TEXT_NOT_FOUND",
        "이 PDF에서 읽을 수 있는 텍스트를 찾지 못했습니다. 스캔 이미지 PDF일 수 있습니다.",
      );
    }

    return sourceText;
  } catch (error) {
    if (error instanceof PdfSourceTextError) {
      throw error;
    }

    throw new PdfSourceTextError(
      "PDF_READ_FAILED",
      "PDF 내용을 읽지 못했습니다. 암호 설정 또는 파일 손상 여부를 확인해 주세요.",
    );
  } finally {
    const destroy = (pdf as { destroy?: () => Promise<void> | void } | null)?.destroy;

    if (typeof destroy === "function") {
      await destroy.call(pdf);
    }
  }
}
