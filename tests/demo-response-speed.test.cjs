/* eslint-disable @typescript-eslint/no-require-imports -- Request-local read-only mocks, no provider or remote writes. */
const test=require('node:test'),assert=require('node:assert/strict'),load=require('./canva-test-loader.cjs');
test('resolved workspace is reused only for the exact slug, never cached across calls',async()=>{
 const prev=global.fetch,old={...process.env};Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://db.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture'});let projects=0;
 global.fetch=async input=>{const u=new URL(input);if(u.pathname.endsWith('/newsletter_projects')){projects++;return Response.json([]);}return Response.json([]);};
 try{const m=load()('src/lib/newsletter-repository.ts'),workspace={ok:true,source:'supabase',project:{id:'p',slug:'sample'}};
  assert.equal((await m.getProjectContent('sample',workspace)).source,'supabase');assert.equal(projects,0);
  await m.getProjectContent('foreign',workspace);assert.equal(projects,1);
  await m.getProjectContent('sample');assert.equal(projects,2);
 }finally{global.fetch=prev;for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);}
});
test('request timing diagnostics contain only allowlisted names, numbers and correlation ID, including failure',async()=>{
 const prev=console.info,logs=[];console.info=x=>logs.push(x);
 try{const m=load()('src/lib/demo-share-diagnostics.ts'),t=m.createDemoTrace('render');
  assert.equal(await m.demoTimed(t,'access',async()=>7),7);
  await assert.rejects(m.demoTimed(t,'cover',async()=>{throw Error('secret-cookie-original-text');}));
  assert.equal(logs.length,2);for(const x of logs){assert.deepEqual(Object.keys(x),['requestId','phase','durationMs']);assert(Number.isFinite(x.durationMs));assert(x.durationMs>=0);}
  assert.match(m.demoTimingHeader(t),/^access;dur=\d+(\.\d+)?, cover;dur=\d+(\.\d+)?$/);assert(!JSON.stringify(logs).includes('secret'));
 }finally{console.info=prev;}
});

