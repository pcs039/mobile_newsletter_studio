"use client";
import { useCallback,useEffect,useRef,useState } from "react";

type Share={id:string;article_ids:string[];expires_at:string;revoked_at:string|null};
type Candidate={id:string;title:string;status:string;snapshot:string};
export function ProjectDemoShareControls({projectSlug}:{projectSlug:string}){
 const endpoint=`/api/projects/${encodeURIComponent(projectSlug)}/demo-share`;
 const [articles,setArticles]=useState<Candidate[]>([]),[shares,setShares]=useState<Share[]>([]);
 const [selected,setSelected]=useState<string[]>([]),[days,setDays]=useState(1),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[message,setMessage]=useState("");
 const [hasLink,setHasLink]=useState(false),[now,setNow]=useState(0);
 const loadVersion=useRef(0),requestKey=useRef<string|null>(null);
 const link=useRef(""),lock=useRef(false),alive=useRef(false),clearTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const clearLink=useCallback(()=>{link.current="";setHasLink(false);if(clearTimer.current)clearTimeout(clearTimer.current);},[]);
 const load=useCallback(async()=>{
  const version=++loadVersion.current;
  const r=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(15000)});const d=await r.json();
  if(!r.ok||!d.ok)throw Error(d.message||"시연 설정을 불러오지 못했습니다.");
  if(alive.current&&version===loadVersion.current){setNow(Date.now());setArticles(d.articles);setShares(d.shares);setLoaded(true);setSelected(ids=>ids.filter(id=>d.articles.some((a:Candidate)=>a.id===id)));}
 },[endpoint]);
 useEffect(()=>{alive.current=true;void load().catch(e=>{if(alive.current)setMessage(e.message);});return()=>{alive.current=false;link.current="";if(clearTimer.current)clearTimeout(clearTimer.current);};},[load]);
 async function post(input:unknown){const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||"시연 요청 결과를 확인하지 못했습니다.");return d;}
 async function run(action:"create"|"revoke",shareId?:string){
  if(lock.current||!loaded||(action==="create"&&(!confirmed||!selected.length||hasLink)))return;
  lock.current=true;setBusy(true);setMessage("");clearLink();
  try{
   if(action==="create"){
    const prepared=await post({action:"prepare",articleIds:selected,snapshots:Object.fromEntries(articles.filter(a=>selected.includes(a.id)).map(a=>[a.id,a.snapshot]))});
    if(!alive.current)return;
    requestKey.current??=crypto.randomUUID();
    const d=await post({action,articleIds:selected,snapshot:prepared.snapshot,days,confirmed,requestKey:requestKey.current});
    if(!alive.current)return;
    link.current=d.url;setHasLink(true);clearTimer.current=setTimeout(clearLink,300000);
    setMessage(d.duplicate?"이전 발급 결과를 재사용했습니다. 새 링크는 만들지 않았습니다.":"시연 링크를 발급했습니다. 정식 발행 상태는 변경하지 않았습니다.");
   }else{await post({action,shareId});requestKey.current=null;if(alive.current)setMessage("링크를 회수했습니다. 새 접속과 파일 요청이 차단됩니다.");}
   await load();
  }catch(e){if(alive.current){setMessage(`${e instanceof Error?e.message:"처리 실패"} 자동 재시도하지 않습니다. 링크 목록을 다시 확인하세요.`);setLoaded(false);}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function share(copy:boolean){
  if(!link.current)return;
  try{if(!copy&&navigator.share)await navigator.share({title:"소식지 시연용 보기",url:link.current});else await navigator.clipboard.writeText(link.current);setMessage(copy?"시연 링크를 복사했습니다.":"공유 작업을 마쳤습니다.");}
  catch{setMessage("공유가 취소되었거나 지원되지 않습니다. 링크 복사를 사용하세요.");}
 }
 return <section aria-label="시연용 발행" className="my-5 min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5 [overflow-wrap:anywhere]">
  <h3 className="text-xl font-black text-[#092046]">시연용 발행</h3>
  <p className="mt-2 text-sm leading-6">기관 승인 전 샘플을 로그인 없이 열람할 수 있는 링크입니다. 기관 검토 요청·승인·정식 발행 상태는 바뀌지 않습니다.</p>
  <p className="mt-2 text-xs leading-5">선택한 기사만 공유됩니다. 일반 작성 중 기사도 포함할 수 있으므로 원문·이미지·연락처를 먼저 확인하세요. 자료가 바뀌면 기존 링크는 차단되며 재발급해야 합니다. 내려받은 자료까지 회수되지는 않습니다.</p>
  <fieldset disabled={busy||!loaded} className="mt-3 min-w-0">
   <legend className="text-sm font-bold">공유할 기사 선택 · 최대 100개</legend>
   <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded border border-amber-200 bg-white p-3">
    {articles.map(a=><label key={a.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={selected.includes(a.id)} onChange={e=>{setSelected(ids=>e.target.checked?[...ids,a.id]:ids.filter(id=>id!==a.id));setConfirmed(false);requestKey.current=null;clearLink();}} className="mt-1 shrink-0"/><span>{a.title}<span className="ml-2 text-xs text-slate-500">{({draft:"작성 중",review:"검수 요청",in_review:"검수 중",approved:"검수 완료",published:"발행됨"} as Record<string,string>)[a.status]??"상태 확인 필요"}</span></span></label>)}
    {loaded&&!articles.length?<p>시연할 기사가 없습니다.</p>:null}
   </div>
   <label className="mt-3 block text-sm font-bold">링크 유효기간 <select aria-label="시연 링크 유효기간" value={days} onChange={e=>{setDays(Number(e.target.value));setConfirmed(false);requestKey.current=null;clearLink();}} className="rounded border p-2"><option value={1}>1일</option><option value={3}>3일</option><option value={7}>7일</option></select></label>
   <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1 shrink-0"/><span>선택한 기사와 이미지를 확인했으며 외부 담당자에게 시연용으로 공유해도 됩니다.</span></label>
  </fieldset>
  <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" disabled={busy||!loaded||!confirmed||!selected.length||hasLink} onClick={()=>void run("create")} className="dd-btn dd-btn-primary max-w-full whitespace-normal">{busy?"처리 중…":"시연 링크 발급"}</button>
   <button type="button" disabled={busy} onClick={()=>void load().catch(e=>setMessage(e.message))} className="dd-btn dd-btn-secondary">목록 새로고침</button>
   {hasLink?<><button type="button" onClick={()=>void share(true)} className="dd-btn dd-btn-secondary">링크 복사</button><button type="button" onClick={()=>void share(false)} className="dd-btn dd-btn-secondary">모바일 공유</button></>:null}
  </div>
  {hasLink?<p className="mt-2 text-xs">보안을 위해 현재 화면에서 5분 동안만 링크를 복사할 수 있습니다. 새로고침 후에는 복원할 수 없으며 새 발급이 필요합니다.</p>:null}
  <p role="status" aria-live="polite" className="mt-3 text-sm font-bold">{message}</p>
  {shares.length?<details className="mt-3"><summary className="cursor-pointer text-sm font-bold">발급한 시연 링크 · 만료/회수 관리</summary><ul className="mt-2 space-y-2">{shares.map(s=><li key={s.id} className="flex flex-wrap items-center gap-2 rounded bg-white p-3 text-sm"><span>기사 {s.article_ids.length}개 · {s.revoked_at?"회수됨":Date.parse(s.expires_at)<=now?"만료됨":"유효기간 내"} · {new Date(s.expires_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} 만료</span>{!s.revoked_at&&Date.parse(s.expires_at)>now?<button type="button" disabled={busy} onClick={()=>void run("revoke",s.id)} className="dd-btn dd-btn-secondary">링크 회수</button>:null}</li>)}</ul></details>:null}
 </section>;
}
