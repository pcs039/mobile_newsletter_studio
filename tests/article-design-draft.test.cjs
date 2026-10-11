/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./canva-test-loader.cjs')();
const {buildDraftForProject}=load('src/lib/article-design-draft.ts');
const snapshot={id:'c',settings:{textDesign:{number:'100'},custom:true},status:'ready',updated_at:'version',placements:[],content_version:'content'};
const article={publicInfo:{dateTime:'2026-10-25',place:'광장'},blocks:[{id:'b',type:'paragraph',body:'내용',title:'안내',isVisible:true,metadata:{body_design:{kind:'info'}}},{id:'q',type:'paragraph',body:'인용',title:'',isVisible:true,metadata:{body_design:{kind:'quote'}}},{type:'image',title:'기존 캡션',isVisible:true}],title:'제목'};
const asset=(id,source='manual',overrides={})=>({id,projectId:'p',name:id,assetType:'illustration',approvalStatus:'approved',isActive:true,storageBucket:'design-production-assets',storagePath:'internal.svg',mimeType:'image/svg+xml',metadata:{source,usageTags:['event','interview'],transparency:'yes'},...overrides});
test('event/policy/interview use only existing content; manual is an exact no-op',()=>{
 const before=JSON.stringify(article);
 for(const [pattern,emphasis] of [['event','info'],['policy','info'],['interview','quote']]){
  const d=buildDraftForProject('p',article,pattern,[],{},snapshot);assert.equal(d.textDesign.bodyEmphasis,emphasis);assert.equal(d.textDesign.captionStyled,true);
 }
 const d=buildDraftForProject('p',article,'manual',[asset('a')],{a:['hero_illustration']},snapshot);assert.deepEqual(d.textDesign,{});assert.deepEqual(d.placements,[]);assert.equal(JSON.stringify(article),before);
});
test('absent/hidden/disabled info, quote and caption do not enable nonexistent elements',()=>{
 const a={...article,blocks:[{...article.blocks[0],isVisible:false},{...article.blocks[1],metadata:{body_design:{kind:'quote',enabled:false}}},{...article.blocks[2],title:''}]};
 for(const p of ['event','interview']){const d=buildDraftForProject('p',a,p,[],{},snapshot);assert.equal(d.textDesign.bodyEmphasis,undefined);assert.equal(d.textDesign.captionStyled,undefined);}
});
test('same-project, approved, active, ready/visible, compatible web assets only',()=>{
 for(const patch of [{projectId:'other'},{approvalStatus:'draft'},{isActive:false},{assetType:'banner'},{mimeType:'application/pdf'},{storagePath:'../secret'},{metadata:{usageTags:['event'],transparency:'unknown'}}]){
  assert.equal(buildDraftForProject('p',article,'event',[asset('a','manual',patch)],{a:['hero_illustration']},snapshot).placements.length,0);
 }
 assert.equal(buildDraftForProject('p',article,'event',[asset('a')],{},snapshot).placements.length,0);
});
test('provider/source does not bias selection, including Canva provenance; ambiguity skips placement',()=>{
 for(const source of ['manual','adobe','canva','openai','institution']) {
  const a=asset('a',source);if(source==='canva')a.metadata.canvaExport={designId:'Dexample',format:'png'};
  assert.equal(buildDraftForProject('p',article,'event',[a],{a:['hero_illustration']},snapshot).placements[0].assetId,'a');
 }
 assert.equal(buildDraftForProject('p',article,'event',[asset('a'),asset('b','canva')],{a:['hero_illustration'],b:['hero_illustration']},snapshot).placements.length,0);
});
test('occupied slots, colors, subtitle, number, and content are preserved; policy favors readability',()=>{
 const existing={...snapshot,placements:[{slot:'hero_illustration',is_visible:false}]};
 const before=JSON.stringify(existing);assert.equal(buildDraftForProject('p',article,'event',[asset('a')],{a:['hero_illustration']},existing).placements.length,0);
 assert.equal(JSON.stringify(existing),before);assert.equal(buildDraftForProject('p',article,'policy',[asset('a')],{a:['hero_illustration']},snapshot).placements.length,0);
});
test('prepare/apply route rechecks saved state and refuses altered confirmation before RPC write',async()=>{
 const {POST}=require('./canva-test-loader.cjs')({
  '@/lib/project-api-access':{requireProjectApiAccess:async()=>({ok:true,project:{id:'p',slug:'slug'}})},
  '@/lib/newsletter-repository':{getProjectContent:async()=>({articles:[{...article,id:'a'}]}),getProjectDesignAssets:async()=>({ok:true,assets:[]})},
  '@/lib/article-composition-repository':{getProjectArticleComposition:async()=>({status:'ok',data:{id:'c'}})},
  '@/lib/article-design-draft-repository':{getDraftSnapshot:async()=>({ok:true,data:snapshot}),getReadyVisibleDraftAssets:async()=>({}),applyDesignDraft:async()=>{throw Error('must not write');}},
 })('src/app/api/project-content/design-draft/route.ts');
 const req=p=>new Request('http://localhost/api/project-content/design-draft',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify(p)});
 const input={projectSlug:'slug',articleId:'a',pattern:'event',action:'prepare'};
 const result=await POST(req(input));assert.equal(result.status,200);const body=await result.json();assert(body.draft.confirmation);assert(!JSON.stringify(body).includes('content_version'));
 assert.equal((await POST(req({...input,action:'apply',confirmation:'tampered'}))).status,409);
 assert.equal((await POST(req({...input,pattern:'evil'}))).status,400);
 const crossOrigin=new Request('http://localhost/api/project-content/design-draft',{method:'POST',headers:{Origin:'http://evil.example'},body:'{}'});assert.equal((await POST(crossOrigin)).status,403);
});
test('Vercel configuration never permits a missing Origin or spoofed forwarded host',async()=>{
 const old=process.env.VERCEL;process.env.VERCEL='1';
 try {
  const {POST}=require('./canva-test-loader.cjs')({'@/lib/site-url':{getCanonicalSiteOrigin:()=>''}})('src/app/api/project-content/design-draft/route.ts');
  assert.equal((await POST(new Request('https://preview.vercel.app/api/project-content/design-draft',{method:'POST',body:'{}'}))).status,403);
  assert.equal((await POST(new Request('https://preview.vercel.app/api/project-content/design-draft',{method:'POST',headers:{Origin:'https://attacker.example','x-forwarded-host':'attacker.example'},body:'{}'}))).status,403);
 } finally {if(old===undefined)delete process.env.VERCEL;else process.env.VERCEL=old;}
});
test('a changed saved snapshot during prepare rejects the proposal without applying',async()=>{
 let reads=0,writes=0;
 const {POST}=require('./canva-test-loader.cjs')({
  '@/lib/project-api-access':{requireProjectApiAccess:async()=>({ok:true,project:{id:'p',slug:'slug'}})},
  '@/lib/newsletter-repository':{getProjectContent:async()=>({articles:[{...article,id:'a'}]}),getProjectDesignAssets:async()=>({ok:true,assets:[]})},
  '@/lib/article-design-draft-repository':{getDraftSnapshot:async()=>({ok:true,data:{...snapshot,updated_at:String(++reads)}}),getReadyVisibleDraftAssets:async()=>({}),applyDesignDraft:async()=>{writes++;}},
 })('src/app/api/project-content/design-draft/route.ts');
 const response=await POST(new Request('http://localhost/api/project-content/design-draft',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({projectSlug:'slug',articleId:'a',pattern:'event',action:'prepare'})}));
 assert.equal(response.status,409);assert.equal(writes,0);
});
