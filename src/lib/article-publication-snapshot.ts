import "server-only";
import { publicationHash, publicationFileId, type PublicationJson } from "@/lib/article-publication-canonical";
import { validateArticleTextDesign } from "@/lib/article-text-design";
import { validateArticleCompositionPlacementSettings } from "@/lib/article-composition";
import { getArticlePublicInfoFieldGroup } from "@/lib/article-public-info-fields";
import { normalizeKoreanTtsText, ARTICLE_TTS_NORMALIZATION_VERSION } from "@/lib/article-tts-audio";
import { createHash } from "node:crypto";
import { validateArticleBodyDesign } from "@/lib/article-body-design";
import { getValidArticleActionHref, getArticleLinkButtonLabel } from "@/lib/public-article-url";

export type PublicationRow = Record<string, PublicationJson>;
export type PublicationCapture = {
  project: PublicationRow; article: PublicationRow; blocks: PublicationRow[]; links: PublicationRow[];
  compositions: PublicationRow[]; placements: PublicationRow[]; assets: PublicationRow[]; photos: PublicationRow[]; fonts: PublicationRow[]; audio: PublicationRow[];
};
export type PublicationMediaRequirement = {
  fileId: string; sourceId: string; sourceKind: "asset" | "photo" | "font" | "audio"; role: string;
  bucket: string; path: string; mime: string;
  familyId?: string | null;
};
export type PublicationCandidate = {
  snapshotSchemaVersion: "a2-content-v1"; rendererVersion: "a2-reader-contract-v1"; canonicalVersion: "a2-canonical-v1";
  projectId: string; articleId: string; article: PublicationRow; presentation: PublicationRow;
  typography: PublicationRow; provenance: PublicationRow; mediaRefs: PublicationRow[];
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const forbidden = /<\/?[a-z!]|(?:javascript|data|blob):|url\s*\(|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/i;
function text(value: PublicationJson | undefined, limit=30000): string {
  if (value == null) return "";
  if (typeof value !== "string" || value.length>limit || forbidden.test(value)) throw Error("snapshot_unsafe_text");
  return value;
}
function pick(row: PublicationRow, keys: string[]): PublicationRow {
  return Object.fromEntries(keys.map(k=>[k,typeof row[k]==="string"?text(row[k],1000):row[k]??null]));
}
function ordered(rows: PublicationRow[]): PublicationRow[] {
  if(rows.length>200)throw Error("snapshot_count");
  return [...rows].sort((a,b)=>Number(a.sort_order??0)-Number(b.sort_order??0)||String(a.id).localeCompare(String(b.id),"en"));
}
export function publicationActionTarget(value: PublicationJson): string {
  const raw=text(value,2000),validated=getValidArticleActionHref(raw);
  if(!validated)throw Error("snapshot_unsafe_url");
  const url=new URL(validated.href);
  if(url.username||url.password||
    [...url.searchParams.keys()].some(k=>/token|signature|secret|session|password/i.test(k))) throw Error("snapshot_unsafe_url");
  return url.href;
}
export function validatePublicationCandidate(candidate: PublicationCandidate): void {
  if(candidate.snapshotSchemaVersion!=="a2-content-v1"||candidate.rendererVersion!=="a2-reader-contract-v1"||candidate.canonicalVersion!=="a2-canonical-v1") throw Error("snapshot_version");
  if(!uuid.test(candidate.articleId)||!uuid.test(candidate.projectId))throw Error("snapshot_identity");
  publicationHash(candidate);
}

// Trusted-server builder only. No URLs, credentials, fetch, DB or environment lookup.
// Raw HTML/embed/survey and unsupported media types fail closed until a renderer adapter exists.
export function buildArticlePublicationSnapshot(capture: PublicationCapture, preparation: string) {
  if(!uuid.test(preparation))throw Error("snapshot_preparation");
  const {project:p,article:a}=capture,projectId=String(p.id),articleId=String(a.id);
  if(!uuid.test(projectId)||!uuid.test(articleId)||a.project_id!==p.id)throw Error("snapshot_ownership");
  for(const rows of [capture.blocks,capture.links,capture.compositions,capture.audio])for(const row of rows)
    if(row.project_id!==p.id || (row.article_id!=null && row.article_id!==a.id))throw Error("snapshot_ownership");
  if(a.survey_id||a.page_id)throw Error("snapshot_unsupported_dependency");
  const requirements: PublicationMediaRequirement[]=[];
  const mediaRefs: PublicationRow[]=[];
  function file(row: PublicationRow,kind: PublicationMediaRequirement["sourceKind"],role: string,pathOverride?: string) {
    if(kind!=="font"&&row.project_id!==p.id)throw Error("snapshot_ownership");
    if(kind==="asset"&&(row.is_active!==true||row.approval_status!=="approved"||row.asset_type==="logo"))throw Error("snapshot_asset_policy");
    if(kind==="photo"&&row.is_approved!==true)throw Error("snapshot_photo_policy");
    if(kind==="font"&&(row.is_active!==true||row.webfont_allowed!==true||row.family_active===false||row.family_webfont_allowed===false))throw Error("snapshot_font_policy");
    const bucket=String(row.storage_bucket??""),path=String(pathOverride??row.storage_path??row.font_file_path??row.file_path??"");
    // Only the explicitly named in-memory private source. No remote/public buckets.
    if(bucket!=="a2-isolated-source"||!path.startsWith(`projects/${projectId}/`)||/[%\\?#:]/.test(path)||path.split("/").some(x=>!x||x==="."||x===".."))throw Error("snapshot_private_source_required");
    const sourceId=String(row.id),fileId=publicationFileId(preparation,role,sourceId);
    if(!uuid.test(sourceId))throw Error("snapshot_source_identity");
    const mime=String(row.mime_type??"");
    if(!["image/png","image/jpeg","image/webp","audio/wav","audio/mpeg","font/ttf","font/otf","font/woff","font/woff2"].includes(mime))throw Error("snapshot_media_format");
    if((kind==="font")!==mime.startsWith("font/")||(kind==="audio")!==mime.startsWith("audio/"))throw Error("snapshot_media_format");
    requirements.push({fileId,sourceId,sourceKind:kind,role,bucket,path,mime,...(kind==="font"?{familyId:row.family_id?String(row.family_id):null}:{})});mediaRefs.push({fileId,role,kind});
    return {fileId};
  }
  const asset=(id: PublicationJson,role: string)=>{
    const row=capture.assets.find(x=>x.id===id);if(!row)throw Error("snapshot_missing_asset");return file(row,"asset",role);
  };
  const links=ordered(capture.links).filter(l=>l.is_visible!==false).map(l=>({label:text(l.label,300),actionType:text(l.action_type,40),target:publicationActionTarget(l.target_value),displayStyle:text(l.display_style,30)}));
  const blocks=ordered(capture.blocks).filter(b=>b.is_visible!==false).map((b,i)=>{
    const type=String(b.block_type),base={key:`block-${i}`,type,title:text(b.title,500),body:text(b.body),alignment:text(b.text_alignment,20)};
    const metadata=(b.metadata??{}) as PublicationRow;
    if(Array.isArray(metadata)||typeof metadata!=="object"||Object.keys(metadata).some(k=>!["presentation_mode","show_public_title","body_design"].includes(k)))throw Error("snapshot_unsupported_metadata");
    if(metadata.presentation_mode!=null&&!["text","mixed","image"].includes(String(metadata.presentation_mode)))throw Error("snapshot_presentation");
    if(metadata.show_public_title!=null&&typeof metadata.show_public_title!=="boolean")throw Error("snapshot_presentation");
    if(type==="paragraph")return {...base,...(metadata.body_design?{bodyDesign:validateArticleBodyDesign(metadata.body_design)}:{})};
    if(type==="image"){
      const row=capture.photos.find(v=>v.id===b.asset_id);if(!row)throw Error("snapshot_missing_asset");
      const body=String(b.body??"");
      if(body&&body!==row.file_path){const url=new URL(body,"https://internal.invalid");
        if(url.origin!=="https://internal.invalid"||url.pathname!=="/api/public-files/preview"||url.searchParams.get("path")!==row.file_path||url.searchParams.get("bucket")!==row.storage_bucket)throw Error("snapshot_image_reference");}
      return {...base,body:"",alt:text(b.title||a.title,500),caption:text(b.title,500),...file(row,"photo",`body-${i}`)};
    }
    if(type==="button_group"||type==="map_link"){
      const linked=b.link_action_id?capture.links.find(l=>l.id===b.link_action_id):undefined;
      if(b.link_action_id&&!linked)throw Error("snapshot_missing_link");
      const target=publicationActionTarget(linked?.target_value||b.body),actionType=target.startsWith("tel:")?"phone":type==="map_link"?"map":"url";
      return {...base,target,label:getArticleLinkButtonLabel(text(b.title||linked?.label,300),actionType==="phone"?"phone":"url"),actionType};
    }
    throw Error("snapshot_unsupported_block");
  });
  const comp=capture.compositions[0];if(capture.compositions.length>1)throw Error("snapshot_composition_count");
  const rawSettings=(comp?.settings??{}) as PublicationRow;
  if(comp&&comp.status!=="ready")throw Error("snapshot_composition_not_ready");
  if(Object.keys(rawSettings).some(k=>k!=="textDesign"))throw Error("snapshot_unsupported_settings");
  const td=validateArticleTextDesign(rawSettings.textDesign??{});if(!td.ok)throw Error("snapshot_text_design");
  Object.values(td.settings).forEach(v=>{if(typeof v==="string")text(v);});
  const warnings:string[]=[];
  const placements=ordered(capture.placements).filter(x=>x.is_visible!==false).flatMap(x=>{
    if(!comp||x.composition_id!==comp.id)throw Error("snapshot_ownership");
    if(!["hero_background","hero_illustration"].includes(String(x.slot))){warnings.push(`unsupported_slot:${x.slot}`);return [];}
    const row=capture.assets.find(v=>v.id===x.asset_id),allowed=x.slot==="hero_background"?["background","pattern"]:["illustration","decoration"];
    if(!row||!allowed.includes(String(row.asset_type)))throw Error("snapshot_slot_compatibility");
    const settings=validateArticleCompositionPlacementSettings(x.settings??{},String(x.slot) as "hero_background"|"hero_illustration");
    if(!settings.ok)throw Error("snapshot_placement_settings");
    return [{slot:String(x.slot),settings:settings.settings,...asset(x.asset_id,`composition-${x.slot}`)}];
  });
  const typography:PublicationRow={};
  const roleIds={title:a.title_font_asset_id||p.title_font_asset_id,body:a.body_font_asset_id||p.body_font_asset_id,
    caption:a.caption_font_asset_id||a.body_font_asset_id||p.body_font_asset_id,button:a.button_font_asset_id||a.body_font_asset_id||p.body_font_asset_id};
  for(const [role,id] of Object.entries(roleIds)){
    if(!id){typography[role]={selectedId:null,resolvedId:null,family:"system-ui",faces:[]};continue;}
    const selected=capture.fonts.find(f=>f.id===id);if(!selected)throw Error("snapshot_missing_font");
    if(selected.is_active!==true||selected.webfont_allowed!==true||selected.family_active===false||selected.family_webfont_allowed===false)throw Error("snapshot_font_policy");
    const faces=capture.fonts.filter(f=>(selected.family_id?f.family_id===selected.family_id:f.id===id)&&f.is_active===true&&f.webfont_allowed===true).sort((a,b)=>String(a.id).localeCompare(String(b.id),"en"));
    // Match the existing repository's CSS identity, including standalone files.
    const family=text(selected.css_family_name||`DD_Font_${String(selected.id).replace(/[^a-zA-Z0-9_-]/g,"_").replace(/-/g,"_")}`,100);if(!/^[\p{L}\p{N}_ -]+$/u.test(family))throw Error("snapshot_font_family");
    typography[role]={selectedId:a[`${role}_font_asset_id`]??null,resolvedId:String(id),family,
      faces:faces.map(f=>{const weight=String(f.detected_weight||f.font_weight||"400"),style=String(f.detected_style||f.font_style||"normal");
        if(!/^[1-9]00$/.test(weight)||!["normal","italic"].includes(style))throw Error("snapshot_font_face");
        return {weight,style,format:text(f.font_file_format,10),...file(f,"font",`font-${role}-${f.id}`)};})};
  }
  const audio:PublicationRow[]=[];let audioInfo:PublicationRow={source:"none"};
  if(a.audio_source&&a.audio_source!=="none"){
    const row=capture.audio.find(x=>x.id===(a.audio_source==="ai_tts"?a.ai_audio_id:a.audio_id));if(!row)throw Error("snapshot_missing_audio");
    if(row.script_status!=="approved")throw Error("snapshot_audio_policy");
    if(row.source_type!==a.audio_source)throw Error("snapshot_audio_source");
    const paths=a.audio_source==="ai_tts"?row.ai_tts_audio_paths:[row.file_path];
    if(!Array.isArray(paths)||!paths.length||paths.length>100)throw Error("snapshot_audio_manifest");
    // Existing text association is retained, but an unverified stale manifest is blocked.
    const paragraphs=ordered(capture.blocks).filter(b=>b.is_visible!==false&&b.block_type==="paragraph").map(b=>text(b.body).trim()).filter(Boolean);
    const narration=normalizeKoreanTtsText(paragraphs.length?paragraphs.join("\n\n"):text(a.body));
    const narrationHash=createHash("sha256").update(`${ARTICLE_TTS_NORMALIZATION_VERSION}\n${narration}`).digest("hex");
    if(a.audio_source==="ai_tts" && row.ai_tts_text_hash!==narrationHash)throw Error("snapshot_audio_stale");
    const voice=String(a.article_tts_voice||p.article_tts_voice||"marin");
    if(a.audio_source==="ai_tts"&&row.ai_tts_voice!==voice)throw Error("snapshot_audio_voice");
    audioInfo={source:a.audio_source,textHash:row.ai_tts_text_hash??null,voice:row.ai_tts_voice??null,
      transcript:text(row.script_text,30000),normalizationVersion:ARTICLE_TTS_NORMALIZATION_VERSION};
    paths.forEach((path,i)=>audio.push({index:i,...file(row,"audio",`audio-${i}`,text(path,1000))}));
  }
  const rawInfo=(a.public_info??{}) as PublicationRow;if(Array.isArray(rawInfo)||typeof rawInfo!=="object")throw Error("snapshot_public_info");
  const infoKeys=getArticlePublicInfoFieldGroup(String(a.article_type??"general")).fields.map(f=>f.key);
  if(Object.keys(rawInfo).some(k=>!infoKeys.includes(k)))throw Error("snapshot_public_info_field");
  const info=Object.fromEntries(Object.entries(rawInfo).map(([k,v])=>[k,text(v,300).trim()]));
  const color=text(p.primary_color,30);if(color&&!/^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i.test(color))throw Error("snapshot_color");
  const align=(value:PublicationJson|undefined)=>{const v=String(value||"left");if(!["left","center","right"].includes(v))throw Error("snapshot_alignment");return v;};
  const candidate:PublicationCandidate={snapshotSchemaVersion:"a2-content-v1",rendererVersion:"a2-reader-contract-v1",canonicalVersion:"a2-canonical-v1",projectId,articleId,
    article:{title:text(a.display_title||a.title,500),summary:text(a.summary,4000),body:text(a.body),blocks,links,publicInfo:info,
      contentPresentation:((capture.blocks.find(b=>(b.metadata as PublicationRow)?.presentation_mode)?.metadata as PublicationRow)?.presentation_mode)||(capture.blocks.some(b=>b.block_type==="image")?"mixed":"text"),
      showPublicTitle:((capture.blocks.find(b=>typeof (b.metadata as PublicationRow)?.show_public_title==="boolean")?.metadata as PublicationRow)?.show_public_title)??true,
      ...pick(a,["article_type","publication_kind","urgency","motion_preset","motion_speed","contact_name","contact_phone","title_motion_effect","title_motion_speed","text_box_motion_effect","text_box_motion_speed","image_motion_effect","image_motion_speed","link_motion_effect","link_motion_speed"]),
      titleAlignment:align(a.title_alignment),summaryAlignment:align(a.summary_alignment||a.text_alignment),bodyAlignment:align(a.body_alignment||a.text_alignment)},
    presentation:{projectTitle:text(p.title,500),primaryColor:color,textDesign:td.settings as PublicationRow,placements,audio,audioInfo},typography,
    provenance:{articleId,blockIds:capture.blocks.map(b=>b.id),linkIds:capture.links.map(l=>l.id)},mediaRefs};
  if(!candidate.article.title)throw Error("snapshot_title");validatePublicationCandidate(candidate);
  return {candidate,requirements,warnings,sourceHash:publicationHash(capture)};
}
