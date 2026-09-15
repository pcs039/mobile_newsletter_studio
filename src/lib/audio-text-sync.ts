import type { ProjectContentArticle, ProjectContentBlock } from "@/lib/newsletter-repository";

export type AudioTextSegment = {
  endTime: number;
  id: string;
  startTime: number;
  text: string;
  weight: number;
};

export type AudioTextSegmentCandidate = Omit<AudioTextSegment, "startTime" | "endTime">;

const minimumCandidateTextLength = 6;
const minimumSegmentSeconds = 1.2;

function normalizeSegmentText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getTextWeight(value: string) {
  const normalized = normalizeSegmentText(value);

  return Math.max(8, normalized.replace(/\s/g, "").length);
}

function restoreProtectedText(value: string, protectedValues: Map<string, string>) {
  let restored = value;

  protectedValues.forEach((protectedValue, token) => {
    restored = restored.replaceAll(token, protectedValue);
  });

  return restored.trim();
}

function protectArticleText(value: string, protectedValues: Map<string, string>) {
  return value.replace(/https?:\/\/[^\s]+|[^\s@]+@[^\s@]+\.[^\s@]+/g, (protectedValue) => {
    const token = `__PUBLIC_ARTICLE_PROTECTED_${protectedValues.size}__`;

    protectedValues.set(token, protectedValue);
    return token;
  });
}

function getPreviousNonSpaceCharacter(value: string, index: number) {
  for (let position = index - 1; position >= 0; position -= 1) {
    const character = value[position];

    if (character && !/\s/.test(character)) {
      return character;
    }
  }

  return "";
}

function isSentenceDelimiter(value: string, index: number) {
  const character = value[index];

  if (!character) {
    return false;
  }

  if ("!?。？！".includes(character)) {
    return true;
  }

  if (character !== ".") {
    return false;
  }

  return !/\d/.test(getPreviousNonSpaceCharacter(value, index));
}

function splitArticleLineIntoSentences(value: string) {
  const sentences: string[] = [];
  let sentenceStart = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (!isSentenceDelimiter(value, index)) {
      continue;
    }

    let sentenceEnd = index + 1;

    while (sentenceEnd < value.length && /["'”’)]/.test(value[sentenceEnd] ?? "")) {
      sentenceEnd += 1;
    }

    const sentence = value.slice(sentenceStart, sentenceEnd).trim();

    if (sentence) {
      sentences.push(sentence);
    }

    sentenceStart = sentenceEnd;
  }

  const remainder = value.slice(sentenceStart).trim();

  if (remainder) {
    sentences.push(remainder);
  }

  return sentences;
}

export function getArticleBodyParagraphs(value: string) {
  const protectedValues = new Map<string, string>();
  const protectedText = protectArticleText(value.trim(), protectedValues);

  return protectedText
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split(/\n+/)
        .flatMap(splitArticleLineIntoSentences)
        .map((sentence) => restoreProtectedText(sentence, protectedValues))
        .filter(Boolean),
    )
    .filter((paragraph) => paragraph.length > 0);
}

export function makeArticleTitleSegmentId(articleId: string) {
  return `article-${articleId}-title`;
}

export function makeArticleSummarySegmentId(articleId: string) {
  return `article-${articleId}-summary`;
}

export function makeArticleBodySegmentId(baseId: string, paragraphIndex: number, sentenceIndex: number) {
  return `${baseId}-p${paragraphIndex}-s${sentenceIndex}`;
}

function pushCandidate(candidates: AudioTextSegmentCandidate[], id: string, text: string) {
  const normalizedText = normalizeSegmentText(text);

  if (normalizedText.length < minimumCandidateTextLength) {
    return;
  }

  candidates.push({
    id,
    text: normalizedText,
    weight: getTextWeight(normalizedText),
  });
}

function getVisibleTextBlocks(article: ProjectContentArticle) {
  return article.blocks
    .filter((block) => block.isVisible && block.body && block.type === "paragraph")
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function pushBodyCandidates(candidates: AudioTextSegmentCandidate[], baseId: string, body: string) {
  getArticleBodyParagraphs(body).forEach((paragraph, paragraphIndex) => {
    paragraph.forEach((sentence, sentenceIndex) => {
      pushCandidate(candidates, makeArticleBodySegmentId(baseId, paragraphIndex, sentenceIndex), sentence);
    });
  });
}

export function buildAudioTextSegmentCandidates(articles: ProjectContentArticle[]) {
  const candidates: AudioTextSegmentCandidate[] = [];

  articles.forEach((article) => {
    pushCandidate(candidates, makeArticleTitleSegmentId(article.id), article.title);
    pushCandidate(candidates, makeArticleSummarySegmentId(article.id), article.summary);

    const textBlocks = getVisibleTextBlocks(article);

    if (textBlocks.length > 0) {
      textBlocks.forEach((block: ProjectContentBlock) => {
        pushBodyCandidates(candidates, `article-${article.id}-block-${block.id}`, block.body);
      });
      return;
    }

    pushBodyCandidates(candidates, `article-${article.id}-body`, article.body);
  });

  return candidates;
}

function getSegmentDurations(candidates: AudioTextSegmentCandidate[], duration: number) {
  const totalWeight = candidates.reduce((total, candidate) => total + candidate.weight, 0);
  const proportionalDurations = candidates.map((candidate) => (candidate.weight / totalWeight) * duration);

  if (duration < candidates.length * minimumSegmentSeconds) {
    return proportionalDurations;
  }

  const durations = proportionalDurations.map((segmentDuration) => Math.max(segmentDuration, minimumSegmentSeconds));
  let overflow = durations.reduce((total, segmentDuration) => total + segmentDuration, 0) - duration;

  while (overflow > 0.001) {
    const reducibleIndexes = durations
      .map((segmentDuration, index) => ({ index, reducible: segmentDuration - minimumSegmentSeconds }))
      .filter((item) => item.reducible > 0);
    const totalReducible = reducibleIndexes.reduce((total, item) => total + item.reducible, 0);

    if (totalReducible <= 0) {
      break;
    }

    reducibleIndexes.forEach((item) => {
      const reduction = Math.min(item.reducible, overflow * (item.reducible / totalReducible));

      durations[item.index] -= reduction;
    });

    overflow = durations.reduce((total, segmentDuration) => total + segmentDuration, 0) - duration;
  }

  return durations;
}

export function buildTimedAudioTextSegments(candidates: AudioTextSegmentCandidate[], duration: number) {
  if (duration <= 0 || candidates.length === 0) {
    return [];
  }

  const durations = getSegmentDurations(candidates, duration);
  let cursor = 0;

  return candidates.map((candidate, index) => {
    const startTime = cursor;
    const endTime = index === candidates.length - 1 ? duration : Math.min(duration, startTime + durations[index]);

    cursor = endTime;

    return {
      ...candidate,
      startTime,
      endTime,
    };
  });
}

export function getActiveAudioTextSegmentId(segments: AudioTextSegment[], currentTime: number) {
  return (
    segments.find((segment) => currentTime >= segment.startTime && currentTime < segment.endTime)?.id ??
    segments.at(-1)?.id ??
    ""
  );
}
