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

export const actingRevisionTitlePrefix = "[만평 성우 시험 v2] ";
export const actingRevisionPrefix = `projects/${actingProjectId}/cartoon-acting-pilot-v2/`;
const pronunciationFirst = "한국어를 모국어처럼 자연스럽고 또렷하게 읽어 주세요. 우선순위는 정확한 자음·모음과 조사·어미 연결, 자연스러운 문장 억양, 밝은 음색, 감정 연기 순서입니다. 영어식 강세 없이 문장 의미에 맞춰 호흡하고 단어마다 끊지 마세요. 맑고 가볍고 가늘며 부드러운 성인 여성형 음색과 편안한 높은 음역을 목표로 합니다. 밝고 생기 있지만 어린아이 흉내, 억지 가성, 굵고 무거운 저음, 과장된 만화 연기는 피하세요. 발음을 해치면 연기 강도를 낮추세요. 속도는 1.0의 안정적인 대화체를 유지하고 문장 끝과 마지막 질문을 급하게 끝내지 마세요. 발화만 읽고 역할명이나 지시문은 읽지 마세요. 음악·효과음은 없습니다.";

export function allCartoonActingPlans(sample: ProposalSample) {
  const original = cartoonActingPlans(sample);
  const turns = original[1].parts.map((part, index) => ({
    ...part,
    text: index === 2 ? part.text.replace("완벽했는데…", "완벽했는데,") : part.text,
  }));
  const script = turns.map(turn => turn.text).join("\n");
  const styles = [
    "이야기를 밝고 편안하게 시작합니다.",
    "보호자의 즐겁고 신나는 말입니다. 힘을 주거나 소리 지르지 않습니다.",
    "작은 반전을 자연스러운 한 문장 호흡으로 이어 갑니다.",
    "보호자가 가볍게 놀란 뒤 머쓱하게 웃는 느낌입니다. 물음 뒤 과하게 쉬지 않습니다.",
    "강아지의 속마음을 재치 있고 장난스럽게 표현하되 발음은 또렷하게 유지합니다.",
    "친근하고 명료한 질문을 끝까지 여유 있게 마무리합니다.",
  ];
  const revised = (["A-2", "B-2"] as const).map(variant => {
    const inputs = variant === "A-2"
      ? [{ text: script, voice: "shimmer" as const, instructions: `${pronunciationFirst} 한 성우가 전체 이야기를 읽습니다. 내레이션은 경쾌하고 부드럽게, 첫 대사는 즐겁게, 두 번째 대사는 놀라고 머쓱하게, 속마음은 장난스럽게 구분하되 과장하지 않습니다. 전체 약 20~30초의 자연스러운 호흡을 목표로 합니다.` }]
      : turns.map((turn, index) => ({ text: turn.text, voice: index === 1 || index === 3 ? "nova" as const : "shimmer" as const, instructions: `${pronunciationFirst} ${styles[index]} 다른 역할과 큰 음량·속도 차이 없이 편안한 중고음역을 유지합니다.` }));
    const sourceHash = original[0].sourceHash;
    const configHash = hash(JSON.stringify({ recipe: "cartoon-acting-pilot-v2", variant, sourceHash, script, inputs, model: actingModel, speed: 1 }));
    const id = uuid(configHash);
    return { variant, id, hash: configHash, sourceHash, script, scriptHash: hash(script), model: actingModel,
      version: 2, finalVoice: "shimmer" as const, titlePrefix: actingRevisionTitlePrefix,
      actingNote: "한국어 발음 우선 · 맑고 가벼운 성인 여성형 목표 · 밝은 대화체 · 과장 억제 · 청감 평가 대기",
      label: variant === "A-2" ? "A-2안 — 경쾌한 1인 성우형" : "B-2안 — 경쾌한 다중 성우형",
      voiceLabel: variant === "A-2" ? "Shimmer" : "내레이터 Shimmer · 보호자 Nova · 속마음 Shimmer",
      path: `${actingRevisionPrefix}${id}/final.mp3`,
      parts: inputs.map((input, index) => { const digest = hash(`${configHash}:part:${index}`); return { ...input, index, id: uuid(digest), hash: digest, path: `${actingRevisionPrefix}${id}/part-${index}.mp3` }; }),
    };
  });
  return [...original.map(plan => ({ ...plan, version: 1, finalVoice: "coral" as const, titlePrefix: actingTitlePrefix, actingNote: "기존 비교본 · 차분한 내레이션과 역할별 감정 연기 · 사용자 재조정 요청" })), ...revised];
}
export type AnyCartoonActingPlan = ReturnType<typeof allCartoonActingPlans>[number];
