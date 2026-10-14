import type { ProjectDesignAsset } from "@/lib/newsletter-repository";
import { buildVisualDirectorResult, type VisualDirectorArticle } from "@/lib/article-visual-director";
import { readDesignAssetMetadata } from "@/lib/design-asset-metadata";

export const institutionAssetKindLabels = {
  real_person_photo: "인물 사진", event_photo: "행사 현장 사진", facility_photo: "시설 사진",
  place_photo: "지역 사진", poster: "포스터", character: "캐릭터", illustration: "일러스트", other: "유형 확인 필요",
} as const;
export type InstitutionAssetKind = keyof typeof institutionAssetKindLabels;
export type InstitutionMatchAsset = Pick<ProjectDesignAsset, "id" | "projectId" | "assetType" | "name" | "altText" | "usageNote" | "language" | "variant" | "approvalStatus" | "isActive" | "mimeType" | "updated" | "metadata"> & { hasPrivateImage: boolean };
export type InstitutionAssetMatchSpec = {
  version: "v1"; articleId: string; subjectType: "person" | "event" | "place" | "facility" | "organization" | "general";
  subjects: string[]; contextTerms: string[]; locationTerms: string[]; timeTerms: string[];
  preferredAssetKinds: InstitutionAssetKind[]; requiresRealPhoto: true; eligible: boolean;
};
export type InstitutionAssetCandidate = {
  assetId: string; name: string; assetType: string; kind: InstitutionAssetKind; approvalStatus: "draft" | "approved";
  score: number; exactSubjectMatch: boolean; reasons: string[]; warnings: string[];
  scores: { subjectMatch: number; assetKindMatch: number; contextMatch: number; locationMatch: number; timeMatch: number; usageTagMatch: number; recencyBonus: number };
};
export type InstitutionAssetRecommendation = {
  matcherVersion: "v1"; articleId: string; status: "strong_match" | "possible_match" | "no_match" | "missing_required_asset" | "not_supported";
  spec: InstitutionAssetMatchSpec; candidates: InstitutionAssetCandidate[]; candidateAssetIds: string[];
  humanReviewRequired: true; humanReviewReason: string;
};
const raster = new Set(["image/png", "image/jpeg", "image/webp"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (s: string) => s.normalize("NFC").replace(/\S+/g, token => /^https?:/i.test(token)||token.includes("/")||token.includes("\\") ? " " : token).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim();
const unique = (a: string[]) => [...new Set(a.filter(Boolean))].sort();
const normalize = (s: string) => clean(s).toLowerCase().replace(/\s+/g, " ");
const terms = (s: string) => unique((clean(s).match(/[가-힣A-Za-z0-9]{2,}/g) ?? []).filter(t=>t.length<=80)).slice(0, 80);
const overlap = (a: string[], text: string) => a.filter(t => contains(text, t)).length;
function explicitTimes(text:string) {
  const dates=Array.from(text.matchAll(/(?:^|[^0-9])(\d{4})[-.](\d{1,2})[-.](\d{1,2})(?=$|[^0-9])/g),m=>[`${m[1]}년`,`${Number(m[2])}월 ${Number(m[3])}일`]).flat();
  return unique([...(text.match(/\d{4}년|\d{4}(?=\s)|\d{1,2}월\s*\d{1,2}일|제\s*\d+회/g)??[]),...dates]);
}
function contains(text: string, subject: string) {
  // Exact token/phrase boundaries: 김민수 must not match 김민수진; 2026 must not match 2025.
  return new RegExp(`(?:^|[^가-힣A-Za-z0-9])${subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^가-힣A-Za-z0-9])`, "i").test(text);
}
export function institutionArticleSnapshot(a: VisualDirectorArticle) {
  return { title: clean(a.title), summary: clean(a.summary), body: clean(a.body), articleType: a.articleType,
    publicInfo: Object.fromEntries(Object.entries(a.publicInfo).sort(([a], [b]) => a.localeCompare(b)).map(([k,v])=>[k,clean(v)])),
    institutionPriority:a.institutionPriority, urgency:a.urgency, publicationKind:a.publicationKind,
    blocks: a.blocks.filter(b=>b.type==="paragraph").map(b=>({id:b.id,title:clean(b.title),body:clean(b.body),isVisible:b.isVisible})) };
}
export function institutionAssetSnapshot(a: InstitutionMatchAsset) {
  const m=readDesignAssetMetadata(a.metadata);
  return {id:a.id,projectId:a.projectId,assetType:a.assetType,name:clean(a.name),altText:clean(a.altText),usageNote:clean(a.usageNote),language:a.language,variant:a.variant,
    approvalStatus:a.approvalStatus,isActive:a.isActive,mimeType:a.mimeType,updated:a.updated,hasPrivateImage:a.hasPrivateImage,
    metadata:m?{source:m.source,usageTags:m.usageTags?[...m.usageTags].sort():[],reuseScope:m.reuseScope,transparency:m.transparency}:null};
}
export function buildInstitutionAssetMatchSpec(article: VisualDirectorArticle, articleId: string): InstitutionAssetMatchSpec {
  const director=buildVisualDirectorResult(article),snapshot=institutionArticleSnapshot(article);
  const text=[snapshot.title,snapshot.summary,snapshot.body,...snapshot.blocks.filter(b=>b.isVisible).map(b=>b.body)].join("\n").slice(0,24000);
  const title=clean(article.title),labels=(label:string)=>unique(Array.from(text.matchAll(new RegExp(`(?:^|\\n)\\s*(?:${label})\\s*[:：]\\s*([^\\n]+)`,"g")),m=>m[1].trim()).filter(s=>s.length<=80));
  const person=unique([...labels("인물|인터뷰 대상|성명"),...Array.from(title.matchAll(/([가-힣]{2,4})\s+(?:시장|군수|구청장|기관장|관장|작가|주민|대표)(?=\s|,|$)/g),m=>m[1]),...Array.from(title.matchAll(/(?:시장|군수|구청장|기관장|관장|작가|주민|대표)\s+([가-힣]{2,4})(?=\s|,|$)/g),m=>m[1])]).filter(s=>!["인터뷰","기관장","질문","답변","현장","프로필","이야기"].includes(s));
  const interview=/인터뷰|대담|인물/.test(title+article.summary);
  const facilities=labels("시설|시설명"),events=labels("행사|행사명"),locations=unique([article.publicInfo.location,article.publicInfo.place,article.publicInfo.area].filter(Boolean).map(clean));
  // If labels are absent, only a literal named suffix in the title is accepted. No named entity invention.
  const named=(suffix:string)=>unique(Array.from(title.matchAll(new RegExp(`((?:[가-힣A-Za-z0-9]+\\s+){0,2}[가-힣A-Za-z0-9]*(?:${suffix}))(?=\\s|[,·]|$)`,"g")),m=>m[1].trim()));
  const generic=new Set(["행사","축제","공연","시설","건물","센터","도서관","박물관","공원","기관장","시장","인물","인터뷰","대표","주민","미정","없음","새","새로운","실제","현장","기록","올해","기관","지역"]);
  const namedOnly=(names:string[])=>names.filter(name=>terms(name).some(t=>!generic.has(t)&&!/^\d+$/.test(t)));
  const facilityNames=namedOnly(facilities.length?facilities:named("도서관|박물관|센터|시설|공원|건물"));
  const eventNames=namedOnly(events.length?events:named("축제|박람회|음악회|공연|행사"));
  let subjectType:InstitutionAssetMatchSpec["subjectType"]="general",subjects:string[]=[],preferredAssetKinds:InstitutionAssetKind[]=[];
  if(interview||person.length){subjectType="person";subjects=namedOnly(person);preferredAssetKinds=["real_person_photo"];}
  else if(facilityNames.length){subjectType="facility";subjects=facilityNames;preferredAssetKinds=["facility_photo"];}
  else if(eventNames.length){subjectType="event";subjects=eventNames;preferredAssetKinds=["event_photo"];}
  else if(locations.length){subjectType="place";subjects=locations;preferredAssetKinds=["place_photo"];}
  const timeTerms=explicitTimes(text+"\n"+Object.values(article.publicInfo).join("\n"));
  return {version:"v1",articleId,subjectType,subjects,contextTerms:terms(text),locationTerms:locations,timeTerms,
    preferredAssetKinds,requiresRealPhoto:true,eligible:uuid.test(articleId)&&director.primaryStrategy==="institution_asset"&&director.needsRealPhoto};
}
export function classifyInstitutionAsset(a: InstitutionMatchAsset): InstitutionAssetKind {
  const text=[a.name,a.altText,a.usageNote].map(clean).join(" ");
  if(/포스터/.test(text))return "poster";
  if(/캐릭터|마스코트/.test(text))return "character";
  if(/일러스트|삽화|생성 이미지|AI 이미지/.test(text))return "illustration";
  if(!/사진|촬영|photo/i.test(text))return "other";
  if(/인물|프로필|시장|기관장|군수|구청장|작가|portrait/i.test(text))return "real_person_photo";
  if(/행사|축제|공연|현장|event/i.test(text))return "event_photo";
  if(/시설|건물|도서관|박물관|센터|외관|내부|facility/i.test(text))return "facility_photo";
  if(/지역|풍경|명소|광장|공원|place/i.test(text))return "place_photo";
  return "other";
}
export function scoreInstitutionAsset(spec:InstitutionAssetMatchSpec,a:InstitutionMatchAsset,projectId:string):InstitutionAssetCandidate|null {
  const metadata=readDesignAssetMetadata(a.metadata),kind=classifyInstitutionAsset(a);
  if(/폐기|삭제|사용 금지|사용금지/.test([a.name,a.altText,a.usageNote].join(" "))||!spec.eligible||a.projectId!==projectId||!uuid.test(a.id)||!a.isActive||a.approvalStatus==="archived"||!raster.has(a.mimeType)||!a.hasPrivateImage||metadata?.source!=="institution"||!spec.preferredAssetKinds.includes(kind))return null;
  const text=normalize([a.name,a.altText,a.usageNote].join(" "));
  const exact=spec.subjects.length>0&&spec.subjects.every(s=>contains(text,normalize(s)));
  // Never substitute a similar person/event/facility; absent explicit subject evidence is not a match.
  if(["person","event","facility"].includes(spec.subjectType)&&!exact)return null;
  if(!exact&&spec.subjectType==="place"&&overlap(spec.locationTerms,text)===0)return null;
  const assetTimes=explicitTimes(text);
  const articleYears=spec.timeTerms.filter(t=>/^\d{4}/.test(t)).map(t=>t.slice(0,4));
  if(spec.subjectType==="event"&&articleYears.length&&assetTimes.some(t=>/^\d{4}/.test(t)&&!articleYears.includes(t.slice(0,4))))return null;
  if(spec.subjectType==="event") {
    for(const group of [/^\d{4}/,/^제\s*\d+회/,/^\d{1,2}월/]) {
      const expected=spec.timeTerms.filter(t=>group.test(t)).map(t=>t.replace(/\s|년/g,""));
      const observed=assetTimes.filter(t=>group.test(t)).map(t=>t.replace(/\s|년/g,""));
      if(expected.length&&observed.some(t=>!expected.includes(t)))return null;
    }
  }
  const scores={subjectMatch:exact?45:0,assetKindMatch:20,contextMatch:Math.min(10,overlap(spec.contextTerms,text)*2),locationMatch:Math.min(8,overlap(spec.locationTerms,text)*4),timeMatch:Math.min(8,overlap(spec.timeTerms,text)*4),usageTagMatch:metadata?.usageTags?.includes(spec.subjectType==="person"?"interview":spec.subjectType==="event"?"event":"culture")?5:0,recencyBonus:0};
  const warnings=["대상·촬영 시점·회차와 저작권·초상권을 사람이 확인하세요.",...(a.approvalStatus==="draft"?["미승인 자산입니다. 사용 전에 자산 승인이 필요합니다."]:[]),...(spec.subjectType==="event"&&!assetTimes.length?["촬영 시점·행사 회차 정보가 없습니다."]:[])];
  return {assetId:a.id,name:clean(a.name),assetType:a.assetType,kind,approvalStatus:a.approvalStatus as "draft"|"approved",score:Math.min(1,Object.values(scores).reduce((s,n)=>s+n,0)/100),exactSubjectMatch:exact,
    scores,reasons:[exact?"기사에 명시된 대상명과 자산 설명이 일치합니다.":"기사 장소와 관련된 사진 후보입니다.",`${institutionAssetKindLabels[kind]} 유형이 기사에 적합합니다.`,...(scores.locationMatch?["장소 정보가 일치합니다."]:[]),...(scores.timeMatch?["기사의 시점 정보가 일치합니다."]:[])],warnings};
}
export function rankInstitutionAssets(spec:InstitutionAssetMatchSpec,assets:InstitutionMatchAsset[],projectId:string,limit=3) {
  const byId=new Map(assets.map(a=>[a.id,a]));
  return [...byId.values()].map(a=>scoreInstitutionAsset(spec,a,projectId)).filter((a):a is InstitutionAssetCandidate=>!!a).sort((a,b)=>b.score-a.score||Number(b.exactSubjectMatch)-Number(a.exactSubjectMatch)||Number(b.approvalStatus==="approved")-Number(a.approvalStatus==="approved")||(byId.get(b.assetId)?.updated??"").localeCompare(byId.get(a.assetId)?.updated??"")||a.assetId.localeCompare(b.assetId)).slice(0,Number.isFinite(limit)?Math.max(1,Math.min(5,Math.floor(limit))):3);
}
export function buildInstitutionAssetRecommendation(article:VisualDirectorArticle,articleId:string,assets:InstitutionMatchAsset[],projectId:string,limit=3):InstitutionAssetRecommendation {
  const spec=buildInstitutionAssetMatchSpec(article,articleId),candidates=rankInstitutionAssets(spec,assets,projectId,limit);
  const eligibleAssets=assets.filter(a=>a.projectId===projectId&&a.isActive&&a.approvalStatus!=="archived"&&readDesignAssetMetadata(a.metadata)?.source==="institution");
  const status=!spec.eligible?"not_supported":candidates.length?(spec.subjectType!=="place"&&candidates[0].exactSubjectMatch&&candidates[0].score>=0.65?"strong_match":"possible_match"):eligibleAssets.length?"missing_required_asset":"no_match";
  return {matcherVersion:"v1",articleId,status,spec,candidates,candidateAssetIds:candidates.map(a=>a.assetId),humanReviewRequired:true,humanReviewReason:"실제 대상·촬영 시점·사용 승인·저작권과 초상권을 최종 확인하세요."};
}