test('early cover reuses cover design and image, disables existing CTAs until ready, contains no entry button',()=>{
 const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;
 const Pending=load()('src/components/hwaseong-demo-cover-pending.tsx').HwaseongDemoCoverPending;
 const html=render(React.createElement(Pending,{cover:{coverImageSrc:'data:image/webp;base64,existing',coverLayout:'image_info',coverFit:'contain',masthead:'특별한 화성소식',coverTitle:'화성의 오늘을 더 가까이',coverSubtitle:'기존 부제',coverIssueText:'2026.10'}}));
 assert.match(html,/data-demo-early-cover/);assert.match(html,/화성의 오늘을 더 가까이/);assert.match(html,/loading="eager"/);assert.match(html,/fetchPriority="high"/);assert.equal((html.match(/disabled=""/g)||[]).length,2);assert(!html.includes('소식지 열기'));assert(!html.includes('/projects/'));
});
test('server-prepared audio starts ready without a manifest request or autoplay; ordinary players still fetch their manifest',async()=>{
 const React=require('react'),oldWindow=global.window,oldFetch=global.fetch;
 try{for(const prepared of [true,false]){const effects=[],states=[];let cursor=0,calls=0,plays=0,refs=0;
 global.window={localStorage:{getItem:()=>null},setTimeout:f=>{f();return 1;},clearTimeout:()=>{}};
 global.fetch=async()=>{calls++;return Response.json({hasAudio:true,segments:[{index:0,url:'/protected.mp3'}]});};
 const Player=load({react:{...React,useRef:v=>({current:refs++===0?{pause(){},play:async()=>plays++,currentTime:0}:v}),useState:v=>{const i=cursor++;states[i]=typeof v==='function'?v():v;return [states[i],n=>states[i]=n];},useEffect:f=>effects.push(f),useCallback:f=>f}})('src/components/public-article-audio-player.tsx').PublicArticleAudioPlayer;
 const element=Player({ariaLabel:'AI 음성',isAiGenerated:true,manifestUrl:'/manifest',...(prepared?{initialSegments:[{index:0,url:'/protected.mp3'}]}:{})});element.type(element.props);if(prepared){assert.equal(states[6],'ready');assert.equal(states[1][0].url,'/protected.mp3');}const clean=effects[2]();await new Promise(r=>setTimeout(r,5));assert.equal(calls,prepared?0:1);assert.equal(states[6],'ready');assert.equal(states[1][0].url,'/protected.mp3');assert.equal(plays,0);clean?.();
 }}finally{global.window=oldWindow;global.fetch=oldFetch;}
});
test('server metadata renders enabled controls immediately without downloading MP3; invalid metadata stays loading and source changes reset player identity',()=>{
 const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;
 const Player=load()('src/components/public-article-audio-player.tsx').PublicArticleAudioPlayer;
 const props={ariaLabel:'AI 음성',isAiGenerated:true,manifestUrl:'/manifest',initialSegments:[{index:0,url:'/protected.mp3'}]};
 const html=render(React.createElement(Player,props));assert.match(html,/preload="none"/);assert.match(html,/src="\/protected.mp3"/);assert(!/<button[^>]*disabled=""/.test(html));assert(!html.includes('준비 중'));assert(!html.includes('autoPlay'));
 for(const invalid of [[{index:1,url:'/wrong.mp3'}],[{index:0,url:'//foreign.invalid/audio'}],[{index:0,url:'/\\foreign.mp3'}]]){
  const h=render(React.createElement(Player,{...props,initialSegments:invalid}));assert(h.includes('준비 중'));assert(/<button[^>]*disabled=""/.test(h));assert(!h.includes('src='));
 }
 assert.notEqual(Player(props).key,Player({...props,initialSegments:[{index:0,url:'/replacement.mp3'}]}).key);
});
test('bundled Staging snapshot is fresh per request and preserves expiry/revoke/source guards without a second project/content read',async()=>{
 const p='4cd5297e-a0fd-434c-84d4-fa4d3baf9389',slug='hwaseong-2026-10-samples',oldFetch=global.fetch,key=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';let reads=0;
 const article={id:'11111111-1111-4111-8111-111111111111',title:'기사',body:'원문',status:'draft',publicationKind:'regular',blocks:[],links:[]};
 const project={id:p,slug,statusCode:'draft'},articles=[article];let share;
 const m=load({'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>true},'@/lib/newsletter-repository':{getProjectContentSnapshotById:async id=>{assert.equal(id,p);reads++;return {workspace:{ok:true,project},content:{source:'supabase',articles}};},getProjectWorkspaceById:()=>{throw Error('Duplicate project read');},getProjectContent:()=>{throw Error('Duplicate content read');}},'@/lib/supabase-config':{getSupabaseRestEndpoint:p=>'https://db.invalid'+p}})('src/lib/demo-share.ts');
 share={id:'22222222-2222-4222-8222-222222222222',project_id:p,article_ids:[article.id],source_snapshot:m.demoSnapshot(articles),expires_at:null,revoked_at:null};
 global.fetch=async(_u,o={})=>{assert.equal(o.method,'GET');return Response.json([share]);};
 try{assert.equal((await m.getDemoAccess('A'.repeat(43),slug)).articles.length,1);assert.equal(reads,1);await m.getDemoAccess('A'.repeat(43),slug);assert.equal(reads,2);
 article.body='원고 변경';await assert.rejects(m.getDemoAccess('A'.repeat(43),slug),e=>e.code==='SOURCE_CHANGED');assert.equal(reads,3);share.revoked_at='2026-10-30';await assert.rejects(m.getDemoAccess('A'.repeat(43),slug),e=>e.code==='REVOKED');assert.equal(reads,3);share.revoked_at=null;share.expires_at='2000-01-01';await assert.rejects(m.getDemoAccess('A'.repeat(43),slug),e=>e.code==='EXPIRED');assert.equal(reads,3);
 }finally{global.fetch=oldFetch;if(key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=key;}
});
test('bundled snapshot fails closed for an incomplete relation, foreign project, or server failure',async()=>{
 const f=global.fetch,old={...process.env};Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'});
 const p='4cd5297e-a0fd-434c-84d4-fa4d3baf9389',m=load()('src/lib/newsletter-repository.ts');
 try{for(const body of [[{id:p,articles:[],pages:[]}],[{id:'foreign',articles:[],audios:[],pages:[]}],[{id:p,articles:[{id:'a',project_id:p,blocks:[],links:null}],audios:[],pages:[]}]]){global.fetch=async(_u,o)=>{assert.equal(o.cache,'no-store');return Response.json(body);};assert.equal((await m.getProjectContentSnapshotById(p)).content.source,'error');}
 global.fetch=async()=>new Response(null,{status:503});assert.equal((await m.getProjectContentSnapshotById(p)).content.source,'error');
 }finally{global.fetch=f;for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);}
});
