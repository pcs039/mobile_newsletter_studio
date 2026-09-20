"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type EbookTtsPage = {
  id: string;
  pageNumber: number;
};

export type EbookTtsStatus = "idle" | "loading" | "playing" | "paused" | "error";

type EbookTtsPageText = {
  hasText?: boolean;
  pageId: string;
  pageNumber: number;
  text: string;
};

type UseEbookTtsOptions = {
  currentIndex: number;
  enabled: boolean;
  onNavigateToIndex: (index: number) => void;
  pages: EbookTtsPage[];
  slug: string;
};

type PageTextState = "idle" | "loading" | "ready" | "empty" | "error";

const rateStorageKey = "datadiction_ebook_tts_rate";
const autoAdvanceStorageKey = "datadiction_ebook_tts_auto_advance";
const allowedRates = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const maxChunkLength = 850;

function getInitialRate() {
  if (typeof window === "undefined") {
    return 1;
  }

  try {
    const stored = Number(window.localStorage.getItem(rateStorageKey));

    return allowedRates.includes(stored as (typeof allowedRates)[number]) ? stored : 1;
  } catch {
    return 1;
  }
}

function getInitialAutoAdvance() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    return window.localStorage.getItem(autoAdvanceStorageKey) !== "false";
  } catch {
    return true;
  }
}

function getSpeechSupport() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

function splitLongText(value: string) {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const end = Math.min(cursor + maxChunkLength, value.length);
    const slice = value.slice(cursor, end);
    const breakIndex = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\n"), slice.lastIndexOf("，"), slice.lastIndexOf(","));
    const nextEnd = breakIndex > 120 && end < value.length ? cursor + breakIndex + 1 : end;
    const chunk = value.slice(cursor, nextEnd).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    cursor = nextEnd;
  }

  return chunks;
}

function splitTextIntoSpeechChunks(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const sentences = normalized.match(/[^.!?。！？\n]+[.!?。！？]?/g) ?? [normalized];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const nextSentence = sentence.trim();

    if (!nextSentence) {
      continue;
    }

    if (nextSentence.length > maxChunkLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }

      chunks.push(...splitLongText(nextSentence));
      continue;
    }

    const nextValue = current ? `${current} ${nextSentence}` : nextSentence;

    if (nextValue.length > maxChunkLength) {
      if (current) {
        chunks.push(current);
      }

      current = nextSentence;
    } else {
      current = nextValue;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function selectKoreanVoice(voices: SpeechSynthesisVoice[]) {
  return voices.find((voice) => voice.lang === "ko-KR") ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("ko")) ?? null;
}

function logTts(event: string, details?: Record<string, unknown>) {
  console.info("[ebook-tts]", event, details ?? {});
}

