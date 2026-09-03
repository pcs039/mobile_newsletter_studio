import { inflateRawSync } from "zlib";

type ZipEntry = {
  compressedSize: number;
  compressionMethod: number;
  fileName: string;
  localHeaderOffset: number;
  uncompressedSize: number;
};

export type ImportedWordBlock = {
  type: "paragraph" | "video_link" | "button_group";
  title: string;
  body: string;
  sortOrder: number;
};

export type ImportedWordArticle = {
  title: string;
  summary: string;
  blocks: ImportedWordBlock[];
};

const centralDirectorySignature = 0x02014b50;
const endOfCentralDirectorySignature = 0x06054b50;
const localFileHeaderSignature = 0x04034b50;

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 0xffff - 22);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endOfCentralDirectorySignature) {
      return offset;
    }
  }

  return -1;
}

function readZipEntries(buffer: Buffer) {
  const endOffset = findEndOfCentralDirectory(buffer);

  if (endOffset < 0) {
    throw new Error("DOCX 압축 구조를 확인하지 못했습니다.");
  }

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== centralDirectorySignature) {
      throw new Error("DOCX 파일 목록을 읽지 못했습니다.");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    entries.push({
      compressedSize,
      compressionMethod,
      fileName,
      localHeaderOffset,
      uncompressedSize,
    });

    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return entries;
}

function readZipFile(buffer: Buffer, entries: ZipEntry[], fileName: string) {
  const entry = entries.find((item) => item.fileName === fileName);

  if (!entry) {
    return null;
  }

  const headerOffset = entry.localHeaderOffset;

  if (buffer.readUInt32LE(headerOffset) !== localFileHeaderSignature) {
    throw new Error("DOCX 내부 파일 위치를 확인하지 못했습니다.");
  }

  const fileNameLength = buffer.readUInt16LE(headerOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(headerOffset + 28);
  const dataOffset = headerOffset + 30 + fileNameLength + extraFieldLength;
  const compressedData = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressedData;
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressedData).subarray(0, entry.uncompressedSize);
  }

  throw new Error("지원하지 않는 DOCX 압축 방식입니다.");
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractParagraphs(documentXml: string) {
  const paragraphs = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];

  return paragraphs
    .map((paragraph) => {
      const textParts = paragraph.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g) ?? [];
      const text = textParts
        .map((part) => part.replace(/<[^>]+>/g, ""))
        .map(decodeXmlText)
        .join("");

      return text.trim();
    })
    .filter(Boolean);
}

function isYoutubeUrl(value: string) {
  return /https?:\/\/(?:www\.)?(youtube\.com|youtu\.be)\S*/i.test(value);
}

function isStandaloneUrl(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function makeBlockFromParagraph(paragraph: string, index: number): ImportedWordBlock {
  const sortOrder = (index + 1) * 10;

  if (isYoutubeUrl(paragraph)) {
    const url = paragraph.match(/https?:\/\/\S+/i)?.[0] ?? paragraph;

    return {
      type: "video_link",
      title: "영상 보기",
      body: url,
      sortOrder,
    };
  }

  if (isStandaloneUrl(paragraph)) {
    return {
      type: "button_group",
      title: "자세히 보기",
      body: paragraph,
      sortOrder,
    };
  }

  return {
    type: "paragraph",
    title: "",
    body: paragraph,
    sortOrder,
  };
}

export function importWordDocument(buffer: Buffer): ImportedWordArticle {
  const entries = readZipEntries(buffer);
  const documentXml = readZipFile(buffer, entries, "word/document.xml")?.toString("utf8");

  if (!documentXml) {
    throw new Error("Word 본문을 찾지 못했습니다.");
  }

  const paragraphs = extractParagraphs(documentXml);

  if (paragraphs.length === 0) {
    throw new Error("가져올 문단이 없습니다.");
  }

  const title = paragraphs[0] ?? "";
  const bodyParagraphs = paragraphs.slice(1);
  const summaryCandidate = bodyParagraphs.find((paragraph) => paragraph.length <= 120 && !isStandaloneUrl(paragraph)) ?? "";
  const blocks = bodyParagraphs.map(makeBlockFromParagraph);

  return {
    title,
    summary: summaryCandidate,
    blocks: blocks.length > 0 ? blocks : [makeBlockFromParagraph(title, 0)],
  };
}
