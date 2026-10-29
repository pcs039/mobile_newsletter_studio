/* eslint-disable @typescript-eslint/no-require-imports -- Isolated demo authorization/media tests; no remote calls. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const nav=loader()('src/lib/hwaseong-demo-navigation.ts');
const slug='hwaseong-2026-10-samples',p='4cd5297e-a0fd-434c-84d4-fa4d3baf9389',prefix=`projects/${p}/production/`;
test('same demo URL preserves article/display/interest and drops internal QA; no admin/project hopping',()=>{
 const href=nav.sampleDemoHref(slug,`/projects/${slug}/samples?articleId=a&view=detail&display=ebook&interest=pets&qa=1&quality=3#place-01`);
 assert.match(href,/^\/demo\?project=/);assert.match(href,/articleId=a/);assert.match(href,/display=ebook/);assert.match(href,/#place-01$/);assert.doesNotMatch(href,/qa=|quality=|\/projects\//);
 assert(nav.canUseSampleDemoHistory(href,'https://stage.invalid/demo',slug));
 for(const bad of [`https://evil.invalid${href}`,`/projects/${slug}/samples`,'/demo?project=other',`/demo?project=${slug}&project=${slug}`])assert(!nav.canUseSampleDemoHistory(bad,'https://stage.invalid/demo',slug));
});
function fixture(){
 const kinds=['policy','tourism','event','cartoon','accessible','interview','video'];
 const articles=kinds.map((kind,i)=>({id:`article-${i}`,title:kind,blocks:[{id:`block-${i}`,isVisible:true,type:'image',body:`/api/project-files/preview?bucket=design-production-assets&path=${prefix}${i}.webp`,metadata:{proposal_sample:{kind},private_note:'must not escape'}},{id:'hidden',type:'paragraph',body:'PRIVATE HIDDEN',isVisible:false,metadata:{}}],audioFile:{previewHref:'/api/projects/private'},audioSource:'ai_tts',links:[]}));
 const state={enabled:true,revoked:false,project:{id:p,slug,coverEnabled:true,coverImageUrl:`/api/project-files/preview?bucket=design-production-assets&path=${prefix}cover.webp`},articles,delivery:[],indexCalls:0};
 const access=async()=>{if(state.revoked)throw Error('revoked');return {project:state.project,share:{id:'share',article_ids:articles.map(a=>a.id)},articles:state.articles};};
 const mod=loader({
  '@/lib/demo-share':{DemoError:class extends Error{},getDemoSession:access},
  '@/lib/staging-environment':{stagingEnvironmentConfigured:()=>state.enabled},
  '@/lib/hwaseong-proposal-sample':{hwaseongSampleSlug:slug,proposalSample:a=>({article:a,cover:a.blocks[0].body,kind:a.blocks[0].metadata.proposal_sample.kind,headline:a.title,editorTest:a.test})},
  '@/lib/newsletter-repository':{getFontAssets:async()=>({fonts:[]}),makePublicStoragePreviewHref:()=>''},
  '@/lib/article-composition-repository':{getArticleTextDesigns:async()=>({}),getArticleHeroBackgroundReferences:async()=>({})},
  '@/lib/hwaseong-sample-cover-server':{prepareSampleCover:async()=>null},
  '@/lib/hwaseong-sample-toc-server':{prepareSampleMap:async()=>undefined,prepareSampleToc:async()=>({})},
  '@/lib/hwaseong-sample-split-tts-server':{splitAudioIndex:async()=>{state.indexCalls++;return Object.fromEntries(articles.map(a=>[a.id,{id:'approved',voice:'coral',manifestHref:'/api/projects/private/sample-tts?version=3&audio=approved',detail:{id:'acting-approved',voice:'coral',manifestHref:'/api/projects/private/sample-tts/acting?audio=acting-approved'}}]));},splitTtsDelivery:()=>{throw Error('unexpected v2');}},
  '@/lib/hwaseong-sample-quality-tts-server':{qualityDelivery:async(...args)=>{state.delivery.push(args);return Response.json({hasAudio:true,segments:[{index:0,url:'/api/projects/private'}]});}},
  '@/lib/hwaseong-cartoon-acting-server':{actingDelivery:async(...args)=>{state.delivery.push(args);return Response.json({hasAudio:true,segments:[{index:0,url:'/api/projects/private'}]});}},
 })('src/lib/hwaseong-demo-render.ts');
 return {state,mod};
}
test('only exact Staging/project/seven non-test article membership can render',async()=>{
 for(const change of [s=>s.enabled=false,s=>s.revoked=true,s=>s.project.id='foreign',s=>s.articles.pop(),s=>s.articles[0].test=true]){const h=fixture();change(h.state);await assert.rejects(h.mod.getHwaseongDemoAccess(slug));}
 await assert.rejects(fixture().mod.getHwaseongDemoAccess('other'));
});
test('render reuses original IDs, strips hidden/internal metadata, maps media to session-gated allowlist and never mutates source',async()=>{
 const h=fixture(),before=structuredClone(h.state.articles),d=await h.mod.getHwaseongDemoData(slug,false);
 assert.equal(d.props.samples.length,7);assert.deepEqual(d.props.samples.map(s=>s.article.id),before.map(a=>a.id));
 const payload=JSON.stringify(d.props);assert.doesNotMatch(payload,/api\/projects|api\/project-files|PRIVATE HIDDEN|private_note/);
 assert.match(payload,/api\/demo-share\/sample-files/);assert(d.files.has(`design-production-assets:${prefix}cover.webp`));assert(!d.files.has(`design-production-assets:${prefix}unreferenced.webp`));
 assert.deepEqual(h.state.articles,before);assert.equal(h.state.indexCalls,0);
});
test('audio routes reuse only current approved reader audio; pending/QA IDs are not selectable and manifest has no admin URL',async()=>{
 const h=fixture(),request=new Request('https://stage.invalid/api/demo-share/sample-audio');
 assert.equal((await h.mod.deliverHwaseongDemoAudio(slug,'foreign','summary',null,request)).status,404);
 assert.equal(h.state.indexCalls,0);
 const summary=await h.mod.deliverHwaseongDemoAudio(slug,'article-0','summary',null,request);
 const body=await summary.json();assert.match(body.segments[0].url,/\/api\/demo-share\/sample-audio\?/);assert(!JSON.stringify(body).includes('/api/projects'));
 assert.equal(h.state.delivery[0][0],'approved');assert.equal(h.state.delivery[0][3],false);
 await h.mod.deliverHwaseongDemoAudio(slug,'article-0','detail',null,request);assert.equal(h.state.delivery[1][0],'acting-approved');
 h.state.revoked=true;await assert.rejects(h.mod.deliverHwaseongDemoAudio(slug,'article-0','summary',null,request));assert.equal(h.state.delivery.length,2);
});
test('file endpoint denies guessed/unreferenced path and revoked session before any Storage lookup',async()=>{
 let storage=0;const old=global.fetch;global.fetch=async()=>{storage++;throw Error('must not fetch');};
 try{for(const revoked of [false,true]){
  const route=loader({'@/lib/hwaseong-demo-render':{getHwaseongDemoData:async()=>{if(revoked)throw Error();return {access:{project:{id:p}},files:new Set(),fontPaths:new Set()};}},'@/lib/demo-share':{demoHeaders:{'Cache-Control':'private, no-store'}},'@/lib/supabase-config':{getSupabaseRestEndpoint:()=>'',getSupabaseStorageEndpoint:()=>''}})('src/app/api/demo-share/sample-files/route.ts');
  const r=await route.GET(new Request(`https://stage.invalid/api/demo-share/sample-files?project=${slug}&bucket=design-production-assets&path=${prefix}unreferenced.webp`));assert.equal(r.status,revoked?410:404);assert.equal(r.headers.get('cache-control'),'private, no-store');
 }}finally{global.fetch=old;}assert.equal(storage,0);
});
test('recipient endpoint cannot request provider status, QA review, generation or arbitrary audio IDs',async()=>{
 let calls=0;const route=loader({'@/lib/hwaseong-demo-render':{deliverHwaseongDemoAudio:async()=>{calls++;return new Response();}},'@/lib/demo-share':{demoHeaders:{}}})('src/app/api/demo-share/sample-audio/route.ts');
 for(const extra of ['&audio=pending','&review=1','&provider=check','&version=3','&part=detail'])assert.equal((await route.GET(new Request(`https://stage.invalid/api/demo-share/sample-audio?project=${slug}&article=a&part=summary${extra}`))).status,404);
 assert.equal(calls,0);assert.equal(route.POST,undefined);
});
test('14-day validity is available only for this Staging sample; generic/Production demo policy is unchanged',()=>{
 for(const enabled of [false,true]){const m=loader({'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>enabled}})('src/lib/demo-share.ts');assert.deepEqual(m.demoDurations(slug),enabled?[1,3,7,14]:[1,3,7]);assert.deepEqual(m.demoDurations('other'),[1,3,7]);}
});
