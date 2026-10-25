import { accessibleSampleEnglish, comicScenes, editorialFeature, tourismFeature, tourismPlaces, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { sampleOrderRules } from "@/lib/hwaseong-sample-interest";
import type { ArticleTtsVoice } from "@/lib/article-tts-audio";

export const sampleTtsModel = "gpt-4o-mini-tts";
export const sampleVoiceProbe = "화성의 오늘을 더 가까이. 생활과 관광, 문화와 사람을 잇는 모바일 소식지입니다. 글자를 키우고, 편안한 속도로 소식을 들어 보세요.";
const voices: ArticleTtsVoice[] = ["marin", "cedar", "onyx", "coral"];
// Stable fixture identity, never the current interest/search display order.
export function sampleArticleVoice(id: string): ArticleTtsVoice | null {
  const n = Object.keys(sampleOrderRules).indexOf(id);
  return n < 0 ? null : voices[n % voices.length];
}
export function sampleSummaryFacts(kind: string): string[][] {
  return kind === "policy" ? [
    ["01 · 따로 모으기", "폐건전지와 종이팩을 일반쓰레기·일반 종이와 구분해 모아요."],
    ["02 · 깨끗이 준비", "우유팩은 비우고, 씻고, 말린 뒤 펼쳐 주세요."],
    ["03 · 가까운 센터에서 교환", "읍·면·동 행정복지센터에서 교환하세요. 수량·이용 기준은 상세 원문을 확인하세요."],
  ] : kind === "event" ? [
    ["빛과 음악 · 루나빛축제", "동탄호수공원에서 만나는 가을밤의 풍경"],
    ["전통문화 · 안곡서원 문화제", "지역의 문화를 가까이에서 체험하는 시간"],
    ["공연 · 노작홍사용창작연극제", "지역 예술인들의 이야기가 무대가 되는 순간"],
  ] : kind === "accessible" ? [
    ["체격에 맞는 공간", "반려견의 크기에 따라 나뉜 공간을 이용해요."],
    ["동물등록 · 보호자 동반", "동물등록을 마친 반려견과 만 13세 이상 보호자가 함께 무료로 이용해요."],
    ["뒷정리와 서로 배려", "배변을 치우고 다른 이용객과 반려견을 배려해요."],
  ] : [];
}
export function sampleNarration(sample: ProposalSample) {
  const e = editorialFeature(sample), t = tourismFeature(sample);
  const parts = [sample.headline.replaceAll("\n", " "), sample.summary];
  if (e) parts.push(e.person, e.role, e.quote, e.note, ...e.sections.flatMap(s => [s.title, s.text]));
  else if (t) parts.push(t.title, ...t.paragraphs, ...tourismPlaces.flatMap(p => [p.name, p.description, p.address]));
  else {
    parts.push(...sampleSummaryFacts(sample.kind).flat());
    if (sample.kind === "accessible") parts.push(...accessibleSampleEnglish);
    if (sample.kind === "cartoon") parts.push(...comicScenes.flatMap(s => [s.speaker, s.line, s.aside]));
    // Actual stored, visible prose; fixture illustrations are not narration text.
    const paragraphs = sample.article.blocks.filter(b => b.isVisible && b.type === "paragraph" && !b.metadata.proposal_sample);
    parts.push(...(paragraphs.length ? paragraphs.map(b => b.body) : [sample.article.body]));
  }
  return parts.filter(Boolean).join("\n\n").trim();
}
export type SampleAudio = { id: string; voice: ArticleTtsVoice; manifestHref: string; transcriptText: string };
