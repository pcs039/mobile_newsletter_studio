export type SampleTextPatch = { title: string; summary: string; blocks: { id: string; title: string; body: string }[]; sections: { title: string; text: string }[] };
export type SampleTextEditState = SampleTextPatch & { revision: string };
export type SampleTextEditAccess = { state: SampleTextEditState | null; message: string };
export const sampleEditNotice = "제목·요약과 아래 표시된 본문·소제목만 수정합니다. 블록 추가·삭제·순서, 이미지·링크·Composition·음성 설정은 이 저장에서 바뀌지 않습니다. 최초 편집 전 원문은 보존합니다. 만평 대사·지도 장소 정보·고정 정보 카드는 이 화면의 편집 대상이 아닙니다. Canva·만평 등 이미지 안의 글자도 자동으로 바뀌지 않습니다.";

export function validateSampleTextPatch(value: unknown): SampleTextPatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("텍스트 저장 내용을 확인해 주세요.");
  const p = value as Record<string, unknown>;
  const text = (v: unknown, max: number, required = false) => {
    if (typeof v !== "string" || v.length > max || (required && !v.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) throw Error("텍스트의 길이와 내용을 확인해 주세요.");
    return v;
  };
  if (Object.keys(p).some(k => !["title","summary","blocks","sections"].includes(k)) || !Array.isArray(p.blocks) || p.blocks.length > 30 || !Array.isArray(p.sections) || p.sections.length > 5) throw Error("허용된 텍스트 항목만 저장할 수 있습니다.");
  return { title: text(p.title,200,true), summary: text(p.summary,499), blocks: p.blocks.map(b => {
    if (!b || typeof b !== "object" || Object.keys(b).some(k=>!["id","title","body"].includes(k)) || !/^[0-9a-f-]{36}$/i.test(b.id)) throw Error("기존 본문 블록을 확인해 주세요.");
    return { id:b.id,title:text(b.title,200),body:text(b.body,6000,true) };
  }), sections: p.sections.map(s => {
    if (!s || typeof s !== "object" || Object.keys(s).some(k=>!["title","text"].includes(k))) throw Error("편집 섹션을 확인해 주세요.");
    return {title:text(s.title,100,true),text:text(s.text,1800,true)};
  }) };
}
