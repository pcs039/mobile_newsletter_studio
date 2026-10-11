/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const loader=require('./canva-test-loader.cjs'),load=loader();
const {fallbackDesignConcepts,parseDesignConcepts,validateDesignConcept,buildDesignConceptInput}=load('src/lib/article-design-concept.ts');
const {buildDraftForProject}=load('src/lib/article-design-draft.ts');
const article={id:'a',title:'행사 안내',summary:'시민 참여 안내',body:'일정과 장소'.repeat(10000),articleType:'event_festival',publicInfo:{dateTime:'일시',place:'장소'},privateMetadata:'SECRET',
 blocks:[{id:'b',type:'paragraph',title:'안내',body:'기존 정보',isVisible:true,metadata:{body_design:{kind:'info'},storage_path:'SECRET'}},{type:'image',title:'기존 캡션',body:'PRIVATE_URL',isVisible:true}]};
const choices=fallbackDesignConcepts(article);
test('three distinct concepts; strict semantic allowlist rejects HEX, IDs, duplicate direction and malformed JSON',()=>{
 assert.equal(choices.length,3);assert.equal(parseDesignConcepts(JSON.stringify({concepts:choices})).length,3);
 for(const patch of [{colorDirection:'#ffffff'},{assetRole:'asset-id'},{pattern:'unknown'},{storagePath:'secret'},{name:'x'.repeat(61)}])assert.equal(validateDesignConcept({...choices[0],...patch}),null);
 assert.equal(parseDesignConcepts('invalid'),null);
 assert.equal(parseDesignConcepts(JSON.stringify({concepts:[choices[0],choices[0],choices[0]]})),null);
});
test('AI input is bounded saved text, not image/private/asset/Canva/review metadata',()=>{
 const input=buildDesignConceptInput(article);assert(input.length<6800);assert(!input.includes('SECRET'));assert(!input.includes('PRIVATE_URL'));
});
test('concept rules filter safe placements, respect colors/occupied slots; manual remains exact no-op',()=>{
 const snapshot={settings:{textDesign:{number:'100'}},placements:[],updated_at:'v',content_version:'v'};
 const asset=(id,type,overrides={})=>({id,projectId:'p',name:id,assetType:type,isActive:true,approvalStatus:'approved',mimeType:'image/svg+xml',storageBucket:'design-production-assets',storagePath:'safe.svg',metadata:{usageTags:['event'],transparency:'yes'},...overrides});
 const assets=[asset('bg','background'),asset('ill','illustration'),asset('cross','illustration',{projectId:'other'}),asset('bad','illustration',{approvalStatus:'draft'})];
 const ready={bg:['hero_background'],ill:['hero_illustration'],cross:['hero_illustration'],bad:['hero_illustration']};
 const before=JSON.stringify({article,snapshot});
 const info=buildDraftForProject('p',article,'event',assets,ready,snapshot,choices[0]);
 assert.equal(info.textDesign.bodyEmphasis,'info');assert.equal(info.placements.length,0);
 const editorial=buildDraftForProject('p',article,'event',assets,ready,snapshot,choices[1]);
 assert.equal(editorial.textDesign.bodyEmphasis,undefined);assert.deepEqual(editorial.placements.map(p=>p.assetId),['bg']);
 const friendly=buildDraftForProject('p',article,'event',assets,ready,snapshot,choices[2]);
 assert.deepEqual(friendly.placements.map(p=>p.assetId),['ill']);
 const manual=buildDraftForProject('p',article,'manual',assets,ready,snapshot,{...choices[2],pattern:'manual'});
 assert.deepEqual(manual.textDesign,{});assert.deepEqual(manual.placements,[]);assert.equal(JSON.stringify({article,snapshot}),before);
});
test('AI failure, malformed output and 429 return three read-only fallbacks; access denied stays denied',async()=>{
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';
 try{
  for(const provider of [async()=>{throw Error('provider');},async()=>new Response('{}',{status:429}),async()=>Response.json({output_text:'broken'})]){
   const {POST}=loader({
    '@/lib/project-api-access':{requireProjectApiAccess:async()=>({ok:true,user:{id:'u'},project:{id:'p',slug:'s'}})},
    '@/lib/newsletter-repository':{getProjectContent:async()=>({articles:[article]})},
    '@/lib/article-ai-provider':{articleAiRequestTimeoutMs:100,requestArticleAiResponse:provider},
   })('src/app/api/project-content/pattern-recommendation/route.ts');
   const r=await POST(new Request('http://localhost/api',{method:'POST',body:JSON.stringify({projectSlug:'s',articleId:'a',mode:'concepts'})}));
   assert.equal(r.status,200);const b=await r.json();assert.equal(b.fallback,true);assert.equal(b.concepts.length,3);
  }
  const {POST}=loader({'@/lib/project-api-access':{requireProjectApiAccess:async()=>({ok:false,response:new Response(null,{status:401})})}})('src/app/api/project-content/pattern-recommendation/route.ts');
  assert.equal((await POST(new Request('http://localhost/api',{method:'POST',body:'{}'}))).status,401);
 }finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});
test('prepare/apply refuse invalid or mismatched concept, and changed confirmation never writes',async()=>{
 const snapshot={id:'c',settings:{},placements:[],updated_at:'v',content_version:'v'};
 let writes=0;
 const {POST}=loader({
  '@/lib/project-api-access':{requireProjectApiAccess:async()=>({ok:true,project:{id:'p',slug:'s'}})},
  '@/lib/newsletter-repository':{getProjectContent:async()=>({articles:[article]}),getProjectDesignAssets:async()=>({ok:true,assets:[]})},
  '@/lib/article-design-draft-repository':{getDraftSnapshot:async()=>({ok:true,data:snapshot}),getReadyVisibleDraftAssets:async()=>({}),applyDesignDraft:async()=>{writes++;}},
 })('src/app/api/project-content/design-draft/route.ts');
 const input={projectSlug:'s',articleId:'a',action:'prepare',pattern:'event',concept:choices[0]};
 const req=p=>new Request('http://localhost/api',{method:'POST',headers:{Origin:'http://localhost'},body:JSON.stringify(p)});
 const r=await POST(req(input));assert.equal(r.status,200);const b=await r.json();
 assert.equal((await POST(req({...input,concept:{...choices[0],pattern:'manual'}}))).status,400);
 assert.equal((await POST(req({...input,concept:{...choices[0],colorDirection:'#ffffff'}}))).status,400);
 assert.equal((await POST(req({...input,action:'apply',concept:choices[1],confirmation:b.draft.confirmation}))).status,409);
 assert.equal(writes,0);
});
test('palette resolves existing safe frame tokens first and never accepts AI HEX or mutates placement settings',()=>{
 const {resolveExistingConceptColors}=load('src/lib/article-design-concept.ts');
 const snapshot={placements:[{slot:'hero_background',is_visible:true,settings:{titleColor:'#123456',bodyColor:'#334455',accentColor:'#ABCDEF'}}]};
 const before=JSON.stringify(snapshot);
 assert.deepEqual(resolveExistingConceptColors(snapshot,'#987654'),{titleColor:'#123456',bodyColor:'#334455',accentColor:'#ABCDEF'});
 assert.equal(JSON.stringify(snapshot),before);
 assert.equal(resolveExistingConceptColors({placements:[]},'javascript:evil').titleColor,'#092046');
});
