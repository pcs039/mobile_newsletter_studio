import { createHash } from "node:crypto";
import { comicScenes as cartoonPanels, type ProposalSample } from "@/lib/hwaseong-proposal-sample";

export const actingProjectId = "4cd5297e-a0fd-434c-84d4-fa4d3baf9389";
export const actingArticleId = "723d4dff-9d15-4515-af0a-0d725eb94b5e";
export const actingTitlePrefix = "[만평 성우 시험 v1] ";
export const actingPrefix = `projects/${actingProjectId}/cartoon-acting-pilot-v1/`;
export const actingModel = "gpt-4o-mini-tts";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const uuid = (value: string) => `${value.slice(0,8)}-${value.slice(8,12)}-5${value.slice(13,16)}-a${value.slice(17,20)}-${value.slice(20,32)}`;
const baseInstructions = "한국어 지자체 모바일 소식지의 짧은 만평을 성인 여성형 성우의 자연스러운 연기로 읽습니다. 어린이용 만화처럼 과장하거나 고음으로 변조하지 마세요. 제공된 발화만 정확히 읽고 역할명, 지시문, 해설을 추가하지 마세요. 속도는 처음부터 끝까지 안정적으로 유지하고 마지막 문장을 급하게 끝내지 마세요. 배경음악과 효과음은 없습니다.";

export function cartoonActingPlans(sample: ProposalSample) {
  if (sample.article.id !== actingArticleId || sample.kind !== "cartoon" || sample.headline !== "오늘의 산책 고수는?" || sample.editorTest || sample.authorEdited) throw Error("Original cartoon membership required");
  const turns = [
    { role: "narrator", text: cartoonPanels[0].alt + ".", style: "장면을 따뜻하고 차분하게 소개합니다." },
    { role: "guardian", text: `“${cartoonPanels[0].line}”`, style: "밝고 신나지만 소리 지르지 않는 보호자의 대사입니다." },
    { role: "narrator", text: `${cartoonPanels[0].aside} ${cartoonPanels[1].aside}`, style: "따뜻한 내레이션으로 작은 반전을 자연스럽게 이어 갑니다." },
    { role: "guardian", text: `“${cartoonPanels[1].line}”`, style: "놀랐다가 머쓱해지는 보호자의 대사입니다. 과장된 비명은 내지 않습니다." },
    { role: "corgi", text: `“${cartoonPanels[2].line}”`, style: "장난스럽고 재치 있는 속마음입니다. 성인 여성형 청감을 유지하며 어린이 목소리나 동물 소리를 흉내 내지 않습니다." },
    { role: "narrator", text: cartoonPanels[2].aside, style: "친근하고 명료한 마지막 질문입니다. 여유 있게 끝까지 마무리합니다." },
  ];
  const script = turns.map(turn => turn.text).join("\n\n");
  const article=sample.article;
  const sourceHash = hash(JSON.stringify({ panels: cartoonPanels, headline: sample.headline, article: {id:article.id,title:article.title,displayTitle:article.displayTitle,summary:article.summary,body:article.body,blocks:article.blocks.map(block=>({id:block.id,type:block.type,title:block.title,body:block.body,isVisible:block.isVisible,metadata:block.metadata}))} }));
  return (["A", "B"] as const).map(variant => {
    const inputs = variant === "A" ? [{ text: script, voice: "coral" as const, instructions: `${baseInstructions} 한 명의 성우가 전체 이야기를 읽습니다. 설명문은 따뜻하고 차분하게, 첫 번째 보호자 대사는 밝고 신나게, 두 번째 보호자 대사는 놀라고 머쓱하게, 강아지의 속마음 대사는 장난스럽고 재치 있게 구분합니다. 마지막 질문은 친근하고 명료하게 마무리합니다. 전체는 약 20~30초의 자연스러운 호흡을 목표로 합니다.` }]
      : turns.map(turn => ({ text: turn.text, voice: turn.role === "guardian" ? "marin" as const : "coral" as const, instructions: `${baseInstructions} ${turn.style}` }));
    const configHash = hash(JSON.stringify({ recipe: "cartoon-acting-pilot-v1", variant, sourceHash, script, inputs, model: actingModel, speed: 1 }));
    const id = uuid(configHash);
    return { variant, id, hash: configHash, sourceHash, script, scriptHash: hash(script), model: actingModel, label: variant === "A" ? "A안 — Coral 1인 성우형" : "B안 — 다중 성우형", voiceLabel: variant === "A" ? "Coral" : "내레이터 Coral · 보호자 Marin · 속마음 Coral", path: `${actingPrefix}${id}/final.mp3`,
      parts: inputs.map((input,index) => { const digest = hash(`${configHash}:part:${index}`), partId = uuid(digest); return { ...input, index, id: partId, hash: digest, path: `${actingPrefix}${id}/part-${index}.mp3` }; }),
    };
  });
}
export type CartoonActingPlan = ReturnType<typeof cartoonActingPlans>[number];
