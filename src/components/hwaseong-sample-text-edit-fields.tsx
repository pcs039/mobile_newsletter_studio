"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { articleEditorFormId } from "@/lib/article-editor-form-id";
import { sampleEditNotice, type SampleTextEditAccess, type SampleTextEditState, type SampleTextPatch } from "@/lib/hwaseong-sample-text-edit";

const field="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-base leading-7 text-slate-900";
export function HwaseongSampleTextEditFields({projectSlug,articleId,access}:{projectSlug:string;articleId:string;access:SampleTextEditAccess}) {
  const router=useRouter();
  const [state,setState]=useState<SampleTextEditState|null>(access.state),[message,setMessage]=useState(access.message),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false);
  const gate=useRef(false);
  useEffect(()=>{window.dispatchEvent(new CustomEvent("article-editor-save-state",{detail:{articleId,saving:busy,error:unknown?message:""}}));},[articleId,busy,unknown,message]);
  const patch:SampleTextPatch|null=state?{title:state.title,summary:state.summary,blocks:state.blocks,sections:state.sections}:null;
  function change(update:Partial<SampleTextPatch>){setState(s=>s?{...s,...update}:s);}
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(gate.current||unknown||!state||!patch)return;
    gate.current=true;setBusy(true);setMessage("");
    try {
      const r=await fetch('/api/project-content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectSlug,articleId,title:patch.title,sampleTextEdit:{revision:state.revision,patch}})});
      const value=await r.json().catch(()=>null);
      if(r.ok&&value?.ok&&value.sampleTextState?.revision){setState(value.sampleTextState);setMessage(value.message??"텍스트를 저장했습니다.");router.refresh();}
      else if(r.status>=500||!value){setUnknown(true);setMessage(value?.message??"저장 결과를 확인하지 못했습니다. 다시 저장하지 말고 화면을 새로 열어 저장본을 확인해 주세요.");}
      else {setMessage(value.message??"저장하지 못했습니다. 내용을 확인해 주세요.");if(r.status===409)setUnknown(true);}
    }catch{setUnknown(true);setMessage("저장 응답을 받지 못했습니다. 재전송하지 말고 화면을 새로 열어 저장본을 확인해 주세요.");}
    finally{gate.current=false;setBusy(false);}
  }
  return <form id={articleEditorFormId(articleId)} onSubmit={submit} className="space-y-5" aria-label="샘플 안전 텍스트 편집">
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-7"><h2 className="font-bold">샘플 안전 텍스트 편집</h2><p>{sampleEditNotice}</p><p>저장 후 기존 음성 파일은 보존합니다. 화면과 낭독 대본이 달라지면 재생성 필요 안내를 표시하며 자동 유료 생성은 하지 않습니다.</p></div>
    {state ? <fieldset disabled={busy||unknown} className="space-y-5 disabled:opacity-70">
      <label className="block font-bold">기사 제목<textarea className={field} rows={2} maxLength={200} required value={state.title} onChange={e=>change({title:e.currentTarget.value})}/><span className="text-xs font-normal text-slate-600">요약 첫 화면·목차의 제목에도 동일하게 반영합니다.</span></label>
      <label className="block font-bold">요약 문장<textarea className={field} rows={3} maxLength={499} value={state.summary} onChange={e=>change({summary:e.currentTarget.value})}/></label>
      {state.blocks.map((b,i)=><section key={b.id} className="space-y-3 rounded-xl border border-slate-200 p-4"><label className="block text-sm font-bold">본문 {i+1} 소제목<input className={field} maxLength={200} value={b.title} onChange={e=>change({blocks:state.blocks.map((x,j)=>j===i?{...x,title:e.currentTarget.value}:x)})}/></label><label className="block text-sm font-bold">본문 {i+1}<textarea className={field} rows={8} maxLength={6000} required value={b.body} onChange={e=>change({blocks:state.blocks.map((x,j)=>j===i?{...x,body:e.currentTarget.value}:x)})}/></label></section>)}
      {state.sections.map((s,i)=><section key={i} className="space-y-3 rounded-xl border border-slate-200 p-4"><label className="block text-sm font-bold">편집 섹션 {i+1} 소제목<input className={field} maxLength={100} required value={s.title} onChange={e=>change({sections:state.sections.map((x,j)=>j===i?{...x,title:e.currentTarget.value}:x)})}/></label><label className="block text-sm font-bold">편집 섹션 {i+1} 본문<textarea className={field} rows={6} maxLength={1800} required value={s.text} onChange={e=>change({sections:state.sections.map((x,j)=>j===i?{...x,text:e.currentTarget.value}:x)})}/></label></section>)}
      <button type="submit" className="dd-btn dd-btn-primary min-h-11" disabled={busy||unknown}>{busy?"저장 중…":"텍스트 저장"}</button>
    </fieldset> : <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">{message||"안전한 저장을 준비하지 못해 일반 저장을 차단했습니다."}</p>}
    {state&&message?<p role="status" className="whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm leading-7">{message}</p>:null}
    {unknown?<button type="button" className="dd-btn dd-btn-secondary" onClick={()=>window.location.reload()}>저장본 다시 확인</button>:null}
    <Link className="dd-btn dd-btn-secondary min-h-11" href={`/projects/${projectSlug}/samples?articleId=${articleId}&view=detail&width=390`}>저장된 디자인 미리보기</Link>
  </form>;
}
