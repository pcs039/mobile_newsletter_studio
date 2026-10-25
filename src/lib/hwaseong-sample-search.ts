import { accessibleSampleEnglish, comicScenes, editorialFeature, tourismPlaces, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { articleSearchMatches, buildArticleSearchSnippet, getPlainArticleSearchText } from "@/lib/mobile-article-search";

// Editorial topic labels/aliases for these fixtures, not inferred reader preferences.
const topics: Readonly<Record<string, string>> = {
  policy: "생활 행정 자원순환 재활용 recycling",
  tourism: "관광 여행 관광지도 tourism travel",
  event: "관광 문화 문화행사 축제 culture festival",
  cartoon: "반려생활 반려견 펫티켓 dog pet",
  accessible: "생활 행정 반려생활 반려견 접근성 한국어 영어 dog pet accessibility English",
  interview: "관광 문화 예술 인물 인터뷰 culture artist interview",
  video: "관광 문화 영상 유튜브 culture video YouTube",
};

type SampleSearchText = { text: string; previewText: string };

export function buildProposalSearchIndex(samples: readonly ProposalSample[]) {
  return new Map(samples.map((sample, index) => {
    const editorial = editorialFeature(sample);
    const previewText = [sample.headline, sample.summary, getPlainArticleSearchText(sample.article, index), sample.article.body, sample.eyebrow,
      ...sample.article.blocks.filter(b => b.isVisible && b.type === "paragraph").map(b => b.title),
      ...(sample.kind === "accessible" ? accessibleSampleEnglish : []),
      ...(sample.kind === "cartoon" && sample.artDirectionVersion === 3 ? comicScenes.flatMap(s => [s.line, s.aside]) : []),
      ...(sample.kind === "tourism" ? tourismPlaces.flatMap(p => [p.name, p.description, p.address]) : []),
      ...(editorial ? [editorial.person, editorial.role, editorial.quote, ...editorial.sections.flatMap(s => [s.title, s.text])] : []),
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    return [sample.article.id, { text: `${previewText} ${topics[sample.kind] ?? ""}`, previewText }] as const;
  }));
}

export function searchProposalSamples(samples: readonly ProposalSample[], index: ReadonlyMap<string, SampleSearchText>, query: string) {
  return samples.flatMap(sample => {
    const entry = index.get(sample.article.id);
    return entry && articleSearchMatches(entry.text, query)
      ? [{ sample, snippet: buildArticleSearchSnippet(entry.previewText, query.trim()) }] : [];
  });
}
