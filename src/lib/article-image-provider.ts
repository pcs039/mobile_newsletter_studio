import "server-only";
import { ImageGenerationError } from "@/lib/article-image-generation";

export async function requestArticleImage(payload: Record<string, unknown>) {
  const key=process.env.OPENAI_API_KEY?.trim();
  if(!key)throw new ImageGenerationError(503,"이미지 생성 API 설정이 없습니다.");
  let response:Response;
  try { response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store",signal:AbortSignal.timeout(240_000)}); }
  catch { throw new ImageGenerationError(504,"생성 결과를 확인하지 못했습니다. 자동 재시도하지 않습니다. 잠시 후 명시적으로 다시 생성해 주세요."); }
  if(!response.ok){
    const error=await response.json().catch(()=>null);
    const param=["background","size","model","prompt"].includes(error?.error?.param)?error.error.param:null;
    const message=response.status===429?"이미지 생성 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.":
      [401,403].includes(response.status)?"이미지 API 인증 또는 모델 접근 권한을 확인해 주세요.":
      response.status===400?`이미지 API가 생성 옵션을 거부했습니다${param?` (${param})`:""}. 현재 기사와 디자인은 그대로입니다.`:
      "이미지 생성에 실패했습니다. 현재 기사와 디자인은 그대로입니다.";
    throw new ImageGenerationError(response.status===429?429:502,message);
  }
  const body=await response.json().catch(()=>null);
  if(!Array.isArray(body?.data)||body.data.length!==1||typeof body.data[0]?.b64_json!=="string")throw new ImageGenerationError(502,"한 개의 이미지 결과를 확인하지 못했습니다.");
  return body.data[0].b64_json as string;
}

// UI + per-instance locks suppress duplicate charges without pre-approval DB writes.
// This is deliberately not a distributed idempotency guarantee (documented rollout limit).
const requests=new Map<string,{fingerprint:string;expires:number;result:Promise<unknown>}>();
const active=new Set<string>();
const costs=new Map<string,{started:number;count:number}>();
export async function guardedImageGeneration<T>(actor:string,key:string,fingerprint:string,run:()=>Promise<T>):Promise<T>{
  const now=Date.now();
  for(const [k,v]of requests)if(v.expires<now&&!active.has(k.split("|")[0]))requests.delete(k);
  for(const [k,v]of costs)if(now-v.started>=3600_000)costs.delete(k);
  const id=`${actor}|${key}`,previous=requests.get(id);
  if(previous){if(previous.fingerprint!==fingerprint)throw new ImageGenerationError(409,"동일 요청의 내용이 변경되었습니다.");return await previous.result as T;}
  if(active.has(actor))throw new ImageGenerationError(409,"이미지 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.");
  const cost=costs.get(actor)||{started:now,count:0};
  if(cost.count>=6)throw new ImageGenerationError(429,"이 프로젝트의 이미지 생성은 시간당 6회까지 가능합니다.");
  if(requests.size>=24||costs.size>=2000)throw new ImageGenerationError(503,"이미지 생성이 혼잡합니다. 잠시 후 다시 시도해 주세요.");
  active.add(actor);cost.count++;costs.set(actor,cost);
  const result=run().finally(()=>active.delete(actor));
  requests.set(id,{fingerprint,expires:now+15*60_000,result});
  return await result;
}
