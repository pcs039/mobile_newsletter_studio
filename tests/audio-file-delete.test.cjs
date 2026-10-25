/* eslint-disable @typescript-eslint/no-require-imports -- Mock DB/Storage only; no real deletion or credentials. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const project='4cd5297e-a0fd-434c-84d4-fa4d3baf9389',id='e2041281-42e2-5363-a329-43db98714355',path='projects/test/audio.mp3';
function fixture(options={}){
 const old=global.fetch,calls=[];let removed=false;
 const row={id,project_id:project,article_id:null,file_path:path,ai_tts_audio_paths:[path],updated_at:'2026-10-25T00:00:00Z',...options.row};
 global.fetch=async(url,init={})=>{
  const u=new URL(url),method=init.method??'GET';calls.push({u,method,body:init.body});
  if(u.hostname==='storage.invalid'){assert(removed,'Storage cannot run before confirmed DB DELETE');if(options.storageLoss)throw Error('lost');if(options.storageDenied)return Response.json({error:'secret'}, {status:403});if(options.absent)return Response.json({statusCode:'404',message:'Object not found'},{status:400});return Response.json([]);}
  if(method==='DELETE'){
   assert.equal(init.headers.Prefer,'return=representation');assert.equal(u.searchParams.get('updated_at'),'eq.'+row.updated_at);assert.equal(u.searchParams.get('article_id'),'is.null');
   if(options.fk)return Response.json({code:'23503',message:'sensitive FK detail'},{status:409});
   if(options.serverError)return Response.json({message:'gateway failure'},{status:502});
   removed=true;if(options.dbLoss)throw Error('response lost after commit');return Response.json(options.changed?[]:[row]);
  }
  if(u.pathname.endsWith('newsletter_articles'))return options.referenceReadFailure?new Response(null,{status:503}):Response.json(options.link?[{id:'article'}]:[]);
  if(u.searchParams.has('id'))return Response.json(options.missing?[]:[row]);
  if(options.cleanupReadFailure)throw Error('read lost');
  return Response.json(options.shared?[{id:'other-project-row'}]:[]);
 };
 const m=loader({'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://db.invalid'+p,getSupabaseStorageEndpoint:p=>'https://storage.invalid'+p}})('src/lib/audio-file-delete.ts');
 return {calls,run:()=>m.deleteAudioFileRecord(project,id,path,{}),restore(){global.fetch=old;}};
}
test('unreferenced pending record and already absent Storage object are independently deletable',async()=>{for(const absent of [false,true]){const f=fixture({absent});try{const r=await f.run();assert.equal(r.outcome,'deleted');assert.equal(r.ok,true);assert.equal(f.calls.filter(x=>x.u.hostname==='storage.invalid').length,1);}finally{f.restore();}}});
test('article forward and reverse references reject before DB/Storage deletion',async()=>{for(const options of [{link:true},{row:{article_id:'article'}}]){const f=fixture(options);try{const r=await f.run();assert.equal(r.outcome,'rejected');assert.equal(r.httpStatus,409);assert(!f.calls.some(c=>c.method==='DELETE'));}finally{f.restore();}}});
test('reference read failure is unknown, not absence; no deletes',async()=>{const f=fixture({referenceReadFailure:true});try{assert.equal((await f.run()).outcome,'unknown');assert(!f.calls.some(c=>c.method==='DELETE'));}finally{f.restore();}});
test('explicit DB FK rejection preserves Storage and does not leak raw errors',async()=>{const f=fixture({fk:true});try{const r=await f.run();assert.equal(r.outcome,'rejected');assert(!JSON.stringify(r).includes('sensitive'));assert(!f.calls.some(c=>c.u.hostname==='storage.invalid'));}finally{f.restore();}});
test('commit response loss, row change and proxy errors are unknown and never delete Storage',async()=>{for(const options of [{dbLoss:true},{changed:true},{serverError:true}]){const f=fixture(options);try{assert.equal((await f.run()).outcome,'unknown');assert(!f.calls.some(c=>c.u.hostname==='storage.invalid'));assert.equal(f.calls.filter(c=>c.method==='DELETE').length,1);}finally{f.restore();}}});
test('Storage failure and post-commit read failure report DB deletion, without automatic retry',async()=>{for(const options of [{storageLoss:true},{storageDenied:true},{cleanupReadFailure:true}]){const f=fixture(options);try{const r=await f.run();assert.equal(r.outcome,'cleanup_required');assert.equal(r.ok,false);assert(r.message.includes('DB 기록은 삭제'));assert(f.calls.filter(c=>c.u.hostname==='storage.invalid').length<=1);}finally{f.restore();}}});
test('another row/project referencing file or segment preserves bytes while allowing record deletion',async()=>{const f=fixture({shared:true});try{const r=await f.run();assert.equal(r.outcome,'deleted');assert(r.message.includes('참조하는 파일은 유지'));assert(!f.calls.some(c=>c.u.hostname==='storage.invalid'));assert(f.calls.some(c=>c.u.searchParams.has('ai_tts_audio_paths')));assert(f.calls.filter(c=>!c.u.searchParams.has('id')&&c.u.pathname.endsWith('newsletter_audio_files')).every(c=>!c.u.searchParams.has('project_id')));}finally{f.restore();}});
test('all validated TTS segments are cleaned after the record; unsafe manifests never delete',async()=>{const f=fixture({row:{ai_tts_audio_paths:[path,'projects/test/001.mp3',path]}});try{assert.equal((await f.run()).ok,true);assert.equal(f.calls.filter(c=>c.u.hostname==='storage.invalid').length,2);}finally{f.restore();}for(const manifest of [['../other'],null,['good',{}]]){const g=fixture({row:{ai_tts_audio_paths:manifest}});try{assert.equal((await g.run()).outcome,'rejected');assert(!g.calls.some(c=>c.method==='DELETE'));}finally{g.restore();}}});
test('missing row does not authorize path-only Storage cleanup or a blind retry',async()=>{const f=fixture({missing:true});try{assert.equal((await f.run()).httpStatus,404);assert(!f.calls.some(c=>c.method==='DELETE'));}finally{f.restore();}});

function ui(respond){
 const oldFetch=global.fetch,oldWindow=global.window,states=[],calls=[];let cursor=0,refreshes=0;
 const hooks={useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=v];},useRef(initial){const i=cursor++;if(!(i in states))states[i]={current:initial};return states[i];}};
 const C=loader({react:hooks,'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})}})('src/components/project-file-delete-button.tsx').ProjectFileDeleteButton;
 global.window={confirm:()=>true};global.fetch=async()=>{calls.push('DELETE');return respond();};
 return {calls,get refreshes(){return refreshes;},render(){cursor=0;return C({kind:'audio_mp3',projectSlug:'fixture',path,recordId:id,fileLabel:'음성'});},restore(){global.fetch=oldFetch;global.window=oldWindow;}};
}
const button=tree=>tree.props.children[0];
test('audio UI blocks double clicks and preserves unknown lock without automatic refresh/retry',async()=>{const f=ui(async()=>{throw Error('lost');});try{const b=button(f.render());await Promise.all([b.props.onClick(),b.props.onClick()]);assert.equal(f.calls.length,1);await b.props.onClick();assert.equal(f.calls.length,1);assert(button(f.render()).props.disabled);await button(f.render()).props.onClick();assert.equal(f.calls.length,1);assert.equal(f.refreshes,0);}finally{f.restore();}});
test('audio UI permits correction after explicit rejection, locks partial cleanup and refreshes only on confirmed success',async()=>{for(const outcome of ['rejected','cleanup_required','deleted']){const f=ui(()=>Response.json({ok:outcome==='deleted',outcome,message:'설명'},{status:outcome==='deleted'?200:409}));try{await button(f.render()).props.onClick();assert.equal(button(f.render()).props.disabled,outcome==='cleanup_required');assert.equal(f.refreshes,outcome==='deleted'?1:0);}finally{f.restore();}}});

test('project file deletion dispatches audio only to DB-first helper and preserves other kind contract',async()=>{
 const oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY,oldFetch=global.fetch,calls=[];process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
 try{global.fetch=async(url,init={})=>{calls.push([url,init.method??'GET']);if(url.includes('newsletter_projects'))return Response.json([{id:project,slug:'fixture',pdf_original_path:'a.pdf'}]);return new Response(null,{status:200});};let audio=0;const m=loader({'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://db.invalid'+p,getSupabaseStorageEndpoint:p=>'https://storage.invalid'+p},'@/lib/audio-file-delete':{deleteAudioFileRecord:async()=>{audio++;return {ok:false,outcome:'unknown',httpStatus:409,message:'확인 필요'};}}})('src/lib/newsletter-file-storage.ts');const r=await m.deleteProjectFile({kind:'audio_mp3',projectSlug:'fixture',recordId:id,path});assert.equal(r.outcome,'unknown');assert.equal(audio,1);assert.equal(calls.length,1);const pdf=await m.deleteProjectFile({kind:'pdf_original',projectSlug:'fixture',path:'a.pdf'});assert.equal(pdf.ok,true);assert.equal(pdf.outcome,undefined);assert.equal(audio,1);}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
