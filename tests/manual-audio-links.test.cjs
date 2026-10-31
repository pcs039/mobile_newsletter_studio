/* eslint-disable @typescript-eslint/no-require-imports -- Isolated RPC/API/UI mocks, no remote writes or provider calls. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const loader=require('./canva-test-loader.cjs');
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const state={revision:'a'.repeat(32),articleId:null,transcriptText:'keep script',transcriptType:'custom_script',transcriptReviewStatus:'approved',transcriptReviewNote:'keep note'};
const input={projectSlug:'fixture',audioId:id(7),articleId:id(3),expectedRevision:state.revision};
const access={ok:true,project:{id:id(1)},user:{id:'server-user',name:'writer',role:'user'}};
function api(accessValue=access){return loader({
 '@/lib/project-api-access':{requireProjectApiAccess:async()=>accessValue},
 '@/lib/article-image-api-origin':{requireImageSameOrigin:r=>{if(r.headers.get('origin')!=='https://fixture.local')throw Error('origin');}},
 '@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://db.invalid'+p},
})('src/app/api/project-audio-links/route.ts');}
const request=body=>new Request('https://fixture.local/api/project-audio-links',{method:'POST',headers:{origin:'https://fixture.local','Content-Type':'application/json'},body:JSON.stringify(body)});
const nodes=(tree,p)=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(t=>nodes(t,p)):[...(p(tree)?[tree]:[]),...nodes(tree.props?.children,p)];
const text=tree=>typeof tree==='string'?tree:Array.isArray(tree)?tree.map(text).join(''):text(tree?.props?.children??'');
const button=(tree,label)=>nodes(tree,e=>e.type==='button'&&text(e)===label)[0];
const flush=()=>new Promise(r=>setImmediate(r));
function ui(){const states=[];let cursor=0,refreshes=0;const hooks={...React,useState(v){const i=cursor++;if(!(i in states))states[i]=v;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useRef(v){const i=cursor++;if(!(i in states))states[i]={current:v};return states[i];}};
 const {ProjectAudioLinkManager}=loader({react:hooks,'next/navigation':{useRouter:()=>({refresh:()=>refreshes++})}})('src/components/project-audio-link-manager.tsx');
 const props={articles:[{id:id(3),label:'manual',body:'body',summary:'summary',audioSource:'none'},{id:id(4),label:'AI',body:'body',audioSource:'ai_tts'}],audioId:id(7),currentArticleId:null,projectSlug:'fixture',transcriptText:'stale',transcriptType:'custom_script',transcriptReviewStatus:'pending',transcriptReviewNote:'stale'};
 return{render(){cursor=0;return ProjectAudioLinkManager(props);},refreshes:()=>refreshes};}

test('manual audio server/API boundaries',{concurrency:false},async t=>{
 const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='mock-service-key';
 try{
  await t.test('authenticated GET snapshot uses only one service RPC and server actor',async()=>{
   const calls=[];global.fetch=async(url,options)=>{calls.push({url,...options});return Response.json({ok:true,state});};
   const r=await api().GET(new Request(`https://fixture.local/api/project-audio-links?projectSlug=fixture&audioId=${id(7)}`));
   assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(calls.length,1);assert(calls[0].url.endsWith('/rpc/manage_newsletter_manual_audio_link'));
   const body=JSON.parse(calls[0].body);assert.equal(body.p_changes,null);assert.equal(body.p_actor_id,'server-user');assert.equal(body.p_project_id,id(1));assert(!JSON.stringify(await r.json()).includes('mock-service-key'));
  });
  await t.test('save uses one RPC, preserves absent metadata, ignores forged actor/project ID',async()=>{
   const calls=[];global.fetch=async(url,o)=>{calls.push({url,...o});return Response.json({ok:true,duplicate:false});};
   assert.equal((await api().POST(request({...input,actorId:'attacker',projectId:id(99)}))).status,200);
   assert.equal(calls.length,1);const body=JSON.parse(calls[0].body);assert.deepEqual(body.p_changes,{});assert.equal(body.p_actor_id,'server-user');assert.equal(body.p_project_id,id(1));assert.equal(calls[0].method,'POST');
  });
  await t.test('invalid revision/id/enum, excessive text and cross-origin rejected before any DB call',async()=>{
   global.fetch=async()=>{throw Error('unexpected database request');};
   for(const body of [{...input,expectedRevision:''},{...input,audioId:'bad'},{...input,articleId:''},{...input,transcriptReviewStatus:'forged'},{...input,transcriptText:'x'.repeat(100001)}])assert.equal((await api().POST(request(body))).status,400);
   assert.equal((await api().POST(new Request('https://fixture.local/api/project-audio-links',{method:'POST',body:JSON.stringify(input)}))).status,403);
  });
  await t.test('unauthorized project is blocked for read and write',async()=>{
   global.fetch=async()=>{throw Error('unexpected database request');};const blocked=api({ok:false,response:Response.json({ok:false},{status:403})});
   assert.equal((await blocked.POST(request(input))).status,403);assert.equal((await blocked.GET(new Request(`https://fixture.local/api/project-audio-links?projectSlug=fixture&audioId=${id(7)}`))).status,403);
  });
  await t.test('missing RPC fails closed without old PATCH fallback',async()=>{
   let count=0;global.fetch=async()=>{count++;return Response.json({code:'PGRST202'},{status:404});};const r=await api().POST(request(input));assert.equal(r.status,503);assert.equal((await r.json()).code,'schema_required');assert.equal(count,1);
  });
  await t.test('CAS and selected AI errors are distinct and safe',async()=>{
   for(const [message,code] of [['manual_audio_conflict','conflict'],['manual_audio_ai_selected','ai_selected']]){global.fetch=async()=>Response.json({message},{status:409});const r=await api().POST(request(input));assert.equal(r.status,409);assert.equal((await r.json()).code,code);}
  });
  await t.test('explicit PostgreSQL deadlock/serialization aborts are known conflicts, not unknown outcomes',async()=>{
   for(const code of ['40P01','40001']){let count=0;global.fetch=async()=>{count++;return Response.json({code,message:'aborted transaction'},{status:500});};const r=await api().POST(request(input));const body=await r.json();assert.equal(r.status,409);assert.equal(body.code,'conflict');assert.equal(body.uncertain,false);assert.equal(count,1);}
  });
  await t.test('network, response body interruption and malformed response never retry automatically',async()=>{
   for(const response of [async()=>{throw Error('network');},async()=>({ok:true,text:async()=>{throw Error('body');}}),async()=>new Response('bad'),async()=>Response.json({ok:true})]){let count=0;global.fetch=async()=>{count++;return response();};const r=await api().POST(request(input));const data=await r.json();assert.equal(r.status,502);assert(data.uncertain);assert.equal(count,1);assert(!JSON.stringify(data).includes('mock-service-key'));}
  });
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});

test('manual audio UI state and explicit retry',{concurrency:false},async t=>{
 const oldFetch=global.fetch;
 try{
  await t.test('open loads authoritative state; AI targets disabled; save double click sends once',async()=>{
   const calls=[];let finish;global.fetch=async(url,o)=>{calls.push({url,...o});return o?.method==='POST'?new Promise(r=>finish=r):Response.json({ok:true,state});};
   const h=ui();button(h.render(),'연결 관리').props.onClick();await flush();let tree=h.render();assert.equal(nodes(tree,e=>e.type==='textarea')[0].props.value,'keep script');assert(nodes(tree,e=>e.type==='option'&&e.props.value===id(4))[0].props.disabled);
   nodes(tree,e=>e.type==='select')[0].props.onChange({target:{value:id(3)}});tree=h.render();button(tree,'대본/연결 저장').props.onClick();button(tree,'대본/연결 저장').props.onClick();await flush();assert.equal(calls.filter(x=>x.method==='POST').length,1);assert(nodes(h.render(),e=>e.type==='fieldset')[0].props.disabled);
   const body=JSON.parse(calls.at(-1).body);assert.equal(body.expectedRevision,state.revision);assert.equal(body.transcriptText,'keep script');assert.equal(body.articleId,id(3));finish(Response.json({ok:true,duplicate:false}));await flush();assert.equal(h.refreshes(),1);
  });
  await t.test('unknown result locks edits and retries the exact payload only after user action',async()=>{
   const calls=[];let n=0;global.fetch=async(url,o)=>{if(o?.method!=='POST')return Response.json({ok:true,state});calls.push(o.body);if(++n===1)throw Error('response lost');return Response.json({ok:true,duplicate:true});};
   const h=ui();button(h.render(),'연결 관리').props.onClick();await flush();button(h.render(),'대본/연결 저장').props.onClick();await flush();assert.equal(calls.length,1);let tree=h.render();assert(nodes(tree,e=>e.type==='fieldset')[0].props.disabled);assert(!button(tree,'최신 상태 불러오기 · 입력 초기화'));button(tree,'같은 저장 요청 결과 확인').props.onClick();await flush();assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);assert.equal(h.refreshes(),1);
  });
  await t.test('conflict keeps draft but blocks writes until explicit reload; missing migration cannot save',async()=>{
   let mode='read';global.fetch=async(url,o)=>o?.method==='POST'?Response.json({ok:false,code:'conflict',message:'changed'},{status:409}):mode==='read'?Response.json({ok:true,state}):Response.json({ok:false,message:'DB 적용 필요'},{status:503});
   const h=ui();button(h.render(),'연결 관리').props.onClick();await flush();nodes(h.render(),e=>e.type==='textarea')[0].props.onChange({target:{value:'draft'}});button(h.render(),'대본/연결 저장').props.onClick();await flush();assert.equal(nodes(h.render(),e=>e.type==='textarea')[0].props.value,'draft');assert(nodes(h.render(),e=>e.type==='fieldset')[0].props.disabled);
   mode='unavailable';button(h.render(),'최신 상태 불러오기 · 입력 초기화').props.onClick();await flush();assert(nodes(h.render(),e=>e.type==='fieldset')[0].props.disabled);assert.match(text(h.render()),/DB 적용 필요/);
  });
 }finally{global.fetch=oldFetch;}
});
