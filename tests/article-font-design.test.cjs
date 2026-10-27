/* eslint-disable @typescript-eslint/no-require-imports -- Isolated API/repository tests, no remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const id='5389c81c-4694-5312-a281-28dcc6365a3a',aid='f53cd21a-d55f-48be-af2e-2f656a8fc8f6',pid='4cd5297e-a0fd-434c-84d4-fa4d3baf9389';
const api=loader()('src/lib/article-font-design.ts');
const face={id,cssFamily:'Registered',familyId:'family',weight:'400',style:'normal',fileFormat:'ttf',fileUrl:'/font.ttf',isActive:true,webfontAllowed:true,familyIsActive:true,familyWebfontAllowed:true};
test('six roles accept only face IDs; arbitrary CSS, extra keys and malformed values rejected',()=>{
 assert.equal(Object.keys(api.validateArticleFontDesign(Object.fromEntries(api.articleFontRoles.map(r=>[r,id])))).length,6);
 for(const v of [[],null,{title:'url(secret)'},{title:400},{weight:'700'},{title:id,extra:id}])assert.equal(api.validateArticleFontDesign(v),null);
 assert.deepEqual(api.validateArticleFontDesign({title:''}),{});
});
test('inactive/unavailable fonts fall back without emitting overrides; real weight/style shared across devices',()=>{
 assert.deepEqual(api.articleFontDesignStyle({title:id},[{...face,isActive:false}]),{});
 assert.deepEqual(api.articleFontDesignStyle({title:id},[]),{});
 const style=api.articleFontDesignStyle({title:id,body:id},[{...face,weight:'600',style:'italic'}]);
 assert.equal(style['--article-title-weight'],'600');assert.equal(style['--article-body-style'],'italic');assert.match(style['--article-title-family'],/Registered.*system-ui/);
 assert.equal(api.articleFontDesignRoles(undefined,[face]),'');assert.equal(api.articleFontDesignRoles({title:id},[face]),'title');
});
function routeHarness(){let denied=false,stage=true,origin=true,writes=[];const comp={id:'c',updatedAt:'2026-10-28T01:00:00Z',settings:{textDesign:{captionStyled:true},productionPattern:'existing',custom:{retained:true}},assets:[{id:'placement'}]};
 const route=loader({'@/lib/staging-environment':{stagingRequestAllowed:()=>stage},'@/lib/article-image-api-origin':{requireImageSameOrigin(){if(!origin)throw Error('origin');}},'@/lib/project-api-access':{requireProjectApiAccess:async()=>denied?{ok:false,response:Response.json({ok:false},{status:403})}:{ok:true,project:{id:pid,slug:'samples'}}},'@/lib/newsletter-repository':{getProjectContent:async()=>({articles:[{id:aid}]}),getProjectDesignAssets:async()=>({ok:true,assets:[]}),getFontAssets:async()=>({source:'supabase',fonts:[face]})},'@/lib/article-composition-repository':{getProjectArticleComposition:async()=>({status:'ok',data:comp}),updateProjectArticleCompositionSettings:async(...args)=>{writes.push(args);return {status:'ok',data:{...comp,settings:args[2]},message:'ok'};}}})('src/app/api/project-article-composition/route.ts');
 return {comp,writes,set(o){if('denied'in o)denied=o.denied;if('stage'in o)stage=o.stage;if('origin'in o)origin=o.origin;},run:patch=>route.PATCH(new Request('https://staging.test/api/project-article-composition',{method:'PATCH',body:JSON.stringify({action:'update_font_design',projectSlug:'samples',articleId:aid,compositionId:'c',expectedUpdatedAt:comp.updatedAt,fontDesign:{title:id},...patch})}))};}
test('font save preserves complete settings, placements and article identity; passes optimistic version',async()=>{const h=routeHarness();assert.equal((await h.run({})).status,200);assert.equal(h.writes.length,1);const [p,a,s,version]=h.writes[0];assert.equal(p,pid);assert.equal(a,aid);assert.deepEqual(s.custom,{retained:true});assert.deepEqual(s.textDesign,h.comp.settings.textDesign);assert.deepEqual(s.fontDesign,{title:id});assert.equal(version,h.comp.updatedAt);assert.equal(h.comp.assets[0].id,'placement');assert(!h.comp.settings.fontDesign);});
test('unauthorized, wrong environment/origin, stale UI and unregistered face never save',async()=>{
 for(const [state,patch,status]of [[{denied:true},{},403],[{stage:false},{},404],[{origin:false},{},403],[{},{expectedUpdatedAt:'old'},409],[{},{fontDesign:{body:'10000000-0000-0000-0000-000000000001'}},400],[{},{articleId:'other'},404]]){const h=routeHarness();h.set(state);assert.equal((await h.run(patch)).status,status);assert.equal(h.writes.length,0);}
});
test('repository CAS conflict does not overwrite concurrent Composition',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';let seen;
 global.fetch=async(url,options)=>{seen={url,options};return Response.json([]);};
 try{const repo=loader({'@/lib/supabase-config':{getSupabaseConfigStatus:()=>({isConfigured:true,hasServiceRoleKey:true}),getSupabaseRestEndpoint:p=>'https://fixture.invalid'+p}})('src/lib/article-composition-repository.ts');const r=await repo.updateProjectArticleCompositionSettings(pid,aid,{fontDesign:{title:id}},'2026-10-28T00:00:00Z');assert.equal(r.status,'conflict');assert.equal(new URL(seen.url).searchParams.get('updated_at'),'eq.2026-10-28T00:00:00Z');assert.deepEqual(JSON.parse(seen.options.body),{settings:{fontDesign:{title:id}}});assert.equal(seen.options.method,'PATCH');}
 finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
test('actual-face picker saves selected weight, preview requests that face, existing picker default unchanged',()=>{
 let states=[],cursor=0,effects=[];const nodes=(t,p)=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(v=>nodes(v,p)):[...(p(t)?[t]:[]),...nodes(t.props?.children,p)];
 const component=loader({'react':{useId:()=> 'f',useState(v){const i=cursor++;if(!(i in states))states[i]=v;return [states[i],v=>states[i]=v];},useMemo:fn=>fn(),useEffect:fn=>effects.push(fn)}})('src/components/searchable-font-select.tsx').SearchableFontSelect;
 const fonts=[face,{...face,id:'0a55dd35-1fb8-5694-ad38-ba17770d3f2d',weight:'700'}];const render=()=>{cursor=0;return component({fonts,defaultValue:id,label:'제목',name:'title',inheritLabel:'기존 디자인',selectFace:true});};let tree=render();nodes(tree,e=>e.type==='select'&&e.props['aria-label']==='제목 굵기 · 스타일')[0].props.onChange({target:{value:fonts[1].id}});tree=render();assert.equal(nodes(tree,e=>e.type==='input'&&e.props.type==='hidden')[0].props.value,fonts[1].id);const preview=nodes(tree,e=>e.props.style?.fontSynthesis==='none')[0];assert.equal(preview.props.style.fontWeight,700);
});
