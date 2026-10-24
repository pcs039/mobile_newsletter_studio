import type { ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { getInterestOrderedArticles } from "@/lib/article-interest-order";

export const sampleInterests = [
  { value: "all", label: "전체 보기" },
  { value: "civic", label: "생활·행정" },
  { value: "culture", label: "관광·문화" },
  { value: "pets", label: "반려생활" },
] as const;
export type SampleInterest = typeof sampleInterests[number]["value"];
type Topic = Exclude<SampleInterest, "all">;
export type SampleOrderRule = { topics: readonly Topic[]; mandatoryPriority: number };

// Explicit, presentation-only fixture rules. No DB tags, sort_order or dates are changed.
// All seven are ordinary editorial samples, not mandatory notices.
export const sampleOrderRules: Readonly<Record<string, SampleOrderRule>> = {
  "b48352e0-dbbe-4cca-bbcc-f88988b27d32": { topics: ["civic"], mandatoryPriority: 0 },
  "336fcac1-c773-4f72-a4b8-c07d06b032e7": { topics: ["culture"], mandatoryPriority: 0 },
  "2d080a0e-42c6-499d-9611-16bbc675495e": { topics: ["culture"], mandatoryPriority: 0 },
  "723d4dff-9d15-4515-af0a-0d725eb94b5e": { topics: ["pets"], mandatoryPriority: 0 },
  "5f6d8133-9da3-42c8-ab3c-c981e25cc585": { topics: ["civic", "pets"], mandatoryPriority: 0 },
  "a802c522-becf-496e-b78f-e374e4b7e98d": { topics: ["culture"], mandatoryPriority: 0 },
  "50bf808f-15b5-4484-8fee-38f7a8acb99d": { topics: ["culture"], mandatoryPriority: 0 },
};

export function normalizeSampleInterest(value: unknown): SampleInterest {
  return sampleInterests.find(option => option.value === value)?.value ?? "all";
}

export function orderProposalSamples<T extends Pick<ProposalSample, "article">>(
  samples: readonly T[], interest: SampleInterest,
  rules: Readonly<Record<string, SampleOrderRule>> = sampleOrderRules,
): T[] {
  // Reuse the existing stable tag matching with neutral presentation-only priority.
  // Do not carry stored urgency, validity windows or other ranking metadata into this PoC.
  const matched = getInterestOrderedArticles(samples.map(sample => ({
    id: sample.article.id, sample,
    interestTags: [...(rules[sample.article.id]?.topics ?? [])],
    institutionPriority: 3,
    mandatoryPriority: rules[sample.article.id]?.mandatoryPriority ?? 0,
  })), interest === "all" ? [] : [interest]);
  // Mandatory ordering remains independent of interest, including the all view.
  // No current fixture is mandatory; retain every article and the stable matched order.
  return matched.map((item, rank) => ({ item, rank })).sort((a, b) =>
    b.item.mandatoryPriority - a.item.mandatoryPriority || a.rank - b.rank,
  ).map(({ item }) => item.sample);
}