export function useEbookTts({ currentIndex, enabled, onNavigateToIndex, pages, slug }: UseEbookTtsOptions) {
  const [status, setStatus] = useState<EbookTtsStatus>("idle");
  const [message, setMessage] = useState("읽기 텍스트 준비 중...");
  const [rate, setRate] = useState(getInitialRate);
  const [autoAdvance, setAutoAdvance] = useState(getInitialAutoAdvance);
  const [isSupported, setIsSupported] = useState(false);
  const [currentPageTextState, setCurrentPageTextState] = useState<PageTextState>("idle");
  const [currentSpeakingIndex, setCurrentSpeakingIndex] = useState<number | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const autoAdvanceRef = useRef(autoAdvance);
  const cacheRef = useRef(new Map<string, EbookTtsPageText>());
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const navigateRef = useRef(onNavigateToIndex);
  const pagesRef = useRef(pages);
  const rateRef = useRef(rate);
  const sessionRef = useRef(0);
  const speakChunksRef = useRef<(pageIndex: number, chunks: string[], sessionId: number, chunkIndex: number) => void>(() => undefined);
  const speakPageAtIndexRef = useRef<(pageIndex: number, options?: { silentEmpty?: boolean; updateNavigation?: boolean }) => Promise<void>>(
    async () => undefined,
  );

  useEffect(() => {
    rateRef.current = rate;

    try {
      window.localStorage.setItem(rateStorageKey, String(rate));
    } catch {
      // TTS preference storage is optional.
    }
  }, [rate]);

  useEffect(() => {
    autoAdvanceRef.current = autoAdvance;

    try {
      window.localStorage.setItem(autoAdvanceStorageKey, String(autoAdvance));
    } catch {
      // TTS preference storage is optional.
    }
  }, [autoAdvance]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    navigateRef.current = onNavigateToIndex;
  }, [onNavigateToIndex]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const supported = getSpeechSupport();

      setIsSupported(supported);
      logTts("support", { supported });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    function refreshVoices() {
      const nextVoices = window.speechSynthesis.getVoices();

      setVoices(nextVoices);
      logTts("voices", {
        count: nextVoices.length,
        hasKorean: nextVoices.some((voice) => voice.lang.toLowerCase().startsWith("ko")),
      });
    }

    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);

    return () => window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
  }, [isSupported]);

  useEffect(() => {
    return () => {
      sessionRef.current += 1;

      if (getSpeechSupport()) {
        window.speechSynthesis.cancel();
      }

      currentUtteranceRef.current = null;
    };
  }, []);

  const selectedVoice = useMemo(() => selectKoreanVoice(voices), [voices]);

  const fetchPageText = useCallback(async (page: EbookTtsPage) => {
    const cached = cacheRef.current.get(page.id);

    if (cached) {
      return cached;
    }

    const response = await fetch(
      `/api/public/newsletters/${encodeURIComponent(slug)}/ebook/pages/${encodeURIComponent(page.id)}/text`,
      { cache: "no-store" },
    );
    const result = (await response.json().catch(() => null)) as EbookTtsPageText | null;

    if (!response.ok || !result) {
      throw new Error("TEXT_FETCH_FAILED");
    }

    cacheRef.current.set(page.id, result);

    return result;
  }, [slug]);

  const preloadPageText = useCallback(async (pageIndex: number, options?: { silent?: boolean }) => {
    if (!enabled) {
      if (!options?.silent) {
        setCurrentPageTextState("idle");
        setMessage("읽기 텍스트가 준비되지 않았습니다.");
      }

      return null;
    }

    const page = pagesRef.current[pageIndex];

    if (!page) {
      return null;
    }

    const cached = cacheRef.current.get(page.id);

    if (cached) {
      if (!options?.silent && pageIndex === currentIndex) {
        setCurrentPageTextState(cached.hasText ? "ready" : "empty");
        setMessage(cached.hasText ? "읽을 준비가 되었습니다." : "이 페이지에는 읽을 수 있는 텍스트가 없습니다.");
      }

      return cached;
    }

    if (!options?.silent && pageIndex === currentIndex) {
      setCurrentPageTextState("loading");
      setMessage("읽기 텍스트 준비 중...");
    }

    try {
      const pageText = await fetchPageText(page);

      if (!options?.silent && pageIndex === currentIndex) {
        setCurrentPageTextState(pageText.hasText ? "ready" : "empty");
        setMessage(pageText.hasText ? "읽을 준비가 되었습니다." : "이 페이지에는 읽을 수 있는 텍스트가 없습니다.");
      }

      return pageText;
    } catch {
      if (!options?.silent && pageIndex === currentIndex) {
        setCurrentPageTextState("error");
        setMessage("읽기 텍스트를 불러오지 못했습니다.");
      }

      return null;
    }
  }, [currentIndex, enabled, fetchPageText]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void preloadPageText(currentIndex);
      void preloadPageText(currentIndex + 1, { silent: true });
      void preloadPageText(currentIndex - 1, { silent: true });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentIndex, preloadPageText]);

  const cancel = useCallback((nextMessage = "") => {
    sessionRef.current += 1;

    if (getSpeechSupport()) {
      window.speechSynthesis.cancel();
    }

    currentUtteranceRef.current = null;
    setStatus("idle");
    setMessage(nextMessage || (currentPageTextState === "ready" ? "읽을 준비가 되었습니다." : ""));
  }, [currentPageTextState]);

  const speakChunks = useCallback((pageIndex: number, chunks: string[], sessionId: number, chunkIndex: number) => {
    if (sessionRef.current !== sessionId || !getSpeechSupport()) {
      return;
    }

    const page = pagesRef.current[pageIndex];
    const chunk = chunks[chunkIndex];

    if (!page) {
      setStatus("idle");
      setMessage("마지막 페이지까지 읽었습니다.");
      return;
    }

    if (!chunk) {
      currentUtteranceRef.current = null;

      const nextIndex = pageIndex + 1;

      if (autoAdvanceRef.current && nextIndex < pagesRef.current.length) {
        void speakPageAtIndexRef.current(nextIndex, { silentEmpty: true, updateNavigation: true });
        return;
      }

      setStatus("idle");
      setMessage(nextIndex >= pagesRef.current.length ? "마지막 페이지까지 읽었습니다." : `${page.pageNumber}쪽 읽기를 마쳤습니다.`);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    const voice = selectedVoice;

    utterance.lang = voice?.lang ?? "ko-KR";
    utterance.rate = rateRef.current;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      if (sessionRef.current !== sessionId) {
        return;
      }

      logTts("utterance start", { chunkIndex, pageNumber: page.pageNumber });
      setStatus("playing");
      setMessage(`${page.pageNumber}쪽을 읽고 있습니다.`);
    };

    utterance.onend = () => {
      if (sessionRef.current !== sessionId) {
        return;
      }

      logTts("utterance end", { chunkIndex, pageNumber: page.pageNumber });
      currentUtteranceRef.current = null;
      speakChunksRef.current(pageIndex, chunks, sessionId, chunkIndex + 1);
    };

    utterance.onerror = (event) => {
      if (sessionRef.current !== sessionId || event.error === "interrupted" || event.error === "canceled") {
        return;
      }

      logTts("utterance error", { error: event.error, pageNumber: page.pageNumber });
      sessionRef.current += 1;
      currentUtteranceRef.current = null;
      setStatus("error");
      setMessage(`음성 재생 중 오류가 발생했습니다. (${event.error})`);
    };

    currentUtteranceRef.current = utterance;
    setCurrentSpeakingIndex(pageIndex);
    setStatus("playing");
    setMessage(`${page.pageNumber}쪽을 읽고 있습니다.`);
    logTts("speak start", { chunkCount: chunks.length, pageNumber: page.pageNumber, rate: rateRef.current });
    window.speechSynthesis.speak(utterance);

    void preloadPageText(pageIndex + 1, { silent: true });
  }, [preloadPageText, selectedVoice]);

  useEffect(() => {
    speakChunksRef.current = speakChunks;
  }, [speakChunks]);

  const startCachedPage = useCallback((pageIndex: number, options?: { updateNavigation?: boolean }) => {
    if (!enabled) {
      setStatus("error");
      setMessage("읽기 텍스트가 준비되지 않았습니다.");
      return false;
    }

    if (!isSupported || !getSpeechSupport()) {
      setStatus("error");
      setMessage("이 브라우저에서는 읽어주기를 지원하지 않습니다.");
      return false;
    }

    const page = pagesRef.current[pageIndex];

    if (!page) {
      setStatus("idle");
      setMessage("마지막 페이지까지 읽었습니다.");
      return false;
    }

    const pageText = cacheRef.current.get(page.id);

    if (!pageText) {
      setCurrentPageTextState("loading");
      setMessage("읽기 텍스트 준비 중...");
      void preloadPageText(pageIndex);
      return false;
    }

    const chunks = splitTextIntoSpeechChunks(pageText.text);

    if (!pageText.hasText || chunks.length === 0) {
      setStatus("idle");
      setMessage("이 페이지에는 읽을 수 있는 텍스트가 없습니다.");
      return false;
    }

    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;

    if (window.speechSynthesis.speaking || window.speechSynthesis.pending || window.speechSynthesis.paused) {
      window.speechSynthesis.cancel();
    }

    if (options?.updateNavigation) {
      navigateRef.current(pageIndex);
    }

    speakChunks(pageIndex, chunks, sessionId, 0);

    return true;
  }, [enabled, isSupported, preloadPageText, speakChunks]);

  const speakPageAtIndex = useCallback(async (pageIndex: number, options?: { silentEmpty?: boolean; updateNavigation?: boolean }) => {
    const startedFromCache = startCachedPage(pageIndex, { updateNavigation: options?.updateNavigation });

    if (startedFromCache) {
      return;
    }

    if (!options?.silentEmpty) {
      return;
    }

    const pageText = await preloadPageText(pageIndex, { silent: true });

    if (!pageText?.hasText) {
      const nextIndex = pageIndex + 1;

      if (autoAdvanceRef.current && nextIndex < pagesRef.current.length) {
        void speakPageAtIndexRef.current(nextIndex, { silentEmpty: true, updateNavigation: true });
      }

      return;
    }

    startCachedPage(pageIndex, { updateNavigation: options?.updateNavigation });
  }, [preloadPageText, startCachedPage]);

  useEffect(() => {
    speakPageAtIndexRef.current = speakPageAtIndex;
  }, [speakPageAtIndex]);

  const playCurrentPage = useCallback(() => {
    startCachedPage(currentIndex, { updateNavigation: false });
  }, [currentIndex, startCachedPage]);

  const pause = useCallback(() => {
    if (!getSpeechSupport()) {
      return;
    }

    window.speechSynthesis.pause();
    setStatus("paused");
    setMessage("일시정지됨");
  }, []);

  const resume = useCallback(() => {
    if (!getSpeechSupport()) {
      return;
    }

    window.speechSynthesis.resume();
    setStatus("playing");
    setMessage("읽는 중...");
  }, []);

  const readPreviousPage = useCallback(() => {
    void speakPageAtIndex(Math.max(0, (currentSpeakingIndex ?? currentIndex) - 1), { updateNavigation: true });
  }, [currentIndex, currentSpeakingIndex, speakPageAtIndex]);

  const readNextPage = useCallback(() => {
    void speakPageAtIndex(Math.min(pages.length - 1, (currentSpeakingIndex ?? currentIndex) + 1), { updateNavigation: true });
  }, [currentIndex, currentSpeakingIndex, pages.length, speakPageAtIndex]);

  return {
    autoAdvance,
    canPlayCurrentPage: enabled && isSupported && currentPageTextState === "ready" && status !== "loading",
    canReadNext: (currentSpeakingIndex ?? currentIndex) < pages.length - 1,
    canReadPrevious: (currentSpeakingIndex ?? currentIndex) > 0,
    cancel,
    currentPageTextState,
    currentSpeakingPage: currentSpeakingIndex === null ? pages[currentIndex] ?? null : pages[currentSpeakingIndex] ?? null,
    isSupported,
    message,
    pause,
    playCurrentPage,
    rate,
    rates: allowedRates,
    readNextPage,
    readPreviousPage,
    resume,
    setAutoAdvance,
    setRate,
    status,
  };
}
