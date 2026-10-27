import "server-only";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { hwaseongSampleSlug } from "@/lib/hwaseong-proposal-sample";
import { sampleOrderRules } from "@/lib/hwaseong-sample-interest";
import { validateSampleTextPatch, type SampleTextEditAccess, type SampleTextEditState } from "@/lib/hwaseong-sample-text-edit";
import type { UpsertProjectArticleInput, UpsertProjectArticleResult } from "@/lib/newsletter-repository";

const projectId="4cd5297e-a0fd-434c-84d4-fa4d3baf9389";
const blocked="샘플 디자인을 보존하기 위해 일반 전체 저장을 차단했습니다. 화면을 다시 열어 안전한 텍스트 편집을 사용해 주세요.";
async function rpc(articleId:string,headers:Record<string,string>,expected?:string,patch?:unknown) {
  const endpoint=getSupabaseRestEndpoint('/rest/v1/rpc/save_hwaseong_sample_text_atomic');
  if(!endpoint||!stagingEnvironmentConfigured())throw Error("고정 Staging에서만 샘플을 편집할 수 있습니다.");
  const r=await fetch(endpoint,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_project_id:projectId,p_article_id:articleId,p_expected:expected??null,p_patch:patch??null}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  const value=await r.json().catch(()=>null);
  return {r,value};
}
export async function getSampleTextEditAccess(articleId:string):Promise<SampleTextEditAccess> {
  try {
    if(!stagingEnvironmentConfigured())throw Error("고정 Staging에서만 샘플을 편집할 수 있습니다.");
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)throw Error(blocked);
    const {r,value}=await rpc(articleId,{apikey:key,Authorization:`Bearer ${key}`});
    if(!r.ok||!value||typeof value.revision!=='string')throw Error("안전한 텍스트 저장 기능을 준비하지 못했습니다. 일반 저장은 차단됩니다.");
    validateSampleTextPatch({title:value.title,summary:value.summary,blocks:value.blocks,sections:value.sections});
    return {state:value as SampleTextEditState,message:''};
  } catch(error) { return {state:null,message:error instanceof Error?error.message:blocked}; }
}
export async function saveSampleTextIfProtected(input:UpsertProjectArticleInput,resolvedProjectId:string,headers:Record<string,string>):Promise<UpsertProjectArticleResult|null> {
  if((input.projectSlug!==hwaseongSampleSlug&&resolvedProjectId!==projectId)||!input.articleId)return null;
  const reject=(message=blocked,httpStatus=409):UpsertProjectArticleResult=>({ok:false,status:'request_failed',httpStatus,message});
  if(resolvedProjectId!==projectId||!stagingEnvironmentConfigured())return reject("고정 Staging에서만 샘플을 편집할 수 있습니다.",403);
  // Check the stored marker, never a client assertion. A lookup error must not fall through to destructive RPC.
  const endpoint=getSupabaseRestEndpoint('/rest/v1/newsletter_content_blocks?'+new URLSearchParams({select:'id,metadata',article_id:`eq.${input.articleId}`,project_id:`eq.${projectId}`,limit:'100'}));
  if(!endpoint)return reject();
  const response=await fetch(endpoint,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)return reject("기존 블록을 확인하지 못해 저장하지 않았습니다.",503);
  const blocks=await response.json();if(!Array.isArray(blocks)||blocks.length>=100)return reject();
  if(!blocks.some(b=>b.metadata&&Object.hasOwn(b.metadata,'proposal_sample')))return input.sampleTextEdit||Object.hasOwn(sampleOrderRules,input.articleId)?reject("샘플 메타데이터를 확인하지 못해 저장을 차단했습니다."):null;
  if(!input.sampleTextEdit||typeof input.sampleTextEdit.revision!=='string'||!/^[a-f0-9]{32}$/.test(input.sampleTextEdit.revision))return reject();
  let patch;try{patch=validateSampleTextPatch(input.sampleTextEdit.patch);}catch(e){return reject((e as Error).message,400);}
  try {
    const {r,value}=await rpc(input.articleId,headers,input.sampleTextEdit.revision,patch);
    if(!r.ok)return reject(r.status===409?"다른 저장으로 원고가 바뀌었습니다. 다시 열어 변경 내용을 확인해 주세요.":r.status===404?"안전한 저장 RPC가 준비되지 않아 저장하지 않았습니다.":"샘플 텍스트 저장 결과를 확인하지 못했습니다. 저장본을 확인해 주세요.",r.status===409?409:r.status===404?503:r.status>=500?502:400);
    if(value?.ok!==true||typeof value.revision!=='string')return reject("저장 결과 확인이 필요합니다. 다시 저장하지 말고 화면을 새로 열어 확인해 주세요.",502);
    return {ok:true,message:value.changed?"텍스트를 저장했습니다. 낭독 원고가 달라지면 음성 재생성이 필요합니다. 자동 생성하지 않습니다.":"변경된 텍스트가 없습니다.",article:{id:input.articleId,title:patch.title},sampleTextState:value};
  } catch {return reject("저장 응답을 받지 못했습니다. 저장됐을 수 있으므로 다시 저장하지 말고 화면을 새로 열어 확인해 주세요.",502);}
}
