import type { ProjectContentArticle } from "@/lib/newsletter-repository";

export const hwaseongSampleSlug = "hwaseong-2026-10-samples";
export const tourismSource = "https://www.hscity.go.kr/www/intro/trstMap.jsp";
export type ProposalSample = { article: ProjectContentArticle; cover: string; kind: string; eyebrow: string; headline: string; summary: string; color: string; pale: string; sourceTitle: string; artDirectionVersion: number };

// This is deliberately a Staging fixture presentation, not a new publication mode.
export function proposalSample(article: ProjectContentArticle, projectId: string): ProposalSample | null {
  const cover = article.blocks.find(b => b.type === "image" && b.metadata.proposal_sample);
  const m = cover?.metadata.proposal_sample;
  if (!cover || !m || typeof m !== "object" || Array.isArray(m)) return null;
  const v = m as Record<string, unknown>;
  if (v.version !== 1 || !["policy", "tourism", "event", "cartoon", "accessible"].includes(String(v.kind)) ||
      !["eyebrow", "headline", "summary", "sourceTitle"].every(k => typeof v[k] === "string" && String(v[k]).length < 500) ||
      !/^#[0-9a-f]{6}$/i.test(String(v.color)) || !/^#[0-9a-f]{6}$/i.test(String(v.pale)) ||
      !cover.body.startsWith("/api/project-files/preview?")) return null;
  // Never carry an arbitrary external file URL into this authenticated presentation.
  const url = new URL(cover.body, "https://sample.invalid");
  if (url.searchParams.get("bucket") !== "design-production-assets" || !url.searchParams.get("path")?.startsWith(`projects/${projectId}/`)) return null;
  return { article, cover: cover.body, kind: String(v.kind), eyebrow: String(v.eyebrow), headline: String(v.headline), summary: String(v.summary), color: String(v.color), pale: String(v.pale), sourceTitle: String(v.sourceTitle), artDirectionVersion: v.artDirectionVersion === 3 ? 3 : 2 };
}

// A separate, attributed feature block never replaces the archived original body.
export function tourismFeature(sample: ProposalSample) {
  if (sample.kind !== "tourism") return null;
  const block = sample.article.blocks.find(b => b.type === "paragraph" && b.isVisible && b.metadata.proposal_tourism_feature === 1);
  if (!block || block.metadata.source !== tourismSource || !block.title.trim() || block.title.length > 120 || !block.body.trim() || block.body.length > 6000) return null;
  return { title: block.title, paragraphs: block.body.split(/\n\s*\n/).filter(Boolean) };
}

// These two retained recordings describe the first sample, not the current feature/comic.
// Hide their players without changing or deleting the stored audio or article.
export function samplePresentationArticle(sample: ProposalSample): ProjectContentArticle {
  return sample.kind === "tourism" || sample.kind === "cartoon"
    ? { ...sample.article, audioSource: "none", audioFile: null }
    : sample.article;
}

export const comicScenes = [
  { speaker: "보호자", line: "오늘은 마음껏 뛰어!", aside: "달릴 준비는 완벽했는데…", alt: "가을 놀이터를 달리는 보호자와 신이 난 코기" },
  { speaker: "보호자", line: "어? 중요한 걸 깜빡했네…", aside: "빈 주머니를 확인하는 순간, 강아지가 멈춰 섭니다.", alt: "빈 주머니를 확인하며 놀란 보호자와 기다리라는 듯 앞발을 든 코기" },
  { speaker: "강아지의 속마음", line: "달리기는 내가, 뒷정리는 보호자가!", aside: "오늘의 산책 고수는 누굴까요?", alt: "배변 봉투를 물어 건네는 코기와 머쓱하게 웃는 보호자" },
] as const;

// Polygons are from the already acquired official 1024 × 700 imagemap.
// Short descriptions are paraphrases; addresses/phones retain the official source.
export const tourismPlaces = [
  { id: "01", name: "전곡항 마리나", points: "93,173 104,240 178,245 212,209 194,171", description: "요트와 서해 풍경을 만나는 항구입니다.", address: "화성시 서신면 전곡항로 5", phone: "031-366-7623" },
  { id: "02", name: "서해랑 케이블카", points: "213,222 226,233 238,248 249,298 187,326 143,300", description: "전곡항과 제부도를 잇는 해상 케이블카입니다.", address: "화성시 서신면 전곡항로 1-10", phone: "1833-4997" },
  { id: "03", name: "제부도", points: "35,285 126,290 166,337 142,398 110,471 97,505 87,520 54,519 38,504 13,376", description: "바닷길과 해안 풍경을 즐길 수 있는 섬입니다. 통행 가능 시간은 방문 전에 확인하세요.", address: "화성시 서신면 제부로 224", phone: "031-355-3924" },
  { id: "11", name: "융건릉", points: "578,65 704,57 724,106 676,155 605,159 552,167 548,128", description: "사도세자와 정조의 역사에 닿는 왕릉입니다.", address: "화성시 효행로481번길 21", phone: "031-222-0142" },
  { id: "15", name: "동탄호수공원", points: "885,283 967,283 998,319 991,373 960,434 902,435 875,390 855,324", description: "호수를 따라 걸으며 도심 속 여유를 느끼는 공원입니다.", address: "화성시 동탄순환대로 69", phone: "" },
  { id: "20", name: "우리꽃식물원", points: "598,456 676,457 701,504 694,545 603,548 569,546 566,503", description: "우리 식물과 정원을 둘러보는 나들이 공간입니다.", address: "화성시 팔탄면 3.1만세로 777-17", phone: "031-5189-6160" },
] as const;

export function sampleHref(slug: string, articleId?: string, detail = false, width = 390) {
  return `/projects/${encodeURIComponent(slug)}/samples?${new URLSearchParams({ ...(articleId ? { articleId } : {}), ...(detail ? { view: "detail" } : {}), width: String(width === 520 ? 520 : 390) })}`;
}
