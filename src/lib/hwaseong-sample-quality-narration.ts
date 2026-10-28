import { createHash } from "node:crypto";
import { splitArticleVoice, splitNarration, splitTtsModel, type NarrationPart } from "@/lib/hwaseong-sample-split-narration";
import type { ProposalSample } from "@/lib/hwaseong-proposal-sample";

export const qualityProjectId = "4cd5297e-a0fd-434c-84d4-fa4d3baf9389";
export const qualityPrefix = `projects/${qualityProjectId}/sample-tts-quality-v3/`;
export const qualityTitlePrefix = "[시연 TTS v3] ";
export const qualityInstructions = "공공기관 모바일 소식지를 차분하고 또렷하게 읽어 주세요. 방송 뉴스 해설자처럼 자연스럽고 안정적인 호흡을 유지합니다. 처음부터 끝까지 일정한 낭독 템포를 유지하고, 특히 후반부로 갈수록 속도를 높이거나 급하게 마무리하지 마세요. 과도한 감정 변화와 연기는 피하고 문장과 문단 사이의 자연스러운 호흡을 유지합니다. 원문 내용을 추가하거나 생략하지 마세요. 영어 문장은 자연스럽고 명료하게 읽어 주세요.";
export const qualityRecipe = "title-body-pcm24k-gap1000ms-v1";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const space = (s: string) => s.replace(/\s+/g, " ").trim();

// Only a standalone heading line with an explicit heading separator is numbered.
// Dates, phone numbers, addresses, URLs, and ordinary numeric prose are untouched.
export function qualityReadingText(text: string) {
  const names = ["", "일", "이", "삼", "사", "오", "육"];
  return text.split(/\r?\n/).map(line => line.replace(/^\s*0([1-6])\s*(?:[·/]\s*|[.)]\s+)(?=\S)/, (_m, n) => `${names[Number(n)]}. `)).join("\n").trim();
}
export function qualityChunks(text: string, limit = 400) {
  const result: string[] = [];
  let current = "";
  // Preserve paragraph/sentence boundaries; never cut mid-sentence to meet a limit.
  for (const paragraph of text.split(/\n\s*\n/).filter(s => s.trim())) {
    const sentences = paragraph.split(/(?<=[.!?。！？])\s+/u);
    for (const sentence of sentences) {
      const s = space(sentence);
      if (!s) continue;
      if (s.length > limit) throw Error("A narration sentence needs manual chunk review");
      if (current && current.length + s.length + 1 > limit) { result.push(current); current = ""; }
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current) result.push(current);
  if (!result.length || space(result.join(" ")) !== space(text)) throw Error("Narration chunk coverage mismatch");
  return result;
}
export function qualityPlan(sample: ProposalSample, part: NarrationPart) {
  if (sample.editorTest) throw Error("Editor test copies are excluded");
  const voice = splitArticleVoice(sample.article.id);
  if (!voice) throw Error("Unknown article membership");
  const title = space(sample.headline);
  let body = splitNarration(sample, part).trim();
  if (part === "summary") {
    // splitNarration deliberately includes the heading in summaries, not details.
    if (!body.startsWith(title)) throw Error("Summary title boundary mismatch");
    body = body.slice(title.length).trim();
  } else if (body.startsWith(title + "\n\n")) body = body.slice(title.length).trim();
  body = qualityReadingText(body);
  if (!title || !body || body.length > 8000) throw Error("Narration bounds");
  const text = `${title}\n\n${body}`;
  const digest = hash(JSON.stringify({ recipe: qualityRecipe, job: `${sample.article.id}:${part}`, title, body, voice, model: splitTtsModel, speed: 1, instructions: qualityInstructions }));
  const id = `${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;
  const chunks = qualityChunks(body);
  return { job: `${sample.article.id}:${part}`, articleId: sample.article.id, part, title, body, text, voice, model: splitTtsModel, id, hash: digest, scriptHash: hash(text), chunks,
    path: `${qualityPrefix}${id}/final.mp3`, titlePath: `${qualityPrefix}${id}/title.mp3`, bodyPaths: chunks.map((_, i) => `${qualityPrefix}${id}/body-${i}.mp3`), calls: chunks.length + (part === "summary" ? 1 : 0) };
}
export type QualityResume = {
  parentId: string; parentFinalPath: string; missingPath: string; requestKey: string;
  reusedPath: string; reusedHash: string; reusedSize: number;
  priorClientRequestId: string; priorProviderRequestId: string; priorHttpStatus: number;
  priorPhase: "body"; priorFailure: "timeout"; approval: string;
  reusedIndex?: number;
};
export type QualityPlan = ReturnType<typeof qualityPlan> & { resume?: QualityResume };

// Only the two explicitly reviewed, expired requests. Other pending rows still block.
// Its original row/paths/receipt remain immutable; the replacement has its own ID.
export function scopedQualityPlan(plan: QualityPlan): QualityPlan {
  if (plan.id === "7610ae2d-5229-5311-a4ea-b1262033a209") {
    const requestKey = "hwaseong-v3-06-summary-body0-20261028";
    const digest = hash(`${plan.id}:${requestKey}`);
    const id = `${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;
    return { ...plan, id, path: `${qualityPrefix}${id}/final.mp3`,
      bodyPaths: [`${qualityPrefix}${id}/body-0.mp3`], calls: 1,
      resume: { parentId: plan.id, parentFinalPath: plan.path, missingPath: plan.bodyPaths[0], requestKey,
        reusedPath: plan.titlePath, reusedHash: "f37c35aa232ff2f6ab9bf1600c9d098b18b63fdd64fdcce5b8d86709e657105b", reusedSize: 64896, reusedIndex: -1,
        priorClientRequestId: "145c1c46-5d24-429f-a045-b0e946351b2b", priorProviderRequestId: "req_9d91c07a99234d46bfd6b4b0dc6a1fe7", priorHttpStatus: 200, priorPhase: "body", priorFailure: "timeout", approval: "user-2026-10-28-v3-timeout-diagnosis-completion" } };
  }
  if (plan.id !== "ecd92636-c585-5d7c-a7b2-0570eea67b96") return plan;
  const requestKey = "hwaseong-v3-04-detail-body1-20261028";
  const digest = hash(`${plan.id}:${requestKey}`);
  const id = `${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;
  return { ...plan, id, path: `${qualityPrefix}${id}/final.mp3`,
    bodyPaths: [plan.bodyPaths[0], `${qualityPrefix}${id}/body-1.mp3`], calls: 1,
    resume: { parentId: plan.id, parentFinalPath: plan.path, missingPath: plan.bodyPaths[1], requestKey,
      reusedPath: plan.bodyPaths[0], reusedHash: "16e5f94f160ec676a7f243711e1b5708e73259251217c5e80e005c5a6159b563", reusedSize: 866688,
      priorClientRequestId: "8b4f0dd1-64ed-4fc1-b906-8f0fbe2ce2d2", priorProviderRequestId: "req_2077026194c648a4a26f3361951639dc", priorHttpStatus: 200, priorPhase: "body", priorFailure: "timeout", approval: "user-2026-10-28-v3-completion" } };
}
