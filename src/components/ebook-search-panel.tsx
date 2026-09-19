"use client";

import { FormEvent, useMemo, useState } from "react";

type EbookSearchResult = {
  pageId: string;
  pageNumber: number;
  snippet: string;
};

type EbookSearchPanelProps = {
  hasSearchText: boolean;
  onClose: () => void;
  onSelectPage: (pageNumber: number) => void;
  open: boolean;
  placement: "desktop" | "mobile";
  slug: string;
};

type SearchApiResult = {
  count?: number;
  hasIndexedPages?: boolean;
  hasSearchText?: boolean;
  message?: string;
  ok?: boolean;
  query?: string;
  results?: EbookSearchResult[];
};

function HighlightedSnippet({ query, text }: { query: string; text: string }) {
  const parts = useMemo(() => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [{ match: false, text }];
    }

    const chunks: Array<{ match: boolean; text: string }> = [];
    const lowerText = text.toLocaleLowerCase();
    const lowerQuery = normalizedQuery.toLocaleLowerCase();
    let cursor = 0;

    while (cursor < text.length) {
      const index = lowerText.indexOf(lowerQuery, cursor);

      if (index < 0) {
        chunks.push({ match: false, text: text.slice(cursor) });
        break;
      }

      if (index > cursor) {
        chunks.push({ match: false, text: text.slice(cursor, index) });
      }

      chunks.push({ match: true, text: text.slice(index, index + normalizedQuery.length) });
      cursor = index + normalizedQuery.length;
    }

    return chunks.length > 0 ? chunks : [{ match: false, text }];
  }, [query, text]);

  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={`${part.text}-${index}`} className="rounded bg-yellow-200 px-0.5 font-black text-slate-950">
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function EbookSearchPanel({ hasSearchText, onClose, onSelectPage, open, placement, slug }: EbookSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [results, setResults] = useState<EbookSearchResult[]>([]);
  const [message, setMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  if (!open) {
    return null;
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextQuery = query.trim();

    if (!hasSearchText) {
      setMessage("문서 검색 데이터가 준비되지 않았습니다.");
      setResults([]);
      return;
    }

    if (!nextQuery) {
      setMessage("검색어를 입력하세요.");
      setResults([]);
      return;
    }

    setIsSearching(true);
    setMessage("");

    try {
      const response = await fetch(`/api/public/newsletters/${slug}/ebook/search?q=${encodeURIComponent(nextQuery)}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as SearchApiResult | null;

      if (!response.ok || !result?.ok) {
        setResults([]);
        setMessage(result?.message ?? "문서 검색을 완료하지 못했습니다.");
        return;
      }

      setLastQuery(result.query ?? nextQuery);
      setResults(result.results ?? []);

      if (result.hasIndexedPages && !result.hasSearchText) {
        setMessage("이 e-book은 검색 가능한 텍스트가 없습니다.");
      } else {
        setMessage((result.count ?? 0) > 0 ? `검색 결과 ${result.count}건` : "검색 결과가 없습니다.");
      }
    } catch {
      setResults([]);
      setMessage("문서 검색을 완료하지 못했습니다.");
    } finally {
      setIsSearching(false);
    }
  }

  const panel = (
    <section
      className={
        placement === "desktop"
          ? "fixed right-4 top-20 z-[70] flex max-h-[calc(100dvh-7rem)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-blue-950/30"
          : "relative z-10 mx-auto flex max-h-[78dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-blue-950/30"
      }
      aria-label="문서 검색"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#092046] px-5 py-4 text-white">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-sky-200">Document Search</p>
          <h2 className="mt-1 text-lg font-black">문서 검색</h2>
        </div>
        <button type="button" onClick={onClose} className="dd-btn dd-btn-ghost dd-btn-sm text-xs">
          닫기
        </button>
      </div>
      <div className="border-b border-slate-200 p-4">
        <form onSubmit={submitSearch} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label className="sr-only" htmlFor={`ebook-search-input-${placement}`}>
            검색어
          </label>
          <input
            id={`ebook-search-input-${placement}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={100}
            placeholder="검색어를 입력하세요"
            className="min-h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-[#092046] outline-none focus:ring-2 focus:ring-[#2f73b7]"
          />
          <button type="submit" disabled={isSearching || !hasSearchText} className="dd-btn dd-btn-primary dd-btn-sm min-h-11 rounded-xl px-4 text-xs">
            {isSearching ? "검색 중" : "검색"}
          </button>
        </form>
        {!hasSearchText ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
            문서 검색 데이터가 준비되지 않았습니다.
          </p>
        ) : null}
        {message ? <p className="mt-3 text-sm font-bold text-slate-600">{message}</p> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {results.length > 0 ? (
          <div className="space-y-2">
            {results.map((result) => (
              <button
                key={result.pageId}
                type="button"
                onClick={() => onSelectPage(result.pageNumber)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-[#2f73b7] hover:bg-[#f4f8ff]"
              >
                <span className="text-sm font-black text-[#184a88]">{result.pageNumber}쪽</span>
                <span className="mt-2 block text-sm font-semibold leading-6 text-slate-700">
                  <HighlightedSnippet query={lastQuery} text={result.snippet} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
            검색어를 입력하면 페이지별 결과가 표시됩니다.
          </p>
        )}
      </div>
    </section>
  );

  if (placement === "desktop") {
    return (
      <>
        <button type="button" className="fixed inset-0 z-[60] bg-slate-950/20" aria-label="문서 검색 닫기" onClick={onClose} />
        {panel}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/55 px-3 pb-3 pt-[calc(3rem+env(safe-area-inset-top))]">
      <button type="button" className="absolute inset-0" aria-label="문서 검색 닫기" onClick={onClose} />
      {panel}
    </div>
  );
}
