/* eslint-disable @typescript-eslint/no-require-imports -- Isolated receipts and local network fixtures only. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const loader=require('./canva-test-loader.cjs'),load=loader();
const {CompositionCopySafety}=load('src/lib/composition-copy-safety.ts');
const {CompositionCopyStatus}=load('src/components/design/composition-copy-status.tsx');
const tick=()=>new Promise(r=>setImmediate(r));
const comp=(id='source',patch={})=>({id:'c-'+id,articleId:id,projectId:'project',status:'ready',updatedAt:'1',settings:{textDesign:{label:'보존'},productionPattern:'manual'},assets:[{id:'p1',slot:'hero_background',assetId:'a1',settings:{rotation:20},isVisible:true},{id:'p2',slot:'hero_illustration',assetId:'a2',settings:{opacity:.5},isVisible:true}],...patch});
const source=()=>({ok:true,composition:comp(),assets:[{id:'a1',name:'배경',approvalStatus:'draft',isActive:true,updated:'1'},{id:'a2',name:'장식',approvalStatus:'approved',isActive:true,updated:'1'}]});
const response=(data,ok=true)=>({ok,json:async()=>structuredClone(data)});
function fixture(single=true,options={}) {
 const records=new Map(),storage={getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};
 const calls=[],state={source:source(),post:null,failGet:false};
 const request=async(url,init={})=>{
  calls.push({url,init});
  if(init.method==='POST') {
   if(state.post)return state.post(url,init);
   return response({ok:true,copyOutcome:'success',...(single?{composition:comp('target',{status:'draft'})}:{result:{sourceArticleId:'source',targetArticleCount:2}})});
  }
  if(state.failGet)throw Error('network');
  const id=new URL(url,'https://fixture.invalid').searchParams.get('articleId');
  return response(id==='source'?state.source:{ok:true,composition:comp(id),assets:[]});
 };
 const engine=new CompositionCopySafety('project',()=>{},request,()=>storage,options.timeout??50);
 const targets=single?['target']:['target','target2'];
 return {engine,targets,state,calls,storage,records,request,run:()=>engine.copy(targets,single,()=>true),posts:()=>calls.filter(c=>c.init.method==='POST')};
}
for(const single of [true,false]) {
 const kind=single?'single':'batch';
 test(`${kind}: multiple placements, scope, approval and explicit success preserve input`,async()=>{
  const h=fixture(single),before=JSON.stringify(h.state.source);await h.engine.selectSource('source');
  const html=renderToStaticMarkup(React.createElement(CompositionCopyStatus,{safety:h.engine}));
  for(const value of ['2개','배경판','상단 이미지','Draft','Approved','HTML 텍스트 디자인','글꼴','제작 패턴','draft'])assert(html.includes(value),value);
  const result=await h.run();assert(result);assert.equal(h.posts().length,1);assert.equal(h.engine.phase,'success');assert.equal(h.records.size,0);assert.equal(JSON.stringify(h.state.source),before);
  const payload=JSON.parse(h.posts()[0].init.body);assert.equal(payload.action,single?'copy_composition':'copy_compositions_batch');assert(!('settings'in payload));assert(!('body'in payload));
 });
 test(`${kind}: zero placements and failed source reads never POST`,async()=>{
  const h=fixture(single);h.state.source.composition.assets=[];await h.engine.selectSource('source');assert.equal(h.engine.phase,'empty');assert(!h.engine.canCopy);await h.run();assert.equal(h.posts().length,0);
  h.state.failGet=true;await h.engine.selectSource('source');assert.equal(h.engine.phase,'rejected');await h.run();assert.equal(h.posts().length,0);
 });
 test(`${kind}: empty/changed/preflight failure blocks execution and needs renewed confirmation`,async()=>{
  for(const change of ['empty','changed','failed']) {
   const h=fixture(single);await h.engine.selectSource('source');
   if(change==='empty')h.state.source.composition.assets=[];
   if(change==='changed')h.state.source.composition.assets[0].settings.rotation=30;
   if(change==='failed')h.state.failGet=true;
   await h.run();assert.equal(h.posts().length,0);assert.notEqual(h.engine.phase,'success');
   if(change==='changed'){assert.equal(h.engine.phase,'ready');assert(await h.run());assert.equal(h.posts().length,1);}
  }
 });
 test(`${kind}: explicit rejection is retryable only by another confirmed action`,async()=>{
  const h=fixture(single);await h.engine.selectSource('source');h.state.post=()=>response({ok:false,copyOutcome:'rejected',message:'서버 거절'},false);
  await h.run();assert.equal(h.engine.phase,'rejected');assert.equal(h.records.size,0);assert.equal(h.posts().length,1);await tick();assert.equal(h.posts().length,1);
 });
 test(`${kind}: lost response/post-write read failure remains unknown after successful inspection and remount`,async()=>{
  for(const fail of ['lost','read-failed','unclassified']) {
   const h=fixture(single);await h.engine.selectSource('source');h.state.post=()=>{
    if(fail==='lost')throw Error('lost');
    return response({ok:false,copyOutcome:fail==='read-failed'?'unknown':undefined,message:'저장본 조회 실패'},false);
   };
   await h.run();assert(h.engine.locked);assert(h.engine.affectsArticle('target'));assert(!h.engine.affectsArticle('unrelated'));await h.engine.inspectSaved();assert(h.engine.locked);assert.equal(h.engine.savedChecks.length,h.targets.length);await h.run();await h.engine.selectSource('different');assert.equal(h.posts().length,1);
   const restored=new CompositionCopySafety('project',()=>{},h.request,()=>h.storage);restored.restore();assert(restored.locked);await restored.inspectSaved();assert(restored.locked);
   h.state.failGet=true;await h.engine.inspectSaved();assert(h.engine.locked);assert.match(h.engine.message,/조회에도 실패/);assert(!h.engine.message.includes('취소되어'));
  }
 });
 test(`${kind}: abort timeout and late success cannot turn unknown into confirmed success`,async()=>{
  for(const late of [false,true]) {
   const h=fixture(single,{timeout:5});await h.engine.selectSource('source');h.state.post=(_u,{signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>late?setTimeout(()=>resolve(response({ok:true,copyOutcome:'success',composition:comp('target'),result:{sourceArticleId:'source',targetArticleCount:2}})),1):reject(Error('abort')));
   });
   await h.run();assert(h.engine.locked);assert.equal(h.posts().length,1);await h.run();assert.equal(h.posts().length,1);
  }
 });
 test(`${kind}: duplicate clicks coalesce; leaving while POST is pending retains uncertainty marker`,async()=>{
  const h=fixture(single);await h.engine.selectSource('source');let finish;h.state.post=()=>new Promise(r=>finish=r);
  const first=h.run(),second=h.run();await tick();assert.equal(await second,null);assert.equal(h.posts().length,1);h.engine.dispose();finish(response({ok:true,copyOutcome:'success',composition:comp('target'),result:{sourceArticleId:'source',targetArticleCount:2}}));assert.equal(await first,null);assert.equal(h.records.size,1);
 });
}
test('source response reversal and Strict Mode cleanup do not overwrite the next selection',async()=>{
 let resolve;const h=fixture();const old=h.request;
 const engine=new CompositionCopySafety('project',()=>{},(url,init)=>url.includes('articleId=old')?new Promise(r=>resolve=r):old(url,init),()=>h.storage);
 const first=engine.selectSource('old');await engine.selectSource('source');resolve(response({ok:true,composition:comp('old'),assets:[]}));await first;assert.equal(engine.source.composition.articleId,'source');engine.dispose();engine.activate();await engine.selectSource('source');assert(engine.canCopy);
});

test('repository distinguishes a known RPC rejection from RPC success followed by failed saved lookup',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY,oldError=console.error;
 process.env.SUPABASE_SERVICE_ROLE_KEY='isolated-fixture-only';console.error=()=>{};
 const repo=loader({'@/lib/supabase-config':{getSupabaseConfigStatus:()=>({isConfigured:true,hasServiceRoleKey:true}),getSupabaseRestEndpoint:p=>'https://fixture.invalid'+p}})('src/lib/article-composition-repository.ts');
 try {
  for(const batch of [false,true]) {
   const run=()=>batch?repo.copyProjectArticleCompositionsBatch({projectId:'p',sourceArticleId:'s',targetArticleIds:['t']}):repo.copyProjectArticleComposition({projectId:'p',sourceArticleId:'s',targetArticleId:'t'});
   global.fetch=async()=>new Response(JSON.stringify({message:batch?'composition_batch_copy_project_mismatch':'composition_copy_project_mismatch'}),{status:409});
   assert.equal((await run()).copyOutcome,'rejected');
   global.fetch=async(url)=>url.includes('/rpc/')?new Response(JSON.stringify(batch?{source_article_id:'s',target_article_count:1,source_placement_count:2,copied_placement_count:2}:{ok:true,composition_id:'c',copied_placement_count:2})):new Response('[]');
   const result=await run();assert.equal(result.copyOutcome,batch?'success':'unknown');
   global.fetch=async()=>{throw Error('transport lost');};assert.equal((await run()).copyOutcome,'unknown');
  }
 } finally {global.fetch=oldFetch;console.error=oldError;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});

test('copy API exposes outcomes without treating post-write lookup failure as an explicit rejection',async()=>{
 let outcome='unknown',denied=false;
 const repo={getProjectArticleComposition:async()=>({status:'ok',data:comp('target')}),copyProjectArticleComposition:async()=>({status:'not_found',data:null,message:'저장본 조회 실패',copyOutcome:outcome}),copyProjectArticleCompositionsBatch:async()=>({status:'request_failed',data:null,message:'결과 확인 필요',copyOutcome:outcome})};
 const route=loader({'@/lib/article-composition-repository':repo,'@/lib/project-api-access':{requireProjectApiAccess:async()=>denied?{ok:false,response:Response.json({ok:false},{status:403})}:{ok:true,project:{id:'project',slug:'project'}}},'@/lib/newsletter-repository':{getProjectContent:async()=>({articles:[{id:'target'}]}),getProjectDesignAssets:async()=>({ok:true,assets:[]})}})('src/app/api/project-article-composition/route.ts');
 for(const action of ['copy_composition','copy_compositions_batch']) {
  const run=()=>route.POST(new Request('https://fixture.invalid/api/project-article-composition',{method:'POST',body:JSON.stringify({action,projectSlug:'project',articleId:'target',sourceArticleId:'source',targetArticleIds:['target']})}));
  outcome='unknown';assert.equal((await(await run()).json()).copyOutcome,'unknown');
  outcome='rejected';assert.equal((await(await run()).json()).copyOutcome,'rejected');
  denied=true;const response=await run();assert.equal(response.status,403);assert.equal((await response.json()).copyOutcome,'rejected');denied=false;
 }
});

const nodes=(t,p)=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(x=>nodes(x,p)):[...(p(t)?[t]:[]),...nodes(t.props?.children,p)];
const label=t=>t==null||typeof t==='boolean'?'':typeof t!=='object'?String(t):Array.isArray(t)?t.map(label).join(''):label(t.props?.children);
function uiHooks(){let cursor=0;const states=[];return {reset(){cursor=0;},hooks:{...React,useState(v){const n=cursor++;if(!(n in states))states[n]=typeof v==='function'?v():v;return[states[n],v=>states[n]=typeof v==='function'?v(states[n]):v];},useRef(v){const n=cursor++;return states[n]??(states[n]={current:v});},useMemo:f=>f(),useEffect:()=>{}}};}
test('single editor preserves its draft receipt flow and blocks copy while layout is unsettled/unknown',async()=>{
 const h=fixture(),hooks=uiHooks(),saved={composition:comp('target'),saved:comp('target'),busy:false,layoutStatus:'saved',textStatus:'dirty',hasUnsaved:true,acceptApplied(value){this.composition={...value,settings:{textDesign:{label:'로컬 초안'}}};}};
 const UI=loader({react:hooks.hooks,'@/components/design/article-canva-templates':{ArticleCanvaTemplates:()=>null},'@/components/design/article-production-pattern-controls':{ArticleProductionPatternControls:()=>null},'@/components/design/composition-copy-status':{useCompositionCopySafety:()=>h.engine,CompositionCopyStatus:()=>null},'@/components/design/use-composition-save-state':{useCompositionSaveState:()=>saved}})('src/components/design/article-composition-editor.tsx').ArticleCompositionEditor;
 const props={article:{id:'target',title:'대상'},assets:[],initialComposition:comp('target'),initialStatus:'ok',projectSlug:'project',previewArticle:{id:'target'},reuseSources:[{id:'source',hasComposition:true,title:'원본'}]};
 const panel=()=>{hooks.reset();const session=UI(props),tree=session.type(session.props);const child=nodes(tree,e=>typeof e.type==='function'&&e.type.name==='DesignReusePanel')[0];return child.type(child.props);};
 const action=()=>nodes(panel(),e=>e.type==='button'&&label(e)==='디자인 적용')[0];
 await h.engine.selectSource('source');saved.layoutStatus='dirty';assert(action().props.disabled);saved.layoutStatus='saved';assert(!action().props.disabled);
 const previous=global.window;global.window={confirm:()=>true};try{await action().props.onClick();await tick();assert.equal(h.posts().length,1);assert.equal(saved.composition.settings.textDesign.label,'로컬 초안');
 h.engine.phase='unknown';assert(action().props.disabled);
 }finally{global.window=previous;}
});
test('batch UI uses the same source guard and retains selected targets when result is unknown',async()=>{
 const h=fixture(false),hooks=uiHooks();let refresh=0;
 const UI=loader({react:hooks.hooks,'next/navigation':{useRouter:()=>({refresh(){refresh++;}})},'@/components/design/composition-copy-status':{useCompositionCopySafety:()=>h.engine,CompositionCopyStatus:()=>null}})('src/components/design/issue-design-batch-apply.tsx').IssueDesignBatchApply;
 const props={projectSlug:'project',articles:['source','target','target2'].map(id=>({id,title:id,hasComposition:true}))};
 const render=()=>{hooks.reset();return UI(props);},button=()=>nodes(render(),e=>e.type==='button'&&['선택 기사에 디자인 적용','결과 확인 필요 · 재실행 잠김'].includes(label(e)))[0];
 await h.engine.selectSource('source');for(const checkbox of nodes(render(),e=>e.type==='input'))checkbox.props.onChange();assert(!button().props.disabled);
 const previous=global.window;global.window={confirm:()=>true};h.state.post=()=>{throw Error('lost');};
 try{button().props.onClick();await tick();assert(h.engine.locked);assert(button().props.disabled);assert.equal(nodes(render(),e=>e.type==='input'&&e.props.checked).length,2);assert.equal(refresh,0);assert.equal(h.posts().length,1);}finally{global.window=previous;}
});

test('unchanged single/batch RPCs preserve article content, target text settings and source placements in isolated SQL',{skip:!process.env.CANVA_SQL_TEST_RUNTIME},async()=>{
 const {PGlite}=require(process.env.CANVA_SQL_TEST_RUNTIME),fs=require('node:fs'),db=new PGlite();
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,project=id(1),sourceId=id(2),target=id(3),target2=id(4);
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
   create function auth.role() returns text language sql as $$select 'service_role'::text$$;
   create table newsletter_articles(id uuid primary key,project_id uuid,title text,body text);
   create table newsletter_content_blocks(id uuid,article_id uuid,body text);
   create table newsletter_link_actions(id uuid,article_id uuid,target_value text);
   create table newsletter_article_compositions(id uuid primary key default gen_random_uuid(),project_id uuid,article_id uuid unique,layout_key text,status text,settings jsonb);
   create table newsletter_article_composition_assets(id uuid primary key default gen_random_uuid(),composition_id uuid references newsletter_article_compositions(id),asset_id uuid,slot text,sort_order int,is_visible boolean,settings jsonb);
   insert into newsletter_articles values('${sourceId}','${project}','원본 제목','원본 본문'),('${target}','${project}','대상 제목','보존할 본문'),('${target2}','${project}','대상2','보존할 본문2');
   insert into newsletter_content_blocks values('${id(5)}','${target}','보존 문단');insert into newsletter_link_actions values('${id(6)}','${target}','https://example.com');
   insert into newsletter_article_compositions values('${id(10)}','${project}','${sourceId}','source-layout','ready','{"textDesign":{"label":"원본"},"productionPattern":"source"}'),('${id(11)}','${project}','${target}','target-layout','ready','{"textDesign":{"label":"대상"},"productionPattern":"target"}');
   insert into newsletter_article_composition_assets values('${id(20)}','${id(10)}','${id(30)}','hero_background',10,true,'{"rotation":20}'),('${id(21)}','${id(10)}','${id(31)}','hero_illustration',20,false,'{"opacity":0.5}'),('${id(22)}','${id(11)}','${id(32)}','hero_background',0,true,'{}');`);
  for(const file of ['supabase/schema_v1_27_article_composition_copy.sql','supabase/schema_v1_28_article_composition_batch_copy.sql'])await db.exec(fs.readFileSync(file,'utf8'));
  const content=async()=>JSON.stringify((await db.query(`select (select jsonb_agg(a order by id) from newsletter_articles a) articles,(select jsonb_agg(b) from newsletter_content_blocks b) blocks,(select jsonb_agg(l) from newsletter_link_actions l) links`)).rows);
  const before=await content(),sourceBefore=JSON.stringify((await db.query('select * from newsletter_article_composition_assets where composition_id=$1 order by id',[id(10)])).rows);
  await db.query('select copy_newsletter_article_composition_atomic($1,$2,$3)',[project,sourceId,target]);
  assert.equal((await db.query('select count(*)::int n from newsletter_article_composition_assets where composition_id=$1',[id(11)])).rows[0].n,2);
  await db.query('select copy_newsletter_article_compositions_batch_atomic($1,$2,$3)',[project,sourceId,[target,target2]]);
  assert.equal(await content(),before);assert.equal(JSON.stringify((await db.query('select * from newsletter_article_composition_assets where composition_id=$1 order by id',[id(10)])).rows),sourceBefore);
  const saved=(await db.query('select * from newsletter_article_compositions where article_id=$1',[target])).rows[0];assert.equal(saved.status,'draft');assert.equal(saved.layout_key,'target-layout');assert.equal(saved.settings.textDesign.label,'대상');assert.equal(saved.settings.productionPattern,'target');
 }finally{await db.close();}
});
