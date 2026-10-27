import { accessibleSampleEnglish, comicScenes, editorialFeature, tourismFeature, tourismPlaces, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { sampleOrderRules } from "@/lib/hwaseong-sample-interest";
import { sampleSummaryFacts, sampleVoiceProbe } from "@/lib/hwaseong-sample-narration";
import type { ArticleTtsVoice } from "@/lib/article-tts-audio";

// Provider dependency is isolated; a model change also changes immutable job identity.
export const splitTtsModel = "gpt-4o-mini-tts";
export const splitTtsShutdown = "2027-01-06";
export type NarrationPart = "summary" | "detail";
export const splitProbeText = sampleVoiceProbe;
const voices: ArticleTtsVoice[] = ["marin", "cedar", "coral", "coral", "marin", "coral", "coral"];
export function splitArticleVoice(id: string) { return voices[Object.keys(sampleOrderRules).indexOf(id)] ?? null; }
export function splitNarration(sample: ProposalSample, part: NarrationPart) {
  const e = editorialFeature(sample), t = tourismFeature(sample);
  if (part === "summary") {
    const parts = [sample.headline.replaceAll("\n", " ")];
    if (e) parts.push(sample.summary, ...(!e.videoId ? [e.person, e.role, e.quote] : []));
    else if (t) parts.push("바다 · 역사 · 초록", "그림 속 번호로 떠나는 여행", ...tourismPlaces.map(p => p.name));
    else if (sample.kind === "cartoon") parts.push("즐거운 놀이터의 마지막 한 걸음, 뒷정리와 배려입니다.");
    else {
      if (sample.kind === "accessible") parts.push("A better day out, together.");
      sampleSummaryFacts(sample.kind).forEach(([heading, body], i) => parts.push(heading, body, ...(sample.kind === "accessible" ? [accessibleSampleEnglish[i]] : [])));
    }
    return parts.filter(Boolean).join("\n\n");
  }
  if (e) return e.sections.flatMap(s => [s.title, s.text.replace("재생 버튼 또는 아래 유튜브 링크로 원본을 확인할 수 있습니다.", "")]).join("\n\n");
  if (t) return [...t.paragraphs, ...tourismPlaces.flatMap(p => [p.name, p.description, p.address])].join("\n\n");
  const prose = sample.article.blocks.filter(b => b.isVisible && b.type === "paragraph" && !b.metadata.proposal_sample
    && !["자료 구분과 확인 안내", "원문·사실 확인 안내", "원문 정합성 안내"].includes(b.title.trim())
    && !/^(위 원문은 기존|기존 화성시 2026년 10월호 작업본의 확인 근거)/.test(b.body.trim())).map(b => b.body);
  const scenes = sample.kind === "cartoon" ? comicScenes.flatMap((s, i) => [`${i + 1}컷`, s.alt, `${s.speaker}: ${s.line}`, s.aside]) : [];
  return [...scenes, ...prose].filter(Boolean).join("\n\n")
    .replace("This is a demonstration translation, not an official English notice.", "").trim();
}
