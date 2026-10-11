import { CanvaConnectError, textAutofill } from "@/lib/canva-connect-contract";
import type { CanvaPreviewField, CanvaTemplate } from "@/lib/canva-template";
export function backgroundAutofill(template: CanvaTemplate, fields: CanvaPreviewField[], response: unknown, title: string, assetId: string) {
  const schema = (response as {dataset?: Record<string,{type?: string}>})?.dataset;
  if (template.templateType !== "brand_template" || !schema || schema.BACKGROUND_IMAGE?.type !== "image" ||
    Object.entries(schema).some(([field,value])=>value.type !== "text" && !(field === "BACKGROUND_IMAGE" && value.type === "image")) ||
    ["EVENT_TITLE","EVENT_DATE","EVENT_PLACE"].some(field=>schema[field]?.type !== "text")) {
    throw new CanvaConnectError(409,"행사 글자 3개와 BACKGROUND_IMAGE 이미지 항목이 있는 브랜드 템플릿을 사용하세요.");
  }
  if (template.fieldMappings.some(m=>m.type === "image" && m.field !== "BACKGROUND_IMAGE")) throw new CanvaConnectError(409,"이번에는 BACKGROUND_IMAGE 배경 한 개만 연결할 수 있습니다.");
  const textSchema = Object.fromEntries(Object.entries(schema).filter(([,v])=>v.type === "text"));
  const textTemplate = {...template,fieldMappings:template.fieldMappings.filter(m=>m.type === "text")};
  const payload = textAutofill(textTemplate,fields,{dataset:textSchema},title);
  if (["EVENT_TITLE","EVENT_DATE","EVENT_PLACE"].some(field=>!payload.data[field])) throw new CanvaConnectError(409,"행사 제목·일시·장소 연결을 확인하세요.");
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(assetId)) throw new CanvaConnectError(400,"배경 자산 식별자가 올바르지 않습니다.");
  return {...payload,data:{...payload.data,BACKGROUND_IMAGE:{type:"image" as const,asset_id:assetId}}};
}
export function readCanvaUploadJob(value: unknown) {
  const job=(value as {job?:{id?:unknown;status?:unknown;asset?:{id?:unknown;type?:unknown}}})?.job;
  if(!job || typeof job.id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(job.id) || !["in_progress","success","failed"].includes(String(job.status))) throw new CanvaConnectError(502,"Canva 이미지 업로드 응답을 확인하지 못했습니다.");
  if(job.status === "success" && (job.asset?.type !== "image" || typeof job.asset.id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(job.asset.id))) throw new CanvaConnectError(502,"Canva 이미지 식별자를 확인하지 못했습니다.");
  return {id:job.id,status:job.status as "in_progress"|"success"|"failed",...(job.status === "success"?{assetId:job.asset!.id as string}:{})};
}
