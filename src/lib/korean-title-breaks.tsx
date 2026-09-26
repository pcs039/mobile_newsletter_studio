import { Fragment, type ReactNode } from "react";

type TitleLike = {
  displayTitle?: string | null;
  title?: string | null;
};

export type KoreanTitleToken =
  | {
      kind: "space";
      value: string;
    }
  | {
      kind: "text";
      segments: string[];
      value: string;
    };

const longTokenMinimumLength = 8;
const hangulOrNumberPattern = /[0-9가-힣]/;
const phraseBreakAfter = [
  "지방자치",
  "인구활력",
  "첨단산업",
  "기반",
  "지역",
  "유관기관",
  "아동학대",
  "청년",
  "일자리",
  "관광",
  "활성화",
  "문화제",
  "축제",
  "행사",
  "초의선사",
];
const phraseBreakBefore = [
  "경영대상",
  "특별상",
  "최우수상",
  "우수상",
  "미래도시",
  "공동대응",
  "지원사업",
  "프로젝트",
  "예방",
  "기념",
  "성료",
  "개최",
  "추진",
  "수상",
  "탄생",
];

function normalizeDisplayValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function countVisibleCharacters(value: string) {
  return Array.from(value.replace(/\s/g, "")).length;
}

function getSortedBreakIndexes(indexes: Set<number>, value: string) {
  return [...indexes].filter((index) => index > 0 && index < value.length).sort((a, b) => a - b);
}

function addPhraseBreaks(value: string, indexes: Set<number>) {
  phraseBreakAfter.forEach((phrase) => {
    let start = value.indexOf(phrase);

    while (start >= 0) {
      indexes.add(start + phrase.length);
      start = value.indexOf(phrase, start + phrase.length);
    }
  });

  phraseBreakBefore.forEach((phrase) => {
    let start = value.indexOf(phrase);

    while (start >= 0) {
      indexes.add(start);
      start = value.indexOf(phrase, start + phrase.length);
    }
  });

  Array.from(value.matchAll(/\d+(?:회|년|주년|월|일)/g)).forEach((match) => {
    if (typeof match.index === "number") {
      indexes.add(match.index + match[0].length);
    }
  });
}

export function getDisplayArticleTitle(article: TitleLike, fallback = "기사") {
  return normalizeDisplayValue(article.title) || fallback;
}

export function getKoreanTitleBreakSegments(value: string) {
  const indexes = new Set<number>();

  addPhraseBreaks(value, indexes);

  if (countVisibleCharacters(value) >= 12 && indexes.size === 0) {
    const characters = Array.from(value);
    let visibleCount = 0;

    characters.forEach((character, characterIndex) => {
      if (/\s/.test(character)) {
        return;
      }

      visibleCount += 1;

      if (visibleCount > 0 && visibleCount % 6 === 0) {
        indexes.add(characters.slice(0, characterIndex + 1).join("").length);
      }
    });
  }

  const sortedIndexes = getSortedBreakIndexes(indexes, value);

  if (sortedIndexes.length === 0) {
    return [value];
  }

  const segments: string[] = [];
  let cursor = 0;

  sortedIndexes.forEach((index) => {
    const segment = value.slice(cursor, index);

    if (segment) {
      segments.push(segment);
    }

    cursor = index;
  });

  const lastSegment = value.slice(cursor);

  if (lastSegment) {
    segments.push(lastSegment);
  }

  return segments.length > 0 ? segments : [value];
}

export function tokenizeKoreanTitleForBreaks(value: string): KoreanTitleToken[] {
  return value.split(/(\s+)/).filter((token) => token.length > 0).map((token) => {
    if (/^\s+$/.test(token)) {
      return {
        kind: "space",
        value: token,
      };
    }

    return {
      kind: "text",
      segments: getKoreanTitleBreakSegments(token),
      value: token,
    };
  });
}

export function detectLongKoreanTitleTokens(value: string) {
  const tokens = value
    .split(/(\s+)/)
    .filter((token) => token.trim() && hangulOrNumberPattern.test(token))
    .map((token) => token.trim());
  const riskyTokens = tokens.filter((token) => countVisibleCharacters(token) >= longTokenMinimumLength);

  return [...new Set(riskyTokens)];
}

export function renderKoreanTitleWithBreaks(value: string): ReactNode {
  return tokenizeKoreanTitleForBreaks(value).map((token, tokenIndex) => {
    if (token.kind === "space") {
      return token.value;
    }

    return (
      <Fragment key={`${token.value}-${tokenIndex}`}>
        {token.segments.map((segment, segmentIndex) => (
          <Fragment key={`${segment}-${segmentIndex}`}>
            {segment}
            {segmentIndex < token.segments.length - 1 ? <wbr /> : null}
          </Fragment>
        ))}
      </Fragment>
    );
  });
}
