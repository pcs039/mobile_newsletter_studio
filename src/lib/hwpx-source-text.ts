import JSZip from "jszip";

const minimumMeaningfulCharacterCount = 10;
const sectionPathPattern = /^Contents\/section(\d+)\.xml$/i;
const paragraphPattern = /<(?:[\w.-]+:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?p\s*>/gi;
const textPattern = /<(?:[\w.-]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?t\s*>/gi;

export class HwpxSourceTextError extends Error {
  code: "HWPX_READ_FAILED" | "HWPX_STRUCTURE_INVALID" | "HWPX_TEXT_NOT_FOUND";

  constructor(code: HwpxSourceTextError["code"], message: string) {
    super(message);
    this.name = "HwpxSourceTextError";
    this.code = code;
  }
}

function decodeXmlText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[\t\n\r ]+/g, " ");
}

function extractParagraphs(sectionXml: string) {
  return [...sectionXml.matchAll(paragraphPattern)]
    .map((paragraphMatch) =>
      [...paragraphMatch[1].matchAll(textPattern)]
        .map((textMatch) => decodeXmlText(textMatch[1].replace(/<[^>]+>/g, "")))
        .join("")
        .trim(),
    )
    .filter(Boolean);
}

export async function extractHwpxSourceText(buffer: Buffer) {
  let archive: JSZip;

  try {
    archive = await JSZip.loadAsync(buffer);
  } catch {
    throw new HwpxSourceTextError(
      "HWPX_READ_FAILED",
      "HWPX 파일을 읽지 못했습니다. 파일 손상 여부를 확인해 주세요.",
    );
  }

  const sections = Object.keys(archive.files)
    .flatMap((path) => {
      const match = path.match(sectionPathPattern);
      return match ? [{ index: Number.parseInt(match[1], 10), path }] : [];
    })
    .sort((left, right) => left.index - right.index);

  if (sections.length === 0 || !archive.file("Contents/content.hpf")) {
    throw new HwpxSourceTextError("HWPX_STRUCTURE_INVALID", "HWPX 문서 구조를 확인하지 못했습니다.");
  }

  try {
    const paragraphs: string[] = [];

    for (const section of sections) {
      const sectionXml = await archive.file(section.path)?.async("string");

      if (!sectionXml) {
        throw new HwpxSourceTextError(
          "HWPX_READ_FAILED",
          "HWPX 파일을 읽지 못했습니다. 파일 손상 여부를 확인해 주세요.",
        );
      }

      paragraphs.push(...extractParagraphs(sectionXml));
    }

    const sourceText = paragraphs.join("\n\n").trim();
    const meaningfulCharacterCount = sourceText.replace(/[^\p{L}\p{N}]/gu, "").length;

    if (meaningfulCharacterCount < minimumMeaningfulCharacterCount) {
      throw new HwpxSourceTextError(
        "HWPX_TEXT_NOT_FOUND",
        "이 HWPX에서 읽을 수 있는 본문 텍스트를 찾지 못했습니다.",
      );
    }

    return sourceText;
  } catch (error) {
    if (error instanceof HwpxSourceTextError) {
      throw error;
    }

    throw new HwpxSourceTextError(
      "HWPX_READ_FAILED",
      "HWPX 파일을 읽지 못했습니다. 파일 손상 여부를 확인해 주세요.",
    );
  }
}
