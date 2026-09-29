import type { ImportedWordArticle } from "@/lib/word-document-import";

export type ArticleSourceKind = "pdf" | "docx";

export type ArticleSourceImportSuccess = {
  ok: true;
  source: {
    fileName: string;
    kind: ArticleSourceKind;
    originalCharCount: number;
    sourceText: string;
    truncated: boolean;
    usedCharCount: number;
  };
  wordArticle?: ImportedWordArticle;
};

export type ArticleSourceImportFailure = {
  ok: false;
  error: string;
  message: string;
};

export type ArticleSourceImportResponse = ArticleSourceImportSuccess | ArticleSourceImportFailure;
